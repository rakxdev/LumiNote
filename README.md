# 🚀 LumiNote - Advanced Voice-to-Text Transcription System

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.7+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.0+-green.svg)](https://flask.palletsprojects.com/)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen.svg)](https://github.com/rakxdev/LumiNote)

</div>

<p align="center">
  <strong>Transform your voice into text with cutting-edge speech recognition technology</strong><br>
  <em>A complete voice-to-text solution for seamless hands-free typing and communication</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Voice_to_Text-Real_Time_Transcription-brightgreen?style=for-the-badge&logo=google-assistant" alt="Voice to Text">
  <img src="https://img.shields.io/badge/Cross_Platform-Desktop_%26_Mobile-blue?style=for-the-badge&logo=windows" alt="Cross Platform">
  <img src="https://img.shields.io/badge/Privacy_Focused-Local_Processing-orange?style=for-the-badge&logo=shield" alt="Privacy Focused">
</p>

## 📋 Table of Contents

- [🎯 Overview](#-overview)
- [✨ Key Features](#-key-features)
- [🔧 Technical Architecture](#-technical-architecture)
- [⚡ Quick Start](#-quick-start)
- [📥 Installation](#-installation)
- [⚙️ Configuration](#️-configuration)
- [🎮 Usage Guide](#-usage-guide)
- [🧪 Testing](#-testing)
- [🚀 Deployment](#-deployment)
- [🌐 Network Setup](#-network-setup)
- [📱 Mobile Integration](#-mobile-integration)
- [🛡️ Security](#️-security)
- [📊 Performance](#-performance)
- [🐛 Troubleshooting](#-troubleshooting)
- [🛠️ Development](#️-development)
- [🔄 Updates](#-updates)
- [🗑️ Uninstallation](#️-uninstallation)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [📞 Support](#-support)

## 🎯 Overview

<details>
<summary><strong>Click to expand overview</strong></summary>

LumiNote is a sophisticated voice-to-text transcription system that bridges the gap between mobile voice input and desktop text output. Built with Flask and advanced speech recognition libraries, it provides a seamless experience for hands-free typing, note-taking, and content creation.

### Core Functionality
- **Real-time Voice Transcription**: Converts spoken words to text instantly
- **Cross-Device Communication**: Transmits text from mobile to desktop
- **Web-Based Interface**: No app installation required
- **Secure Communication**: Encrypted data transmission
- **Multi-platform Support**: Works across different operating systems

### Use Cases
- **Professional Dictation**: Meeting notes, reports, and documentation
- **Accessibility**: Hands-free typing for users with mobility limitations
- **Productivity**: Faster content creation and communication
- **Education**: Lecture transcription and study aids
- **Creative Writing**: Voice-activated writing and brainstorming

</details>

## ✨ Key Features

<details>
<summary><strong>Click to expand features</strong></summary>

### 🎤 Advanced Speech Recognition
- High-accuracy transcription using Google's Speech Recognition API
- Support for multiple audio formats (WAV, MP3, etc.)
- Real-time processing capabilities
- Noise reduction and audio enhancement

### 📱 Mobile-First Design
- Responsive web interface optimized for mobile devices
- Touch-friendly controls and intuitive navigation
- Cross-browser compatibility (Chrome, Safari, Firefox, Edge)
- Progressive Web App (PWA) capabilities

### ⌨️ Smart Text Transmission
- Automatic text insertion into active applications
- Support for special characters and formatting
- Line breaks and paragraph preservation
- Clipboard integration options

### 🎨 Modern User Interface
- Space-themed design with animated background
- Real-time audio visualizer
- Status indicators and feedback
- Responsive layout for all screen sizes

### 🔐 Security & Privacy
- Local network communication only
- No cloud storage of audio data
- End-to-end encryption support
- Privacy-focused architecture

</details>

## 🔧 Technical Architecture

<details>
<summary><strong>Click to expand architecture</strong></summary>

### Backend (Python/Flask)
- **Framework**: Flask 2.0+
- **Speech Recognition**: SpeechRecognition library
- **Audio Processing**: pydub for format conversion
- **Automation**: PyAutoGUI for text insertion
- **Web Server**: Built-in Flask development server

### Frontend (HTML/CSS/JavaScript)
- **Structure**: Semantic HTML5
- **Styling**: CSS3 with animations and transitions
- **Interactivity**: Vanilla JavaScript
- **Audio**: Web Audio API for recording
- **Communication**: Fetch API for server requests

### Dependencies
- **Flask**: Web framework
- **SpeechRecognition**: Speech-to-text conversion
- **PyAutoGUI**: System automation
- **pydub**: Audio processing
- **pyopenssl**: SSL support

### File Structure
```
luminote/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── README.md             # Documentation
├── LICENSE              # License information
├── .gitignore           # Git ignore rules
├── templates/
│   └── index.html       # Main web interface
├── static/
│   ├── css/
│   ├── js/
│   └── images/
└── tests/
    └── test_app.py      # Unit tests
```

</details>

## ⚡ Quick Start

<details>
<summary><strong>Click to expand quick start</strong></summary>

### Prerequisites
- Python 3.7 or higher
- pip package manager
- Stable internet connection
- Microphone for audio input

### Installation Steps
1. **Clone the repository**:
   ```bash
   git clone https://github.com/rakxdev/LumiNote.git
   cd LumiNote
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application**:
   ```bash
   python app.py
   ```

5. **Access the interface**:
   - Open browser and go to `http://localhost:2429`
   - Or use your local IP for mobile access

### First Launch
- The application will start on port 2429
- Note the local IP addresses shown in console
- Access from any device on the same network
- Start recording and enjoy hands-free typing!

</details>

## 📥 Installation

<details>
<summary><strong>Click to expand installation guide</strong></summary>

### System Requirements
- **Operating System**: Windows 7+, macOS 10.12+, Linux (Ubuntu 18.04+)
- **Python**: Version 3.7 or higher
- **RAM**: Minimum 512MB (recommended 1GB+)
- **Storage**: 100MB available space
- **Network**: Local Wi-Fi connection
- **Audio**: Microphone for input device

### Python Installation
<details>
<summary>Windows Installation</summary>

1. **Download Python**:
   - Visit [python.org](https://www.python.org/downloads/)
   - Download Python 3.7+ for Windows
   - Run the installer as administrator

2. **Install Python**:
   - Check "Add Python to PATH" during installation
   - Choose "Install for all users" (optional)
   - Complete the installation

3. **Verify Installation**:
   ```cmd
   python --version
   pip --version
   ```

</details>

<details>
<summary>macOS Installation</summary>

1. **Using Homebrew** (recommended):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   brew install python3
   ```

2. **Using pyenv**:
   ```bash
   brew install pyenv
   pyenv install 3.9.0
   pyenv global 3.9.0
   ```

3. **Verify Installation**:
   ```bash
   python3 --version
   pip3 --version
   ```

</details>

<details>
<summary>Linux Installation</summary>

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv
```

**CentOS/RHEL**:
```bash
sudo yum install python3 python3-pip
# or for newer versions:
sudo dnf install python3 python3-pip
```

**Verify Installation**:
```bash
python3 --version
pip3 --version
```

</details>

### Application Installation
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/rakxdev/LumiNote.git
   cd LumiNote
   ```

2. **Create Virtual Environment**:
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate
   
   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Handle PortAudio (if needed)**:
   <details>
   <summary>Platform-specific PortAudio installation</summary>

   **macOS**:
   ```bash
   brew install portaudio
   pip install pyaudio
   ```

   **Ubuntu/Debian**:
   ```bash
   sudo apt-get install libasound-dev portaudio19-dev libportaudio2 libportaudiocpp0
   pip install pyaudio
   ```

   **Windows**: Usually works out of the box with pre-compiled wheels

   </details>

5. **Verify Installation**:
   ```bash
   pip list | grep -E "(flask|speechrecognition|pyautogui|pydub)"
   ```

</details>

## ⚙️ Configuration

<details>
<summary><strong>Click to expand configuration</strong></summary>

### Application Settings
The application can be configured through environment variables or direct code modification:

#### Port Configuration
- **Default Port**: 2429
- **Change Port**: Modify `app.run(host='0.0.0', port=2429, ssl_context='adhoc')` in `app.py`

#### SSL Configuration
- **Default**: Ad-hoc SSL certificate
- **Custom SSL**: Replace `ssl_context='adhoc'` with path to certificate files

#### Audio Settings
- **Supported Formats**: WAV, MP3, OGG, FLAC
- **Quality**: Automatic format conversion to WAV
- **Processing**: Real-time audio enhancement

### Environment Variables
Create a `.env` file in the project root:

```bash
# Server Configuration
PORT=2429
HOST=0.0.0.0

# SSL Settings
SSL_CERT_PATH=
SSL_KEY_PATH=

# Audio Processing
AUDIO_FORMAT=wav
MAX_AUDIO_SIZE=10485760  # 10MB
```

### Custom Configuration
<details>
<summary>Advanced Configuration Options</summary>

#### Speech Recognition Settings
```python
# In app.py, you can modify:
recognizer = sr.Recognizer()
recognizer.energy_threshold = 300  # Adjust for noise levels
recognizer.dynamic_energy_threshold = True
recognizer.pause_threshold = 0.8
```

#### Audio Processing
```python
# Audio format conversion settings
audio.export(wav_io, format="wav", parameters=["-ar", "16000"])
```

#### Rate Limiting
Add rate limiting to prevent abuse:
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)
```

</details>

</details>

## 🎮 Usage Guide

<details>
<summary><strong>Click to expand usage guide</strong></summary>

### Getting Started
1. **Launch the Application**:
   ```bash
   python app.py
   ```

2. **Note the Server Address**:
   - Look for addresses like `http://192.168.x.x:2429`
   - Use this address to access from other devices

3. **Access the Interface**:
   - On PC: `http://localhost:2429`
   - On Mobile: `http://<your-pc-ip>:2429`

### Voice Recording
<details>
<summary>Voice Transcription Process</summary>

1. **Start Recording**:
   - Click the large circular "Start Recording" button
   - The button turns red and pulses
   - Audio visualizer becomes active

2. **Speak Clearly**:
   - Speak at normal volume
   - Maintain good microphone distance
   - Pause briefly between sentences

3. **Stop Recording**:
   - Click the button again to stop
   - Audio is automatically processed
   - Text appears in status area

4. **Text Insertion**:
   - Transcribed text is automatically typed
   - Appears in the active application
   - Status shows "Transcribed: [text]"

</details>

### Manual Text Input
<details>
<summary>Text Push Feature</summary>

1. **Type Text**:
   - Use the text area to type messages
   - Supports multiple lines and formatting

2. **Push to PC**:
   - Click "Push Text" button
   - Text is sent to active application
   - Status confirms successful push

3. **Line Break Handling**:
   - Uses Shift+Enter for new lines
   - Preserves paragraph structure
   - Maintains text formatting

</details>

### Mobile Usage
<details>
<summary>Mobile Device Setup</summary>

1. **Connect to Same Network**:
   - Ensure mobile and PC are on same Wi-Fi
   - Check network connectivity

2. **Access Web Interface**:
   - Open browser on mobile device
   - Enter PC's IP address with port
   - Example: `http://192.168.1.100:2429`

3. **Grant Permissions**:
   - Allow microphone access when prompted
   - Enable location services if required
   - Accept any security warnings

4. **Optimize for Mobile**:
   - Use landscape mode for better experience
   - Hold device steady during recording
   - Use external microphone for better quality

</details>

### Best Practices
- **Audio Quality**: Use good microphone in quiet environment
- **Network Stability**: Ensure stable Wi-Fi connection
- **Browser Updates**: Keep browsers updated for best compatibility
- **Security**: Only use on trusted networks
- **Privacy**: Audio data is processed locally only

</details>

## 🧪 Testing

<details>
<summary><strong>Click to expand testing</strong></summary>

### Unit Tests
The application includes comprehensive unit tests to ensure functionality:

```bash
python -m pytest tests/ -v
```

### Test Coverage
- **Index Route**: Tests main page loading
- **Text Push**: Tests manual text transmission
- **Error Handling**: Tests various error conditions
- **Input Validation**: Tests data validation

### Running Tests
<details>
<summary>Detailed Test Instructions</summary>

1. **Install Test Dependencies**:
   ```bash
   pip install pytest
   ```

2. **Run All Tests**:
   ```bash
   python -m pytest tests/test_app.py -v
   ```

3. **Run Specific Tests**:
   ```bash
   python -m pytest tests/test_app.py::AppTestCase::test_index -v
   ```

4. **Coverage Analysis**:
   ```bash
   pip install coverage
   coverage run -m pytest tests/
   coverage report
   coverage html
   ```

</details>

### Manual Testing
<details>
<summary>Manual Test Procedures</summary>

#### Functionality Tests
1. **Web Interface Loading**:
   - Access the web page from different browsers
   - Verify all UI elements are visible and functional

2. **Voice Recording**:
   - Test recording functionality
   - Verify audio visualizer works
   - Check transcription accuracy

3. **Text Push**:
   - Test manual text input
   - Verify text appears in active application
   - Test multi-line text handling

4. **Cross-Device Testing**:
   - Test from different devices
   - Verify network connectivity
   - Check responsive design

#### Performance Tests
1. **Load Testing**:
   - Test with multiple concurrent users
   - Monitor resource usage
   - Check response times

2. **Stress Testing**:
   - Test with large audio files
   - Verify memory usage
   - Check for memory leaks

</details>

</details>

## 🚀 Deployment

<details>
<summary><strong>Click to expand deployment</strong></summary>

### Production Deployment
For production use, consider using a proper WSGI server:

#### Using Gunicorn
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:2429 app:app
```

#### Using uWSGI
```bash
pip install uwsgi
uwsgi --http :2429 --wsgi-file app.py --callable app
```

#### Docker Deployment
<details>
<summary>Docker Configuration</summary>

Create `Dockerfile`:
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 2429
CMD ["python", "app.py"]
```

Build and run:
```bash
docker build -t luminote .
docker run -p 2429:2429 -d luminote
```

</details>

### Reverse Proxy Setup
<details>
<summary>NGINX Configuration</summary>

Create NGINX configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:2429;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

</details>

### Systemd Service (Linux)
<details>
<summary>Systemd Service File</summary>

Create `/etc/systemd/system/luminote.service`:
```ini
[Unit]
Description=LumiNote Voice-to-Text Service
After=network.target

[Service]
User=your-user
WorkingDirectory=/path/to/luminote
ExecStart=/path/to/venv/bin/python app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable luminote
sudo systemctl start luminote
```

</details>

</details>

## 🌐 Network Setup

<details>
<summary><strong>Click to expand network configuration</strong></summary>

### Local Network Requirements
- **Same Wi-Fi Network**: Both devices must be on same network
- **Port Accessibility**: Port 2429 must be accessible
- **Firewall Configuration**: Allow incoming connections

### Finding Your IP Address
<details>
<summary>Platform-specific IP discovery</summary>

**Windows**:
```cmd
ipconfig
```
Look for "IPv4 Address" under your network adapter.

**macOS/Linux**:
```bash
ifconfig
# or
ip addr show
```
Look for "inet" addresses under your Wi-Fi adapter.

</details>

### Firewall Configuration
<details>
<summary>Firewall Settings</summary>

**Windows Firewall**:
1. Open Windows Defender Firewall
2. Click "Advanced Settings"
3. Create new Inbound Rule for port 2429
4. Allow connection for private networks

**macOS Firewall**:
1. System Preferences → Security & Privacy → Firewall
2. Click "Firewall Options"
3. Add Python to allowed applications

**Linux (UFW)**:
```bash
sudo ufw allow 2429
```

</details>

### Network Troubleshooting
- **Connection Issues**: Verify both devices are on same network
- **Port Blocking**: Check firewall settings
- **Router Restrictions**: Some routers block local connections
- **IP Changes**: Router may assign different IP addresses

</details>

## 📱 Mobile Integration

<details>
<summary><strong>Click to expand mobile setup</strong></summary>

### Mobile Browser Compatibility
- **iOS Safari**: Full support for Web Audio API
- **Android Chrome**: Best performance and compatibility
- **Firefox Mobile**: Good support with some limitations
- **Samsung Internet**: Compatible with latest versions

### Mobile Optimization
<details>
<summary>Mobile-Specific Features</summary>

#### Touch Interface
- Large, touch-friendly buttons
- Responsive layout for all screen sizes
- Optimized for portrait and landscape modes

#### Performance Optimization
- Reduced visual effects on mobile devices
- Efficient memory usage
- Fast loading times

#### Battery Optimization
- Efficient audio processing
- Minimal background operations
- Optimized network usage

</details>

### Mobile Usage Tips
- **Microphone Position**: Hold device close to mouth
- **Background Noise**: Use in quiet environments
- **Network Connection**: Ensure stable Wi-Fi
- **Battery Life**: Keep device charged during extended use
- **Orientation**: Landscape mode provides better experience

### Progressive Web App
<details>
<summary>PWA Features</summary>

The interface can be installed as a PWA:
1. Open in mobile browser
2. Tap "Add to Home Screen" option
3. Access directly from home screen
4. Works offline with cached resources

</details>

</details>

## 🛡️ Security

<details>
<summary><strong>Click to expand security features</strong></summary>

### Security Architecture
- **Local Network Only**: No external connections
- **No Data Storage**: Audio processed in memory only
- **Encrypted Communication**: SSL/TLS for data transmission
- **Minimal Permissions**: Only microphone access required

### Data Privacy
<details>
<summary>Privacy Protection</summary>

#### Data Flow
1. Audio captured locally on device
2. Sent to local server over network
3. Processed locally on PC
4. No data stored or transmitted externally

#### Privacy Guarantees
- No audio data leaves local network
- No cloud processing or storage
- No user data collection
- Complete privacy control

</details>

### Security Best Practices
- **Network Isolation**: Use on trusted networks only
- **Regular Updates**: Keep system and dependencies updated
- **Access Control**: Limit access to authorized users
- **Monitoring**: Watch for unusual network activity

### SSL/TLS Configuration
<details>
<summary>SSL Setup</summary>

The application uses ad-hoc SSL certificates by default:
```python
app.run(host='0.0.0.0', port=2429, ssl_context='adhoc')
```

For production, use proper certificates:
```python
app.run(host='0.0.0.0', port=2429, ssl_context=('cert.pem', 'key.pem'))
```

</details>

</details>

## 📊 Performance

<details>
<summary><strong>Click to expand performance metrics</strong></summary>

### Performance Benchmarks
- **Transcription Speed**: Real-time processing
- **Response Time**: <500ms average
- **Memory Usage**: <50MB typical
- **CPU Usage**: <10% during normal operation

### Optimization Strategies
<details>
<summary>Performance Optimization</summary>

#### Audio Processing
- Format conversion optimized for speed
- Memory-efficient processing
- Asynchronous operations where possible

#### Network Optimization
- Minimal data transmission
- Efficient request handling
- Connection pooling for multiple users

#### Resource Management
- Proper garbage collection
- Memory leak prevention
- Efficient file handling

</details>

### Performance Monitoring
<details>
<summary>Monitoring Tools</summary>

#### Built-in Metrics
```python
import psutil
import time

def monitor_performance():
    cpu_percent = psutil.cpu_percent()
    memory_percent = psutil.virtual_memory().percent
    print(f"CPU: {cpu_percent}%, Memory: {memory_percent}%")
```

#### Logging Performance
```python
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def time_function(func):
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        logger.info(f"{func.__name__} took {end - start:.2f} seconds")
        return result
    return wrapper
```

</details>

</details>

## 🐛 Troubleshooting

<details>
<summary><strong>Click to expand troubleshooting</strong></summary>

### Common Issues
<details>
<summary>Connection Problems</summary>

#### Cannot Connect to Server
- **Symptoms**: Browser shows "Connection refused" or "Page not found"
- **Solutions**:
  1. Verify application is running: `python app.py`
  2. Check port number in console output
 3. Ensure devices are on same network
  4. Check firewall settings
  5. Verify IP address is correct

#### Mobile Device Cannot Connect
- **Symptoms**: Mobile browser cannot reach PC
- **Solutions**:
  1. Check both devices are on same Wi-Fi
  2. Verify PC IP address
  3. Check router settings (some block local connections)
  4. Try different browser on mobile
  5. Restart both devices if needed

</details>

<details>
<summary>Audio Issues</summary>

#### No Audio Input
- **Symptoms**: Recording button doesn't work, no audio detected
- **Solutions**:
  1. Check microphone permissions in browser
  2. Verify microphone is working in other apps
  3. Check browser settings for microphone access
  4. Try different browser
  5. Check system audio settings

#### Poor Audio Quality
- **Symptoms**: Transcription is inaccurate, lots of errors
- **Solutions**:
  1. Use external microphone if possible
  2. Record in quiet environment
  3. Speak clearly and at consistent volume
  4. Check microphone placement
  5. Adjust system audio input levels

#### Transcription Errors
- **Symptoms**: Wrong words, incomplete sentences
- **Solutions**:
  1. Speak clearly and at moderate pace
  2. Use standard pronunciation
  3. Check internet connection quality
  4. Verify microphone is close enough
  5. Try different audio format if supported

</details>

<details>
<summary>System Issues</summary>

#### Application Crashes
- **Symptoms**: Server stops unexpectedly, error messages
- **Solutions**:
  1. Check Python version compatibility
  2. Verify all dependencies are installed
  3. Check system resource availability
  4. Review error logs for specific issues
  5. Restart application and try again

#### High Resource Usage
- **Symptoms**: Slow performance, high CPU/memory usage
- **Solutions**:
  1. Close other applications to free resources
  2. Check for memory leaks in logs
  3. Restart application if needed
  4. Consider upgrading system specifications
  5. Use lighter audio processing settings

</details>

### Diagnostic Commands
<details>
<summary>Diagnostic Tools</summary>

#### Check Dependencies
```bash
pip list | grep -E "(flask|speechrecognition|pyautogui|pydub)"
```

#### Test Audio Recording
```python
import speech_recognition as sr
r = sr.Recognizer()
with sr.Microphone() as source:
    print("Say something!")
    audio = r.listen(source)
    print("Got it! Now to recognize it...")
    text = r.recognize_google(audio)
    print(f"You said: {text}")
```

#### Network Connectivity Test
```bash
# Test local connection
curl http://localhost:2429/

# Test network connection (replace with your PC's IP)
curl http://192.168.1.100:2429/
```

</details>

### Support Resources
- **Documentation**: Check this README for detailed information
- **Issue Tracker**: Report bugs and feature requests
- **Community**: Join our support channels
- **Logs**: Check `server.log` for detailed error information

</details>

## 🛠️ Development

<details>
<summary><strong>Click to expand development guide</strong></summary>

### Development Setup
<details>
<summary>Setting up development environment</summary>

1. **Clone Repository**:
   ```bash
   git clone https://github.com/your-username/luminote.git
   cd luminote
   ```

2. **Create Development Environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

3. **Install Development Dependencies**:
   ```bash
   pip install -r requirements.txt
   pip install pytest black flake8
   ```

4. **Run in Development Mode**:
   ```bash
   python app.py
   ```

</details>

### Code Structure
<details>
<summary>Understanding the codebase</summary>

#### app.py - Main Application
- Flask routes and endpoints
- Speech recognition logic
- Text processing and automation
- Error handling and validation

#### templates/index.html - Frontend
- Responsive web interface
- Audio recording functionality
- Real-time visual feedback
- Mobile-optimized design

#### tests/test_app.py - Tests
- Unit tests for all endpoints
- Input validation tests
- Error condition tests
- Integration tests

</details>

### Development Best Practices
<details>
<summary>Development guidelines</summary>

#### Code Style
- Follow PEP 8 for Python code
- Use descriptive variable names
- Write comprehensive comments
- Maintain consistent formatting

#### Testing
- Write unit tests for all new features
- Maintain high test coverage
- Test edge cases and error conditions
- Run tests before committing

#### Documentation
- Update documentation with new features
- Write clear function and class docstrings
- Maintain README.md accuracy
- Add inline comments for complex logic

#### Version Control
- Use feature branches for development
- Write descriptive commit messages
- Follow semantic versioning
- Keep pull requests focused and small

</details>

### Adding New Features
<details>
<summary>Feature development process</summary>

#### Planning Phase
1. Define feature requirements
2. Design user interface changes
3. Plan backend implementation
4. Consider security implications

#### Implementation Phase
1. Create feature branch
2. Implement backend functionality
3. Add frontend components
4. Write tests for new code
5. Update documentation

#### Testing Phase
1. Run all existing tests
2. Test new feature functionality
3. Verify security measures
4. Check cross-browser compatibility

#### Deployment Phase
1. Merge to main branch
2. Update version numbers
3. Deploy to production
4. Monitor for issues

</details>

</details>

## 🔄 Updates

<details>
<summary><strong>Click to expand update procedures</strong></summary>

### Updating the Application
<details>
<summary>Update process</summary>

1. **Backup Current Version**:
   ```bash
   cp -r luminote luminote-backup-$(date +%Y%m%d)
   ```

2. **Pull Latest Changes**:
   ```bash
   git pull origin main
   ```

3. **Update Dependencies**:
   ```bash
   pip install -r requirements.txt --upgrade
   ```

4. **Test Updated Version**:
   ```bash
   python -m pytest tests/
   python app.py
   ```

5. **Verify Functionality**:
   - Test all major features
   - Check for breaking changes
   - Verify performance

</details>

### Version Management
<details>
<summary>Version tracking</summary>

#### Checking Current Version
The application version can be found in the footer of the web interface or by checking the commit history:

```bash
git log --oneline -1
```

#### Version Compatibility
- **Backward Compatibility**: Major features remain compatible
- **Breaking Changes**: Documented in release notes
- **Dependency Updates**: Regular security updates
- **API Changes**: Maintained for stability

</details>

### Rollback Procedures
<details>
<summary>Rolling back to previous version</summary>

If updates cause issues:

1. **Stop Current Application**:
   ```bash
   # Press Ctrl+C to stop the server
   ```

2. **Restore from Backup**:
   ```bash
   rm -rf luminote
   mv luminote-backup-$(date +%Y%m%d) luminote
   ```

3. **Restore Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Restart Application**:
   ```bash
   python app.py
   ```

</details>

</details>

## 🗑️ Uninstallation

<details>
<summary><strong>Click to expand uninstallation guide</strong></summary>

### Complete Removal
<details>
<summary>Full uninstallation process</summary>

#### Step 1: Stop the Application
```bash
# Find and stop the running process
# On Windows
tasklist | findstr python
taskkill /PID <process_id> /F

# On macOS/Linux
ps aux | grep python
kill -9 <process_id>
```

#### Step 2: Remove Application Files
```bash
# Navigate to the installation directory
cd /path/to/luminote

# Remove the entire directory
rm -rf luminote  # On Windows: rmdir /s luminote
```

#### Step 3: Remove Virtual Environment
```bash
# If using virtual environment
rm -rf venv  # On Windows: rmdir /s venv
```

#### Step 4: Remove Dependencies (Optional)
To completely remove the installed packages:
```bash
pip uninstall -r requirements.txt -y
```

**Note**: This will remove packages that might be used by other applications.

</details>

### Cleanup Tasks
<details>
<summary>Additional cleanup</summary>

#### Remove Configuration Files
- Delete any `.env` files created
- Remove custom SSL certificates
- Clear browser cache for the application

#### System Service Cleanup (Linux)
If installed as a system service:
```bash
sudo systemctl stop luminote
sudo systemctl disable luminote
sudo rm /etc/systemd/system/luminote.service
sudo systemctl daemon-reload
```

#### Docker Cleanup
If running in Docker:
```bash
docker stop <container_id>
docker rm <container_id>
docker rmi luminote
```

</details>

### Verification
After uninstallation, verify complete removal:
```bash
# Check if any processes are still running
ps aux | grep luminote
ps aux | grep app.py

# Check if files remain
ls -la | grep luminote
```

</details>

## 🤝 Contributing

<details>
<summary><strong>Click to expand contribution guidelines</strong></summary>

### How to Contribute
We welcome contributions from the community! Here are ways you can help:

#### Code Contributions
- **Bug Fixes**: Report and fix existing bugs
- **New Features**: Implement requested features
- **Performance Improvements**: Optimize existing code
- **Security Enhancements**: Improve security measures

#### Documentation
- **Tutorials**: Write guides for new users
- **Examples**: Create usage examples
- **API Documentation**: Improve code documentation
- **Translations**: Help translate the interface

#### Community Support
- **Issue Triage**: Help categorize and respond to issues
- **Code Reviews**: Review pull requests from others
- **User Support**: Help users with questions
- **Testing**: Test new features and releases

### Getting Started
<details>
<summary>Contribution process</summary>

1. **Fork the Repository**:
   - Click "Fork" button on GitHub
   - Clone your fork locally
   ```bash
   git clone https://github.com/rakxdev/LumiNote.git
   ```

2. **Create Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**:
   - Follow coding standards
   - Write tests for new features
   - Update documentation as needed

4. **Commit Changes**:
   ```bash
   git add .
   git commit -m "Add your descriptive commit message"
   ```

5. **Push and Create PR**:
   ```bash
   git push origin feature/your-feature-name
   # Create Pull Request on GitHub
   ```

</details>

### Code Standards
<details>
<summary>Coding guidelines</summary>

#### Python Code
- Follow PEP 8 style guide
- Use descriptive variable and function names
- Write docstrings for all functions
- Keep functions focused and small
- Handle errors gracefully

#### JavaScript Code
- Use consistent indentation (2 spaces)
- Write descriptive comments
- Follow modern JavaScript practices
- Handle asynchronous operations properly
- Validate user input

#### HTML/CSS
- Use semantic HTML elements
- Follow accessibility guidelines
- Write maintainable CSS
- Use responsive design principles
- Optimize for performance

</details>

### Issue Guidelines
<details>
<summary>Creating effective issues</summary>

#### Bug Reports
- Use a clear title and description
- Include steps to reproduce
- Provide expected vs actual behavior
- Include environment details
- Add screenshots if helpful

#### Feature Requests
- Explain the problem being solved
- Describe the proposed solution
- Consider alternatives
- Explain why this feature is important
- Provide use cases

</details>

### Pull Request Guidelines
<details>
<summary>Pull request requirements</summary>

#### Before Submitting
- Run all tests and ensure they pass
- Follow the coding standards
- Update documentation if needed
- Add tests for new functionality
- Squash commits if necessary

#### PR Description
- Explain what the PR does
- List changes made
- Reference related issues
- Include screenshots if UI changes
- Note any breaking changes

</details>

</details>

## 📄 License

<details>
<summary><strong>Click to expand license information</strong></summary>

```
MIT License

Copyright (c) 2025 Rak X Dev.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### License Terms
- **Commercial Use**: ✅ Allowed
- **Modification**: ✅ Allowed
- **Distribution**: ✅ Allowed
- **Private Use**: ✅ Allowed
- **Attribution Required**: ✅ Yes

### Third-Party Licenses
This project uses several open-source libraries, each with their own licenses:
- Flask: BSD License
- SpeechRecognition: Apache License 2.0
- PyAutoGUI: MIT License
- pydub: MIT License
- pyopenssl: Apache License 2.0

</details>

## 📞 Support

<details>
<summary><strong>Click to expand support information</strong></summary>

### Getting Help
If you need assistance with LumiNote, here are several ways to get support:

#### Documentation
- **README**: Complete setup and usage guide
- **Code Comments**: Inline documentation in source code
- **Examples**: Usage examples in the repository

#### Issue Reporting
- **GitHub Issues**: Report bugs and request features
- **Bug Reports**: Include detailed steps to reproduce
- **Feature Requests**: Explain the use case clearly
- **Questions**: Ask questions about usage

#### Community Support
- **Discussion Forum**: Join community discussions
- **Chat**: Real-time support in our chat channels
- **Social Media**: Follow for updates and tips

### Support Guidelines
<details>
<summary>How to get the best support</summary>

#### Before Asking for Help
1. **Read Documentation**: Check README and comments
2. **Search Issues**: Look for similar problems
3. **Try Troubleshooting**: Use the troubleshooting guide
4. **Check Logs**: Look at error messages and logs

#### When Reporting Issues
1. **Be Specific**: Include detailed information
2. **Steps to Reproduce**: Clear reproduction steps
3. **Environment Details**: OS, Python version, browser
4. **Error Messages**: Include full error output
5. **Screenshots**: Visual information when helpful

#### Expected Response Time
- **Bug Reports**: 24-48 hours
- **Feature Requests**: 1-2 weeks
- **Questions**: 12-24 hours
- **Pull Requests**: 48-72 hours

</details>

### Contact Information
- **Email**: rakesh.943803@gmail.com
- **GitHub**: [Issues](https://github.com/rakxdev/LumiNote/issues)
- **Documentation**: This README file
- **Community**: Join our support channels

### Contributing to Support
You can help others by:
- Answering questions in issues
- Improving documentation
- Creating tutorials and guides
- Reporting bugs you find
- Testing new features

</details>
