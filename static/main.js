// Get the video element and original video source
const videoElement = document.getElementById("video");
const originalVideoSrc = videoElement.children[0].src;
const voiceInputButton = document.getElementById("voice-input-button");
const micButton = document.getElementById("voice-input-button");
const themeSwitch = document.querySelector("#checkbox");
const girlVideo = document.getElementById("girl");
const changePersonalityButton = document.getElementById("change-personality-button");
const viewButton = document.getElementById("view-button");
const backButton = document.getElementById("back-button");

let currentAvatar = originalVideoSrc;
// Initialize a new SpeechRecognition object
let recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();

let personalityIndex = 0;
const personalities = [""];
const videoUrls = [
    "https://cdn.glitch.global/d02f8f67-1720-48fe-907d-c70042503ba5/coffee_woman_ai_resting.mp4?v=1713548715874",
    "https://cdn.glitch.global/d02f8f67-1720-48fe-907d-c70042503ba5/coffee_woman_ai.mp4?v=1713548711063"
];

const googleVoiceNames = [
    "en-US-News-N",
    "en-US-Wavenet-H",
    "en-US-Standard-B",
    "en-US-Wavenet-H",
    "en-US-Standard-B",
    "en-US-Wavenet-H",
    "en-US-Standard-B"
];

recognition.lang = "en-US";
recognition.interimResults = false;
recognition.maxAlternatives = 1;

async function autoDetectVoiceInput() {
    while (true) {
        if (!isAISpeaking) {
            recognition.start();
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

recognition.onresult = function (event) {
    document.getElementById("text-input").value = event.results[0][0].transcript;
};

voiceInputButton.addEventListener("click", () => {
    recognition.start();
    console.log("listenForVoiceInput function triggered!");
});

function updateVideoSource(newSrc) {
    videoElement.children[0].src = newSrc;
    videoElement.load();
    videoElement.muted = true;

    videoElement.onended = () => {
        videoElement.children[0].src = currentAvatar;
        videoElement.load();
        videoElement.loop = true;
        videoElement.muted = true;
    };
    videoElement.loop = false;
}

console.log("Script start");
const memorySize = 20;
let memory = [];

function loadInitialChatHistory() {
    fetch("/get-history", {
        method: "GET",
        headers: {
            'Content-Type': 'application/json'
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
            chatHistory.innerHTML = "";

            data.history.forEach(msg => {
                addMessageToChatHistory(msg.content, msg.role === "user" ? "user" : "bot");
            });

            chatHistory.scrollTop = chatHistory.scrollHeight;
        })
        .catch(error => {
            console.error("Failed to load history:", error);
        });
}

function addMessageToChatHistory(content, sender) {
    const chatHistory = document.getElementById("chat-history");
    const messageDiv = document.createElement("div");

    messageDiv.className = sender === "user" ? "user-message" : "bot-message";
    messageDiv.textContent = content;

    chatHistory.appendChild(messageDiv);

    if (memory.length >= memorySize) {
        memory.shift();
    }
    memory.push(content);

    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function handleAISpeech(audioUrl) {
    const audioPlayer = new Audio(audioUrl);

    audioPlayer.addEventListener('play', () => {
        console.log('Audio has started playing');
        isAISpeaking = true;
        voiceInputButton.disabled = true; // Disable the button while AI is speaking
        updateVideoSource(videoUrls[1]); // Update video source while AI is speaking
    });

    audioPlayer.addEventListener('ended', () => {
        console.log('Audio has finished playing');
        isAISpeaking = false;
        voiceInputButton.disabled = false; // Enable the button after AI finishes speaking
        updateVideoSource(videoUrls[0]); // Revert video source after AI finishes speaking
        autoDetectVoiceInput(); // Restart voice input detection after AI stops speaking
    });

    audioPlayer.addEventListener('error', (error) => {
        console.error('Error occurred while playing audio:', error);
        isAISpeaking = false;
        voiceInputButton.disabled = false; // Ensure button is enabled in case of error
        updateVideoSource(videoUrls[0]); // Revert video in case of error
    });

    // Play the audio and handle any playback issues
    try {
        audioPlayer.play().catch(error => {
            console.error('Playback failed:', error);
            isAISpeaking = false;
            voiceInputButton.disabled = false; // Ensure button is enabled in case of playback failure
        });
    } catch (error) {
        console.error('Error occurred during audio play attempt:', error);
        isAISpeaking = false;
        voiceInputButton.disabled = false; // Ensure button is enabled in case of error
    }
}
function handleApiResponse(data) {
    // Assuming data contains the audio URL and any necessary video updates
    if (data.audioUrl) {
        handleAISpeech(data.audioUrl); // Play the audio and update video accordingly
    } else {
        console.error("No audio URL received from API response");
    }

    // Handle additional response data, like chat messages or video updates...
    if (data.chatGptResponse) {
        addMessageToChatHistory(data.chatGptResponse, "bot");
    }
}

document.getElementById('personality-form').addEventListener('submit', function (event) {
    event.preventDefault();

    const selectedPersonality = document.getElementById('personality-select').value;
    const data = { ai_personality: selectedPersonality };

    fetch('/change-personality', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Personality changed to: ' + selectedPersonality);
            } else {
                alert('Failed to change personality: ' + data.message);
            }
        })
        .catch((error) => {
            console.error('Error:', error);
            alert('Failed to send request.');
        });
});

document.getElementById("submit-button").addEventListener("click", async () => {
    console.log("Button clicked");
    const textInput = document.getElementById("text-input");

    addMessageToChatHistory(textInput.value, "user");
    console.log("Text to send:", textInput.value);

    let memoryPrompt = "Previous conversation for context:";
    for (let str of memory) {
        memoryPrompt += "{" + str + "}";
    }
    memoryPrompt += "";

    fetch("/generate-lipsync", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text_prompt: textInput.value,
            input_face: videoUrls[personalityIndex],
            extra_prompt: memoryPrompt + "\n This is a system context: Limit your answer to be less than 50 words unless you the user prompted something that requires you to say something that long. Sometimes write long responses sometimes short(1-4)",
            characterName: characterNames[personalityIndex],
            ai_personality: personalities[personalityIndex],
            sessionId: sessionId
        })
    })
        .then((response) => response.json())
        .then(data => handleApiResponse(data))
        .then((data) => {
            // Assuming the API's response contains an 'output' field with 'output_video' field for the URL of the new video
            // updateVideoSource(data.output.output_video);
            handleAISpeech(data.audioUrl);

            // Add GPT-3 response to chat history
            if (data.chatGptResponse) {
                addMessageToChatHistory(data.chatGptResponse, "bot");
            }
        })
        .catch((error) => {
            console.error("Error:", error);
            isAISpeaking = false;
            voiceInputButton.disabled = false; // Enable the button in case of an error
        });
});

