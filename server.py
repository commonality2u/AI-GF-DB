import os
import requests
from io import BytesIO
from datetime import datetime
import openai
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv
from flask import (
    Flask,
    request,
    send_file,
    jsonify,
    render_template,
    redirect,
    url_for,
    flash,
    session,
)
from flask_login import (
    LoginManager,
    UserMixin,
    login_user,
    login_required,
    logout_user,
    current_user,
)
from flask_bcrypt import Bcrypt
from forms import RegistrationForm, LoginForm
import sys

load_dotenv()
DEBUG = False

app = Flask(__name__)
bcrypt = Bcrypt(app)
app.config["SECRET_KEY"] = "arbitrarySecretKey"
login_manager = LoginManager(app)
# login_manager.login_view = "login"

# Store audio buffers in memory
audio_buffers = {}

# Voice model mappings
CHARACTER_VOICES = {
    "Rachel": "21m00Tcm4TlvDq8ikWAM",
}

current_voice_model = CHARACTER_VOICES["Rachel"]  # Default character

# Sessions to maintain conversation state
sessions = {}

# Setup OpenAI GPT with the API key
openai.api_key = os.getenv("OPENAI_API_KEY")

# MongoDB connection
uri = (
    "mongodb+srv://aihold:"
    + os.getenv("MONGO_DB_AIHOLD_PWD")
    + "@ai-girlfriend-videorepl.onbapx9.mongodb.net/?retryWrites=true&w=majority&appName=ai-girlfriend-videoreplay-Cluster0"
)
client = MongoClient(uri, server_api=ServerApi("1"))

try:
    client.admin.command("ping")
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)

db = client["ai-girlfriend-videoreplay-Cluster0"]
collection = db["conversations"]
users_collection = db["users"]


### MODEL
from bson import ObjectId


class User(UserMixin):
    def __init__(self, user_id, username, password):
        self.id = user_id
        self.username = username
        self.password = password

    @staticmethod
    def get(user_id):
        try:
            user_data = users_collection.find_one({"_id": ObjectId(user_id)})
            if user_data:
                return User(
                    user_data["_id"],
                    user_data["username"],
                    user_data["hashed_password"],
                )
        except Exception as e:
            print(f"Error finding user: {e}")
        print("User not found")
        return None

    def __repr__(self):
        return "<User %r>" % self.id

    def is_active(self):
        return True


@login_manager.unauthorized_handler
def unauthorized():
    flash("You need to log in to access this page.", "warning")
    return redirect(url_for("login"))


@app.route("/", methods=["GET"])
def index():
    if not current_user.is_authenticated:
        return redirect(url_for("login"))

    current_user_name = current_user.username.title()
    # Fetch chat history from MongoDB
    user_history = collection.find_one({"user_id": current_user.id})
    if user_history:
        chat_history = user_history.get("history", [])
    else:
        chat_history = []

    return render_template(
        "index.html", loggedin_user=current_user_name, chat_history=chat_history
    )


## Auth
@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("/"))

    if request.method == "GET":
        form = RegistrationForm()
        return render_template("register.html", title="Register", form=form)

    # if post request
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")

        if users_collection.find_one({"username": username}):
            flash("Username already exists. Choose a different one.", "danger")
        else:
            users_collection.insert_one(
                {"username": username, "hashed_password": hashed_password}
            )
            flash("Registration successful. You can now log in.", "success")
            return redirect(url_for("login"))
        flash(f"Account created for {username}!", "success")
        return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    form = LoginForm()
    if current_user.is_authenticated:
        return redirect(url_for("index"))

    if request.method == "GET":
        return render_template("login.html", form=form, title="Login")

    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        user_data = users_collection.find_one({"username": username})

        # Debug print statements
        if DEBUG:
            print(f"Username: {username}")
            print(f"Password: {password}")
            print(f"User Data: {user_data}")

        if user_data:
            if bcrypt.check_password_hash(user_data["hashed_password"], password):
                user = User(
                    user_data["_id"],
                    user_data["username"],
                    user_data["hashed_password"],
                )
                login_user(user, remember=request.form.get("remember", False))
                flash(f"Logged in as {username}!", "success")
                return redirect(url_for("index"))
            else:
                print("Password does not match")
        else:
            print("User not found in database")

        flash("Login Unsuccessful. Please check username and password", "danger")
        return render_template("login.html", form=form, title="Login", login_error=True)


@app.route("/logout")
@login_required
def logout():
    logout_user()
    flash("You have been logged out.", "success")
    return redirect(url_for("login"))


@login_manager.user_loader
def load_user(user_id):
    return User.get(user_id)


