# AI Girlfriend
## Table of Contents
- [AI Girlfriend](#ai-girlfriend)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Installation](#installation)
- [API Documentation for Flask Application](#api-documentation-for-flask-application)
  - [User Authentication and Management](#user-authentication-and-management)
    - [1. Registration API (`/register`)](#1-registration-api-register)
    - [2. Login API (`/login`)](#2-login-api-login)
    - [3. Logout API (`/logout`)](#3-logout-api-logout)
  - [Chat and Voice Interaction](#chat-and-voice-interaction)
    - [1. Fetch Chat History (`/get-history`)](#1-fetch-chat-history-get-history)
    - [2. Generate Audio API (`/generate-lipsync`)](#2-generate-audio-api-generate-lipsync)
    - [3. Change Character Voice (`/change-character`)](#3-change-character-voice-change-character)
  - [Audio and Video Retrieval](#audio-and-video-retrieval)
    - [1. Retrieve Audio (`/audio/<audio_id>`)](#1-retrieve-audio-audioaudio_id)
    - [2. Fetch Video (`/video`)](#2-fetch-video-video)
  - [Rationale and Usage Tips](#rationale-and-usage-tips)
- [API Documentation for Flask Application](#api-documentation-for-flask-application-1)
  - [User Authentication and Management](#user-authentication-and-management-1)
    - [1. Registration API (`/register`)](#1-registration-api-register-1)
    - [2. Login API (`/login`)](#2-login-api-login-1)
    - [3. Logout API (`/logout`)](#3-logout-api-logout-1)
  - [Chat and Voice Interaction](#chat-and-voice-interaction-1)
    - [1. Fetch Chat History (`/get-history`)](#1-fetch-chat-history-get-history-1)
    - [2. Generate Audio API (`/generate-lipsync`)](#2-generate-audio-api-generate-lipsync-1)
    - [3. Change Character Voice (`/change-character`)](#3-change-character-voice-change-character-1)
  - [Audio and Video Retrieval](#audio-and-video-retrieval-1)
    - [1. Retrieve Audio (`/audio/<audio_id>`)](#1-retrieve-audio-audioaudio_id-1)
    - [2. Fetch Video (`/video`)](#2-fetch-video-video-1)
  - [Rationale and Usage Tips](#rationale-and-usage-tips-1)

## Introduction
AI Girlfriend is a application using Flask to manage user authentication, MongoDB for database interactions, and integrates with the OpenAI and ElevenLabs APIs for generating textual and audio responses. Below is a detailed breakdown of the components and functionalities:
- **User Authentication**: Users can create an account, login, and logout. Passwords are hashed and stored in the database.
- **User Profile**: Users can view and update their profile information.
- **Chatbot**: Users can chat with the AI Girlfriend, which generates responses using the OpenAI API.
- **Voice Assistant**: Users can interact with the AI Girlfriend using voice commands, which generates audio responses using the ElevenLabs API.
- **Database**: MongoDB is used to store user information, chat history, and voice commands.

## Installation
Pre-requisites:
- Python 3.10 or higher
- Ensure a functional MongoDB instance is running
- Makesure the following keys are in .env file:
  - GOOEY_API_KEY
  - OPENAI_API_KEY
  - ELEVENLABS_API_KEY
  - MONGO_DB_AIHOLD_PWD
  - MONGO_DB_URI
    

1. Clone the repository:
   ```bash
   git clone
    ```
2. Install the required packages:
    ```bash
    python -m venv venv # Optional
    pip install -r requirements.txt
    ```
3. Run the application:
    ```bash
    python app.py
    ```

# API Documentation for Flask Application

This section outlines the APIs developed as part of the Flask application, including detailed descriptions of endpoints, expected parameters, and their functionalities. These APIs interact with various external services and internal mechanisms to deliver a comprehensive user experience, ranging from user authentication to dynamic audio and text generation.

## User Authentication and Management

### 1. Registration API (`/register`)
- **Method:** GET | POST
- **Description:** Handles the user registration process. The GET method serves the registration form, while the POST method processes the registration data.
- **Parameters:**
  - `username` (string): The desired username.
  - `password` (string): The user's password.
- **Responses:**
  - 200 OK: Returns a success message upon successful registration.
  - 400 Bad Request: Returns an error if the username already exists or if there is any validation failure.

### 2. Login API (`/login`)
- **Method:** GET | POST
- **Description:** Manages user login. The GET method provides the login form, and the POST method validates user credentials.
- **Parameters:**
  - `username` (string): Registered username.
  - `password` (string): Corresponding password.
- **Responses:**
  - 200 OK: Redirects to the home page upon successful login.
  - 401 Unauthorized: Returns an error if credentials are incorrect.

### 3. Logout API (`/logout`)
- **Method:** POST
- **Description:** Logs out the current user and ends the session.
- **Responses:**
  - 302 Redirect: Redirects to the login page after successful logout.

## Chat and Voice Interaction

### 1. Fetch Chat History (`/get-history`)
- **Method:** GET
- **Description:** Retrieves the chat history for the authenticated user from the MongoDB database.
- **Responses:**
  - 200 OK: Returns the chat history as JSON.
  - 404 Not Found: Returns an error if no history is found.

### 2. Generate Audio API (`/generate-lipsync`)
- **Method:** POST
- **Description:** Takes a text prompt and generates corresponding audio using the ElevenLabs API. Also handles lipsync with an optional face model.
- **Parameters:**
  - `text_prompt` (string): Text input for audio generation.
  - `input_face` (optional, string): URL or identifier for a face model to sync with the audio.
  - `extra_prompt` (optional, string): Additional text to append to the main prompt.
  - `ai_personality` (string): Defines the AI's personality for the session.
  - `sessionId` (string): A unique identifier for the session to maintain state.
  - `characterName` (optional, string): Specifies the character voice to use.
- **Responses:**
  - 200 OK: Returns a JSON object with the generated text and audio URL.
  - 500 Internal Server Error: Returns an error if audio generation fails.

### 3. Change Character Voice (`/change-character`)
- **Method:** POST
- **Description:** Allows users to switch between different character voices stored in the `CHARACTER_VOICES` dictionary.
- **Parameters:**
  - `characterName` (string): The name of the character whose voice model is to be used.
- **Responses:**
  - 200 OK: Returns a success message with the new character name.
  - 400 Bad Request: Returns an error if the character name is not found.

## Audio and Video Retrieval

### 1. Retrieve Audio (`/audio/<audio_id>`)
- **Method:** GET
- **Description:** Serves the audio file corresponding to a given audio ID.
- **Parameters:**
  - `audio_id` (string): The identifier for the stored audio in memory.
- **Responses:**
  - 200 OK: Streams the audio content.
  - 404 Not Found: Returns an error if the audio file is not found.

### 2. Fetch Video (`/video`)
- **Method:** GET
- **Description:** Streams a video file from a specified URL.
- **Responses:**
  - 200 OK: Streams the video content.
  - 500 Internal Server Error: Returns an error if the video cannot be fetched.

## Rationale and Usage Tips

- **User Authentication APIs** are crucial for securing the application and ensuring that only registered and authenticated users can access certain functionalities.
- **Chat and Voice Interaction APIs** leverage external APIs to enhance the interactive capabilities of the application, providing a more engaging user experience.
- **Audio and Video APIs** ensure multimedia content is accessible to users, supporting a richer, multi-modal interaction pattern.

These APIs collectively form the backbone of the application, facilitating a secure, interactive, and responsive user experience.
# API Documentation for Flask Application

This section outlines the APIs developed as part of the Flask application, including detailed descriptions of endpoints, expected parameters, and their functionalities. These APIs interact with various external services and internal mechanisms to deliver a comprehensive user experience, ranging from user authentication to dynamic audio and text generation.

## User Authentication and Management

### 1. Registration API (`/register`)
- **Method:** GET | POST
- **Description:** Handles the user registration process. The GET method serves the registration form, while the POST method processes the registration data.
- **Parameters:**
  - `username` (string): The desired username.
  - `password` (string): The user's password.
- **Responses:**
  - 200 OK: Returns a success message upon successful registration.
  - 400 Bad Request: Returns an error if the username already exists or if there is any validation failure.

### 2. Login API (`/login`)
- **Method:** GET | POST
- **Description:** Manages user login. The GET method provides the login form, and the POST method validates user credentials.
- **Parameters:**
  - `username` (string): Registered username.
  - `password` (string): Corresponding password.
- **Responses:**
  - 200 OK: Redirects to the home page upon successful login.
  - 401 Unauthorized: Returns an error if credentials are incorrect.

### 3. Logout API (`/logout`)
- **Method:** POST
- **Description:** Logs out the current user and ends the session.
- **Responses:**
  - 302 Redirect: Redirects to the login page after successful logout.

## Chat and Voice Interaction

### 1. Fetch Chat History (`/get-history`)
- **Method:** GET
- **Description:** Retrieves the chat history for the authenticated user from the MongoDB database.
- **Responses:**
  - 200 OK: Returns the chat history as JSON.
  - 404 Not Found: Returns an error if no history is found.

### 2. Generate Audio API (`/generate-lipsync`)
- **Method:** POST
- **Description:** Takes a text prompt and generates corresponding audio using the ElevenLabs API. Also handles lipsync with an optional face model.
- **Parameters:**
  - `text_prompt` (string): Text input for audio generation.
  - `input_face` (optional, string): URL or identifier for a face model to sync with the audio.
  - `extra_prompt` (optional, string): Additional text to append to the main prompt.
  - `ai_personality` (string): Defines the AI's personality for the session.
  - `sessionId` (string): A unique identifier for the session to maintain state.
  - `characterName` (optional, string): Specifies the character voice to use.
- **Responses:**
  - 200 OK: Returns a JSON object with the generated text and audio URL.
  - 500 Internal Server Error: Returns an error if audio generation fails.

### 3. Change Character Voice (`/change-character`)
- **Method:** POST
- **Description:** Allows users to switch between different character voices stored in the `CHARACTER_VOICES` dictionary.
- **Parameters:**
  - `characterName` (string): The name of the character whose voice model is to be used.
- **Responses:**
  - 200 OK: Returns a success message with the new character name.
  - 400 Bad Request: Returns an error if the character name is not found.

## Audio and Video Retrieval

### 1. Retrieve Audio (`/audio/<audio_id>`)
- **Method:** GET
- **Description:** Serves the audio file corresponding to a given audio ID.
- **Parameters:**
  - `audio_id` (string): The identifier for the stored audio in memory.
- **Responses:**
  - 200 OK: Streams the audio content.
  - 404 Not Found: Returns an error if the audio file is not found.

### 2. Fetch Video (`/video`)
- **Method:** GET
- **Description:** Streams a video file from a specified URL.
- **Responses:**
  - 200 OK: Streams the video content.
  - 500 Internal Server Error: Returns an error if the video cannot be fetched.

## Rationale and Usage Tips

- **User Authentication APIs** are crucial for securing the application and ensuring that only registered and authenticated users can access certain functionalities.
- **Chat and Voice Interaction APIs** leverage external APIs to enhance the interactive capabilities of the application, providing a more engaging user experience.
- **Audio and Video APIs** ensure multimedia content is accessible to users, supporting a richer, multi-modal interaction pattern.

These APIs collectively form the backbone of the application, facilitating a secure, interactive, and responsive user experience.