videoElement.onloadedmetadata = () => {
    if (videoElement.children[0].src === originalVideoSrc) {
        videoElement.loop = true;
        videoElement.muted = true;
    }
};

micButton.addEventListener("click", function () {
    if (recognition && recognition.recognizing) {
        recognition.stop();
    } else {
        recognition.start();
    }
});

recognition.onstart = function () {
    micButton.style.backgroundColor = "#f00";
};

recognition.onend = function () {
    micButton.style.backgroundColor = "white";
    document.getElementById("submit-button").click();
    document.getElementById("text-input").value = "";
};

const characterNames = [
    "Dave",
    "Rachel",
    "Michael"
];

changePersonalityButton.addEventListener("click", () => {
    personalityIndex = (personalityIndex + 1) % personalities.length;
    let newVideoSrc = videoUrls[personalityIndex];
    document.getElementById("video").children[0].src = newVideoSrc;
    document.getElementById("video").load();
    currentAvatar = newVideoSrc;
    videoElement.loop = false;
    videoElement.muted = true;

    const characterName = characterNames[personalityIndex];
    fetch("/change-character", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ characterName: characterName })
    })
        .then(response => response.json())
        .then(data => {
            console.log(data.message);
        })
        .catch(error => {
            console.error("Error:", error);
        });
});

viewButton.addEventListener("click", () => {
    document.getElementById("text-input").style.display = "none";
    document.getElementsByClassName("chat-history")[0].style.display = "none";
    document.getElementById("view-button").style.display = "none";
    document.getElementById("back-button").style.display = "flex";
    document.getElementById("submit-button").style.display = "none";
    document.getElementsByClassName("flex-container")[0].style.flexDirection = "row";
    document.getElementsByClassName("flex-container")[0].style.alignItems = "flex-start";
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
    document.getElementsByClassName("flex-container")[0].style.flexDirection = "column";
    document.getElementsByClassName("flex-container")[0].style.alignItems = "center";
    document.getElementsByClassName("mic-button")[0].style.height = "50px";
    document.getElementsByClassName("mic-button")[0].style.width = "50px";
    document.getElementsByClassName("button-container")[0].style.padding = "0px";
});

videoElement.onended = () => {
    videoElement.pause();
};

const textInput = document.getElementById("text-input");
textInput.addEventListener("keydown", function (event) {
    if (event.keyCode === 13) {
        document.getElementById("submit-button").click();
        event.preventDefault();
    }
});

const sessionId = Math.random().toString(36).substr(2);
console.log("Generated session ID:", sessionId);

const clearConversationButton = document.getElementById("clear-conversation-button");
const chatHistory = document.getElementById("chat-history");

loadInitialChatHistory();
clearConversationButton.addEventListener("click", () => {
    chatHistory.innerHTML = "";
    // post /clear-history
    fetch("/clear-history", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ sessionId: sessionId })
    })
        .then(response => response.json())
        .then(data => {
            console.log(data.message);
        })
        .catch(error => {
            console.error("Error:", error);
        });
});
