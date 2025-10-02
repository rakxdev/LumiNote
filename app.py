"""
LumiNote - Advanced Voice-to-Text Transcription System
===================================================

A Flask-based web application that enables voice-to-text transcription
from mobile devices to desktop computers. The system uses speech recognition
to convert audio input into text, which is then automatically typed into
the active application on the desktop.

Features:
- Real-time voice transcription
- Mobile-friendly web interface
- Cross-device text transmission
- Secure local network communication
- Modern space-themed UI

Author: Rak X Dev.
License: MIT
"""

from flask import Flask, render_template, request, jsonify
import speech_recognition as sr
import pyautogui
from pydub import AudioSegment
import io
import logging
from datetime import datetime
from config import get_config

# Get configuration
config = get_config()

# Configure logging based on configuration
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format=config.LOG_FORMAT,
    handlers=[
        logging.FileHandler(config.LOG_FILE),
        logging.StreamHandler()
    ]
)

app = Flask(__name__)
app.config.from_object(config)

def setup_pyautogui():
    """
    Configure PyAutoGUI settings for optimal performance.
    
    Sets up fail-safe settings and typing speed to prevent
    accidental system interference during text insertion.
    """
    pyautogui.FAILSAFE = config.PYAUTOGUI_FAILSAFE  # Enable/disable fail-safe based on config
    pyautogui.PAUSE = config.PYAUTOGUI_PAUSE         # Set pause between actions based on config

def convert_audio_to_wav(audio_data):
    """
    Convert uploaded audio file to WAV format for speech recognition.
    
    Args:
        audio_data: File-like object containing audio data
        
    Returns:
        io.BytesIO: WAV format audio data ready for recognition
        
    Raises:
        Exception: If audio format conversion fails
    """
    try:
        # Load audio file using pydub (supports multiple formats)
        audio = AudioSegment.from_file(audio_data)
        
        # Create BytesIO buffer for WAV export
        wav_io = io.BytesIO()
        
        # Export as WAV format (required for speech recognition)
        # Apply configuration settings for audio processing
        audio.export(wav_io, format="wav", parameters=[
            "-ar", str(config.AUDIO_SAMPLE_RATE),
            "-ac", str(config.AUDIO_CHANNELS)
        ])
        
        # Reset buffer pointer to beginning
        wav_io.seek(0)
        
        return wav_io
    except Exception as e:
        logging.error(f"Audio conversion error: {str(e)}")
        raise

def transcribe_audio(wav_buffer):
    """
    Perform speech recognition on WAV audio data.
    
    Args:
        wav_buffer: BytesIO buffer containing WAV audio data
        
    Returns:
        str: Transcribed text or error message
        
    Raises:
        sr.UnknownValueError: If speech cannot be understood
        sr.RequestError: If recognition service request fails
    """
    try:
        # Initialize speech recognizer
        recognizer = sr.Recognizer()
        
        # Configure recognition settings from configuration
        recognizer.energy_threshold = config.SPEECH_ENERGY_THRESHOLD
        recognizer.dynamic_energy_threshold = config.SPEECH_DYNAMIC_THRESHOLD
        recognizer.pause_threshold = config.SPEECH_PHRASE_THRESHOLD
        
        # Load audio from buffer
        with sr.AudioFile(wav_buffer) as source:
            audio = recognizer.record(source)
        
        # Perform speech recognition using Google API
        text = recognizer.recognize_google(audio)
        
        logging.info(f"Successfully transcribed: {text[:50]}...")
        return text
        
    except sr.UnknownValueError:
        error_msg = "Could not understand audio"
        logging.warning(error_msg)
        return error_msg
    except sr.RequestError as e:
        error_msg = f"Could not request results from speech recognition service; {e}"
        logging.error(error_msg)
        return error_msg

