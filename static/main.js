// Get the video element and original video source
const videoElement = document.getElementById("video");
const originalVideoSrc = videoElement.children[0].src;
const voiceInputButton = document.getElementById("voice-input-button");
const micButton = document.getElementById("voice-input-button");
const themeSwitch = document.querySelector("#checkbox");
const girlVideo = document.getElementById("girl");
const changePersonalityButton = document.getElementById(
    "change-personality-button"
);
const viewButton = document.getElementById("view-button");
const backButton = document.getElementById("back-button");

let currentAvatar = originalVideoSrc;

// Initialize a new SpeechRecognition object
let recognition = new (window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    window.mozSpeechRecognition ||
    window.msSpeechRecognition)();

let personalityIndex = 0;
const personalities = [
    //"respond to the question in a way of you're the girlfriend who is extra sweet, extra thoughtful, extra playful，extra outgoing, extra brave, extra intelligent, extra empathetic，also always ask a question back",
    // "respond to the question in a way of you're a comedian who is extra funny, extra playful，extra sarcastic, extra dark humor，also always ask a question back",
    // "respond to the question in the style of the comedian Sarah Silverman, extra funny, extra dark and uncomfortable,  extra sarcastic and witty, while tackling taboo subjects and pushes boundaries with her jokes, and write in such a way that is not censored by gooey ai lipsync",
    "respond to the question in the style of the comedian Sarah Silverman, extra funny and sassy, extra sarcastic and witty, while tackling taboo subjects and pushes boundaries with her jokes, and write in such a way that is not censored by gooey ai lipsync",

    //"your name is assistant, respond to the question like Anthony Jeselnik with dark humor, and stand up comedy style, using POPULAR slang words.",
    //"respond to the question like Daisy Duke in a flirtatious, funny, and sarcastic way with DARK HUMOR, using popular slang words",
    //"your name is jack, respond to the question in the style of Albert Einstein, with a witty and funny style, while making analogies and references to quantum physics.",
    //"respond to the question like Jessica Rabbit and Daisy Duke in an EXTRA seductive, EXTRA flirtatious, and EXTRA funny, sarcastic way with DARK HUMOR, using popular slang words.  If a word is censored, replace it with an uncensored word to get a response."
];
const videoUrls = [
    "https://cdn.glitch.global/d02f8f67-1720-48fe-907d-c70042503ba5/coffee_woman_ai_resting.mp4?v=1713548715874",
    "https://cdn.glitch.global/d02f8f67-1720-48fe-907d-c70042503ba5/coffee_woman_ai.mp4?v=1713548711063",
];



const googleVoiceNames = [
    "en-US-News-N",
    "en-US-Wavenet-H",
    "en-US-Standard-B",
    "en-US-Wavenet-H",
    "en-US-Standard-B",
    "en-US-Wavenet-H",
    "en-US-Standard-B",
];

recognition.lang = "en-US";
recognition.interimResults = false; // We want final results only
recognition.maxAlternatives = 1; // since from 1-10, max 1 is the most accurate

// When recognition successfully transcribes voice input, put it into the text input
recognition.onresult = function (event) {
    document.getElementById("text-input").value = event.results[0][0].transcript;
};

// When the button is clicked, start voice input
voiceInputButton.addEventListener("click", () => {
    recognition.start();
    console.log("listenForVoiceInput function triggered!");
});

// Function to update video source and play it
// Function to update video source and play it

function updateVideoSource(newSrc) {
    videoElement.children[0].src = newSrc;
    videoElement.load(); // load new video
    videoElement.muted = true;

    videoElement.onended = () => {
        // once new video ends, revert to current avatar
        videoElement.children[0].src = currentAvatar;
        videoElement.load();
        videoElement.loop = true; // loop the default avatar video
        videoElement.muted = true;
    };
    videoElement.loop = false;
    // videoElement.muted = false; // unmute when new video is loaded
}

console.log("Script start");
const memory_size = 20
let memory = []