### FUNCTIONALITY
def generate_audio(text, voice_model):
    response = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_model}",
        headers={
            "Content-Type": "application/json",
            "xi-api-key": os.getenv("ELEVENLABS_API_KEY"),
        },
        json={
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5,
            },
        },
    )
    if response.ok:
        audio_id = datetime.now().strftime("%Y%m%d%H%M%S")
        audio_buffers[audio_id] = response.content
        return audio_id
    else:
        print("Error:", response.status_code, response.text)
        raise Exception("Error generating audio")


def retrieve_relevant_data(text_prompt):
    results = collection.find({"text": {"$regex": text_prompt, "$options": "i"}})
    relevant_data = [doc["text"] for doc in results]
    return relevant_data


# API for initilizing the conversation
@app.route("/get-history", methods=["GET"])
@login_required
def get_history():
    user_id = current_user.id  # or current_user.username depending on your user model
    conversation = collection.find_one({"user_id": user_id})

    if conversation:
        # print(conversation["history"])
        return jsonify({"history": conversation["history"]})
    else:
        # print("No conversation found")
        return jsonify({"history": []}), 404


@app.route("/clear-history", methods=["POST"])
@login_required
def clear_history():
    try:
        collection.delete_many({"user_id": current_user.id})
        print("History cleared")
        return jsonify({"success": True, "message": "History cleared"})
    except Exception as e:
        print(f"Error deleting history: {e}")
        return jsonify({"error": False, "message": "Failed to clear history"}), 500


@app.route("/generate-lipsync", methods=["POST"])
@login_required
def generate_lipsync():
    data = request.json
    text_prompt = data["text_prompt"]
    input_face = data["input_face"]
    extra_prompt = data["extra_prompt"]
    session_id = data["sessionId"]
    character_name = data.get("characterName", "Rachel")
    voice_model = CHARACTER_VOICES.get(character_name, current_voice_model)
    user_id = current_user.id

    # Search for user's preference in the database
    username = current_user.username
    user = users_collection.find_one({"username": username})
    # get personality from user
    if user:
        ai_personality = user.get("ai_personality", "")
    else:
        ai_personality = "ENTP"

    ai_personality = "Behave as " + ai_personality + " with" + data["ai_personality"]

    if session_id not in sessions:
        sessions[session_id] = [{"role": "system", "content": ai_personality}]

    sessions[session_id].append({"role": "user", "content": text_prompt + extra_prompt})

    try:
        relevant_data = retrieve_relevant_data(text_prompt)
        augmented_prompt = text_prompt + " " + " ".join(relevant_data)

        conversation = collection.find_one({"user_id": user_id})
        if not conversation:
            conversation = {"user_id": user_id, "history": []}
            collection.insert_one(conversation)
        # Append user input to history
        conversation["history"].append(
            {"role": "user", "content": text_prompt, "timestamp": datetime.now()}
        )
        collection.update_one(
            {"user_id": user_id}, {"$set": {"history": conversation["history"]}}
        )

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo", messages=sessions[session_id], max_tokens=200
        )
        gpt_text = response["choices"][0]["message"]["content"].strip()
        conversation["history"].append(
            {"role": "ai", "content": gpt_text, "timestamp": datetime.now()}
        )
        collection.update_one(
            {"user_id": user_id}, {"$set": {"history": conversation["history"]}}
        )

        sessions[session_id].append({"role": "assistant", "content": gpt_text})

        if len(sessions[session_id]) > 2:
            sessions[session_id] = sessions[session_id][-2:]

        if gpt_text:
            audio_id = generate_audio(gpt_text, voice_model)
            audio_url = f"/audio/{audio_id}"
            # print(f"prompt: {augmented_prompt}, audio_url: {audio_url}")
            return jsonify({"chatGptResponse": gpt_text, "audioUrl": audio_url})
        else:
            return jsonify({"error": "Empty response from OpenAI API"}), 500
    except Exception as e:
        print("Error:", str(e))

        return jsonify({"error": "Error generating audio"}), 500


@app.route("/audio/<audio_id>")
def get_audio(audio_id):
    if audio_id in audio_buffers:
        return send_file(BytesIO(audio_buffers[audio_id]), mimetype="audio/mpeg")
    else:
        return "Not found", 404


@app.route("/video")
def get_video():
    video_url = "https://cdn.glitch.global/d02f8f67-1720-48fe-907d-c70042503ba5/women_pink.mp4?v=1712283121318"
    response = requests.get(video_url)
    if response.ok:
        return send_file(BytesIO(response.content), mimetype="video/mp4")
    else:
        return "Video fetch failed", 500


@app.route("/change-character", methods=["POST"])
def change_character():
    character_name = request.json.get("characterName")
    if character_name in CHARACTER_VOICES:
        global current_voice_model
        current_voice_model = CHARACTER_VOICES[character_name]
        return jsonify(
            {"success": True, "message": f"Voice changed to {character_name}"}
        )
    else:
        return jsonify({"success": False, "message": "Character not found"}), 400


if __name__ == "__main__":
    app.run(port=os.getenv("PORT", 5000))