@app.route('/')
def index():
    """
    Main route that serves the web interface.
    
    Returns:
        Rendered HTML template for the voice transcription interface
    """
    return render_template('index.html')

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """
    Handle audio transcription requests from the web interface.
    
    Expects a file upload named 'audio_data' containing audio in any format
    supported by pydub. Converts to WAV and performs speech recognition.
    
    Returns:
        str: Transcribed text or error message
    """
    try:
        # Get audio data from request
        if 'audio_data' not in request.files:
            error_msg = "No audio data provided"
            logging.error(error_msg)
            return error_msg, 400
        
        audio_data = request.files['audio_data']
        
        if audio_data.filename == '':
            error_msg = "No audio file selected"
            logging.error(error_msg)
            return error_msg, 400
        
        # Validate file format
        file_extension = audio_data.filename.split('.')[-1].lower()
        if file_extension not in config.SUPPORTED_AUDIO_FORMATS:
            error_msg = f"Unsupported audio format: {file_extension}. Supported formats: {config.SUPPORTED_AUDIO_FORMATS}"
            logging.error(error_msg)
            return error_msg, 400
        
        # Convert audio to WAV format for speech recognition
        wav_buffer = convert_audio_to_wav(audio_data)
        
        # Perform transcription
        transcribed_text = transcribe_audio(wav_buffer)
        
        # Only type the text if transcription was successful
        if not transcribed_text.startswith("Could not"):
            pyautogui.typewrite(transcribed_text)
            logging.info(f"Text successfully typed to active application: {transcribed_text[:30]}...")
        
        return transcribed_text
        
    except Exception as e:
        error_msg = f"Transcription error: {str(e)}"
        logging.error(error_msg)
        return error_msg, 500

@app.route('/push_text', methods=['POST'])
def push_text():
    """
    Handle manual text push requests from the web interface.
    
    Expects JSON data with a 'text' field containing the text to be typed.
    
    Returns:
        JSON response with success message or error details
    """
    try:
        # Get JSON data from request
        data = request.get_json()
        
        if not data:
            error_msg = "No JSON data provided"
            logging.error(error_msg)
            return jsonify({"error": error_msg}), 400
        
        text_to_push = data.get('text', '').strip()
        
        if not text_to_push:
            error_msg = "No text provided"
            logging.error(error_msg)
            return jsonify({"error": error_msg}), 400
        
        # Validate text length
        if len(text_to_push) > 10000:  # 10KB limit
            error_msg = "Text too long (maximum 10,000 characters)"
            logging.error(error_msg)
            return jsonify({"error": error_msg}), 400
        
        # Process text and handle line breaks appropriately
        lines = text_to_push.replace('\r\n', '\n').split('\n')
        
        for i, line in enumerate(lines):
            pyautogui.typewrite(line)
            # Use Shift+Enter for line breaks in applications that use Enter to submit
            if i < len(lines) - 1:
                pyautogui.hotkey('shift', 'enter')
        
        success_msg = "Text pushed successfully"
        logging.info(f"Text successfully pushed: {text_to_push[:50]}...")
        return jsonify({"message": success_msg})
        
    except Exception as e:
        error_msg = f"Text push error: {str(e)}"
        logging.error(error_msg)
        return jsonify({"error": error_msg}), 500

@app.route('/health')
def health():
    """
    Health check endpoint for monitoring application status.
    
    Returns:
        JSON response with health status and system information
    """
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": config.APP_NAME,
        "version": config.APP_VERSION,
        "host": config.HOST,
        "port": config.PORT
    })

@app.route('/config')
def get_config_endpoint():
    """
    Configuration endpoint for retrieving runtime configuration.
    
    Returns:
        JSON response with current configuration settings
    """
    return jsonify(config.get_config_summary())

if __name__ == '__main__':
    """
    Application entry point.
    
    Configures PyAutoGUI settings and starts the Flask development server
    with SSL enabled for secure communication.
    """
    # Setup PyAutoGUI with safety settings from configuration
    setup_pyautogui()
    
    # Validate configuration before starting
    is_valid, errors = config.validate_config()
    if not is_valid:
        logging.error("Configuration validation failed:")
        for error in errors:
            logging.error(f"  - {error}")
        exit(1)
    
    # Log configuration summary
    logging.info("LumiNote Configuration:")
    for key, value in config.get_config_summary().items():
        logging.info(f"  {key}: {value}")
    
    # Start the Flask application
    logging.info(f"Starting LumiNote server on {config.HOST}:{config.PORT}")
    
    ssl_context = None
    if config.SSL_ENABLED:
        ssl_context = config.SSL_CONTEXT
    
    app.run(host=config.HOST, port=config.PORT, ssl_context=ssl_context)
