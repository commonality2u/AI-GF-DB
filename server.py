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
    send_from_directory,
)
from flask_login import (
    LoginManager,
    UserMixin,
    login_user,
    login_required,
    logout_user,
    current_user,
)
import pandas as pd
from flask_bcrypt import Bcrypt
from forms import RegistrationForm, LoginForm
import sys

from prompting import (
    get_predefined_personality_prompt,
    get_all_predefined_personality_names,
)

load_dotenv()
DEBUG = False

app = Flask(__name__)
bcrypt = Bcrypt(app)
app.config["SECRET_KEY"] = "arbitrarySecretKey"
login_manager = LoginManager(app)

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


@app.route("/favicon.ico")
def favicon():
    return send_from_directory(
        os.path.join(app.root_path, "static"),
        "favicon.ico",
        mimetype="image/vnd.microsoft.icon",
    )


@app.route("/chat", methods=["POST", "GET"])
def chat():
    return render_template("video.html")


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


# API for initializing the conversation
@app.route("/get-history", methods=["GET"])
@login_required
def get_history():
    user_id = current_user.id
    conversation = collection.find_one({"user_id": user_id})

    if conversation:
        return jsonify({"history": conversation["history"]})
    else:
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
        ai_personality = "Lena"

    ai_personality_prompt = get_predefined_personality_prompt(ai_personality)

    if ai_personality_prompt == "CNF":
        user_defined_personalities = user.get("personalities", "")
        if user_defined_personalities:
            ai_personality_prompt = user_defined_personalities[ai_personality]
    # print(ai_personality_prompt)
    if session_id not in sessions:
        sessions[session_id] = [
            {
                "role": "system",
                "content": "YOU ARE" + ai_personality_prompt,
            }
        ]

    sessions[session_id].append({"role": "user", "content": text_prompt + extra_prompt})

    try:
        relevant_data = retrieve_relevant_data(text_prompt)

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


@app.route("/add-personality", methods=["POST", "GET"])
@login_required
def add_personality():
    if request.method == "GET":
        return render_template("add_personalities.html")

    if request.method == "POST":
        content = request.json
        name = content["name"]
        personality = content["personality"]

        # Save the personality in a dictionary format
        users_collection.update_one(
            {"_id": ObjectId(current_user.id)},
            {"$set": {f"personalities.{name}": personality}},
            upsert=True,
        )

        return jsonify({"message": "Personality added successfully!"})


@app.route("/get-all-personalities", methods=["GET"])
@login_required
def get_personalities():
    predefined_personalities = get_all_predefined_personality_names()

    user_data = users_collection.find_one({"_id": ObjectId(current_user.id)})

    if user_data:
        user_personalities = user_data.get("personalities", {})
        all_personalities = predefined_personalities + list(user_personalities.keys())

        return jsonify(all_personalities), 200

    return jsonify(all_personalities), 200


# Get current user's AI personality
@app.route("/get-current-user-gf-personality", methods=["GET"])
def get_current_user_gf_personality():
    if current_user.is_authenticated:
        username = current_user.username
        user = users_collection.find_one({"username": username})
        if user:
            ai_personality = user.get("ai_personality", "")
            return jsonify({"ai_personality": ai_personality}), 200
    return jsonify({"ai_personality": "Lena"}), 200


@app.route("/change-personality", methods=["POST"])
@login_required
def change_personality():
    ai_personality = request.json.get("ai_personality")
    if ai_personality == "Choose a personality":
        return (
            jsonify({"success": False, "message": "Please choose a personality"}),
            400,
        )
    predefined_personalities = get_all_predefined_personality_names()
    # Look into user's personalities
    user_defined_personalities = users_collection.find_one(
        {"_id": ObjectId(current_user.id)}
    )["personalities"]

    combined_personalities = predefined_personalities + list(
        user_defined_personalities.keys()
    )

    if ai_personality in combined_personalities:
        # Update it to database
        users_collection.update_one(
            {"username": current_user.username},
            {"$set": {"ai_personality": ai_personality}},
        )
        return (
            jsonify(
                {"success": True, "message": f"Personality changed to {ai_personality}"}
            ),
            200,
        )

    return jsonify({"success": False, "message": "Invalid AI personality"}), 400


if __name__ == "__main__":
    app.run(port=os.getenv("PORT", 5000))