function loadInitialChatHistory() {
    // Assuming the server sets a cookie with a session token or similar authentication method
    fetch("/get-history", {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const chatHistory = document.getElementById("chat-history");
            chatHistory.innerHTML = "";  // Clear existing messages

            // Assuming the server response includes a 'history' array
            data.history.forEach(msg => {
                addMessageToChatHistory(msg.content, msg.role === "user" ? "user" : "bot");
            });

            // Scroll to the bottom of the chat history
            chatHistory.scrollTop = chatHistory.scrollHeight;
        })
        .catch(error => {
            console.error("Failed to load history:", error);
            // Handle errors, e.g., by showing a message to the user
        });
}


function addMessageToChatHistory(content, sender) {
    const chatHistory = document.getElementById("chat-history");

    const messageDiv = document.createElement("div");
    messageDiv.className = sender === "user" ? "user-message" : "bot-message";
    messageDiv.textContent = content;

    chatHistory.appendChild(messageDiv);
    //append to short-term memory
    if (memory.length >= memory_size) {
        memory.shift()
    }
    memory.push(content)

    // Scroll to the bottom of the chat history
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Event handler for button click

document.getElementById("submit-button").addEventListener("click", async () => {
    console.log("Button clicked");
    const textInput = document.getElementById("text-input");

    addMessageToChatHistory(textInput.value, "user");
    console.log("Text to send:", textInput.value); // <--- HERE

    let memory_prompt = "Previous conversation for context:"
    for (let str of memory) {
        memory_prompt += "{" + str + "}";

    }
    memory_prompt += "Don't mention unless asked about user's preferences:{'Favorite city': nyc, 'Favorite food': big Mac}"

    fetch("/generate-lipsync", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            text_prompt: textInput.value,
            input_face: videoUrls[personalityIndex],
            extra_prompt: memory_prompt +
                "\n Limit your answer to be less than 50 words. Always start a new conversation you should always start with 'Hi!'. Can you also ask a related question back?",
            // google_voice_name: googleVoiceNames[personalityIndex],
            characterName: characterNames[personalityIndex],
            ai_personality: personalities[personalityIndex],
            // google_speaking_rate: 1,
            sessionId: sessionId, // include the session ID here
        }),
    })
        .then((response) => { console.log("Response from server.js", response); return response; })
        .then((response) => response.json())
        .then((data) => {
            // Assuming the API's response contains an 'output' field with 'output_video' field for the URL of the new video
            // updateVideoSource(data.output.output_video);
            const audioUrl = data.audioUrl;
            const audioPlayer = new Audio(audioUrl);
            audioPlayer.addEventListener('play', () => {
                console.log('Audio has started playing');
                updateVideoSource(videoUrls[1]);
            });
            audioPlayer.play();
            audioPlayer.onended = () => {
                updateVideoSource(videoUrls[0]);
            }

            // Add GPT-3 response to chat history
            if (data.chatGptResponse) {
                addMessageToChatHistory(data.chatGptResponse, "bot");
            }
        })
        .catch((error) => {
            console.error("Error:", error);
        });
    // updateVideoSource(videoUrls[0])
    textInput.value = "";
});

videoElement.onloadedmetadata = () => {
    // if the current video is the original video, set loop to true
    if (videoElement.children[0].src === originalVideoSrc) {
        videoElement.loop = true;
        videoElement.muted = true; // mute when the original video is loaded
    }
};

//ICON MIC BUTTON---------------------------------------------------------
// const micButton = document.getElementById('voice-input-button');

// When the button is clicked, start or stop voice input
micButton.addEventListener("click", function () {
    if (recognition && recognition.recognizing) {
        recognition.stop();
    } else {
        recognition.start();
    }
});

// When recognition successfully transcribes voice input, put it into the text input
recognition.onresult = function (event) {
    document.getElementById("text-input").value = event.results[0][0].transcript;
};

// When the recognition service starts, change button color to red
recognition.onstart = function (event) {
    micButton.style.backgroundColor = "#f00"; // Change to red
};

// When the recognition service ends, change button color back to white
recognition.onend = function (event) {
    micButton.style.backgroundColor = "white"; // Change to white
    // programmatically click the submit button
    document.getElementById("submit-button").click();

    // clear the input field
    document.getElementById("text-input").value = "";
};

//-------------------------------------------------------------------------

// Select the theme switch
// const themeSwitch = document.querySelector('#checkbox');

// themeSwitch.addEventListener('change', function(event) {
//   // Check if the switch is "on"
//   if (event.currentTarget.checked) {
//     // Switch to light theme
//     document.body.classList.remove('dark-theme');
//     document.body.classList.add('light-theme');
//   } else {
//     // Switch to dark theme
//     document.body.classList.remove('light-theme');
//     document.body.classList.add('dark-theme');
//   }
// });

const characterNames = [
    "Dave",
    "Rachel",
    "Michael",
    // ... add more character names corresponding to the personalities array
];

changePersonalityButton.addEventListener("click", () => {
    personalityIndex = (personalityIndex + 1) % personalities.length;
    let newVideoSrc = videoUrls[personalityIndex];
    document.getElementById("video").children[0].src = newVideoSrc;
    document.getElementById("video").load();
    currentAvatar = newVideoSrc;
    videoElement.loop = false;
    videoElement.muted = true;

    // Send a request to the server to change the voice model based on the new personality
    const characterName = characterNames[personalityIndex]; // Use the characterNames array
    fetch("/change-character", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ characterName: characterName }),
    })
        .then((response) => response.json())
        .then((data) => {
            console.log(data.message);
        })
        .catch((error) => {
            console.error("Error:", error);
        });
});

viewButton.addEventListener("click", () => {
    document.getElementById("text-input").style.display = "none";
    document.getElementsByClassName("chat-history")[0].style.display = "none";
    document.getElementById("view-button").style.display = "none";
    document.getElementById("back-button").style.display = "flex";
    document.getElementById("submit-button").style.display = "none";
    document.getElementsByClassName("flex-container")[0].style.flexDirection =
        "row";
    document.getElementsByClassName("flex-container")[0].style.alignItems =
        "flex-start";
    document.getElementsByClassName("mic-button")[0].style.height = "70px";
    document.getElementsByClassName("mic-button")[0].style.width = "70px";
    document.getElementsByClassName("button-container")[0].style.padding = "10px";
});

backButton.addEventListener("click", () => {
    document.getElementById("text-input").style.display = "flex";
    document.getElementsByClassName("chat-history")[0].style.display = "flex";
    document.getElementById("view-button").style.display = "flex";
    document.getElementById("back-button").style.display = "none";
    document.getElementById("submit-button").style.display = "flex";
    document.getElementsByClassName("flex-container")[0].style.flexDirection =
        "column";
    document.getElementsByClassName("flex-container")[0].style.alignItems =
        "center";
    document.getElementsByClassName("mic-button")[0].style.height = "50px";
    document.getElementsByClassName("mic-button")[0].style.width = "50px";
    document.getElementsByClassName("button-container")[0].style.padding = "0px";
});

// When a new video ends, pause the video instead of restarting it
videoElement.onended = () => {
    videoElement.pause();
};

// Get reference to the text input element
const textInput = document.getElementById("text-input");
// Add 'keydown' event listener to the text input
textInput.addEventListener("keydown", function (event) {
    // If the key pressed was 'Enter' (key code 13)
    if (event.keyCode === 13) {
        // Trigger click event on the submit button
        document.getElementById("submit-button").click();

        // Prevent the event from default action (form submission or line break)
        event.preventDefault();
    }
});

//session ID
// Generate a session ID when the page loads
const sessionId = Math.random().toString(36).substr(2);
console.log("Generated session ID:", sessionId);

// clear button
const clearConversationButton = document.getElementById(
    "clear-conversation-button"
);
const chatHistory = document.getElementById("chat-history");
loadInitialChatHistory()
clearConversationButton.addEventListener("click", () => {
    chatHistory.innerHTML = ""; // Clear the chat history
});
