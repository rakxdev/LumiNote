# LumiNote API Documentation

## Overview

LumiNote provides a RESTful API for voice-to-text transcription and text transmission. The API is designed to be simple and intuitive, allowing for easy integration with mobile and desktop applications.

## Base URL

The base URL for all API endpoints is `https://<your-server-ip>:2429` (or `http://<your-server-ip>:2429` if SSL is disabled).

## Authentication

The API does not require authentication for basic functionality. All endpoints are accessible without API keys or tokens, as the application is designed to run on local networks for security purposes.

## Endpoints

### GET /

**Description**: Returns the main web interface for the voice-to-text application.

**Response**:
- `200 OK`: HTML page with the voice-to-text interface

### POST /transcribe

**Description**: Transcribes audio data to text and automatically types it to the active application.

**Request**:
- **Content-Type**: `multipart/form-data`
- **Body**: 
  - `audio_data`: Audio file (WAV, MP3, OGG, FLAC, M4A, AAC)

**Response**:
- `200 OK`: Transcribed text as plain text
- `400 Bad Request`: Error message if no audio data provided
- `500 Internal Server Error`: Server error during transcription

**Example Request**:
```bash
curl -X POST \
  -F "audio_data=@recording.wav" \
  https://localhost:2429/transcribe
```

### POST /push_text

**Description**: Sends text to be typed into the active application.

**Request**:
- **Content-Type**: `application/json`
- **Body**:
  ```json
  {
    "text": "Text to be pushed to the active application"
  }
  ```

**Response**:
- `200 OK`: Success response with message
  ```json
  {
    "message": "Text pushed successfully"
  }
  ```
- `400 Bad Request`: Error response if no text provided
  ```json
  {
    "error": "No text provided"
  }
 ```

**Example Request**:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, World!"}' \
  https://localhost:2429/push_text
```

### GET /health

**Description**: Health check endpoint to verify the application is running.

**Response**:
- `200 OK`: Health status information
 ```json
  {
    "status": "healthy",
    "timestamp": "2025-01-15T10:30:00.123456",
    "service": "LumiNote Voice-to-Text",
    "version": "1.0",
    "host": "0.0.0.0",
    "port": 2429
  }
  ```

**Example Request**:
```bash
curl https://localhost:2429/health
```

### GET /config

**Description**: Returns current runtime configuration.

**Response**:
- `200 OK`: Configuration information
  ```json
  {
    "app_name": "LumiNote Voice-to-Text",
    "app_version": "1.0",
    "host": "0.0.0.0",
    "port": 2429,
    "debug": false,
    "ssl_enabled": true,
    "max_content_length": 16777216,
    "supported_audio_formats": ["wav", "mp3", "ogg", "flac", "m4a", "aac"],
    "log_level": "INFO",
    "log_file": "server.log"
  }
  ```

**Example Request**:
```bash
curl https://localhost:2429/config
```

## Error Responses

All error responses follow a consistent format:

```json
{
  "error": "Error message describing the issue"
}
```

### Common Error Codes

- `400 Bad Request`: Invalid request format or missing required fields
- `404 Not Found`: Requested endpoint does not exist
- `413 Request Entity Too Large`: Audio file exceeds maximum size limit
- `415 Unsupported Media Type`: Audio format is not supported
- `500 Internal Server Error`: Server-side error occurred

## Audio Format Support

The application supports the following audio formats:
- WAV (recommended for best quality)
- MP3
- OGG
- FLAC
- M4A
- AAC

Maximum file size: 16MB (configurable)

## Security Considerations

- The application uses SSL/TLS encryption by default
- Designed to run on local networks only
- No external API calls or cloud storage
- Audio data is processed locally and not stored
- PyAutoGUI fail-safe enabled (move mouse to corner to abort)

## Rate Limiting

The application includes built-in rate limiting:
- 200 requests per day
- 50 requests per hour

(Configurable in production environments)

## CORS Policy

The application allows requests from all origins (`*`) by default, as it's designed for local network use.

## Testing the API

### Using curl

```bash
# Health check
curl -k https://localhost:2429/health

# Push text
curl -k -X POST \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from API"}' \
  https://localhost:2429/push_text

# Get configuration
curl -k https://localhost:2429/config
```

### Using Python requests

```python
import requests

# Health check
response = requests.get('https://localhost:2429/health', verify=False)
print(response.json())

# Push text
data = {'text': 'Hello from Python'}
response = requests.post('https://localhost:2429/push_text', json=data, verify=False)
print(response.json())
```

## Troubleshooting

### Common Issues

1. **SSL Certificate Warnings**: Use `-k` flag with curl or `verify=False` with requests library
2. **Audio Format Not Supported**: Convert to WAV format for best results
3. **Permission Errors**: Ensure the application has permission to access the microphone and type text
4. **Connection Refused**: Verify the server is running and accessible on the network

### Logging

The application logs to `server.log` with the following levels:
- `INFO`: General operation information
- `WARNING`: Non-critical issues
- `ERROR`: Errors that occurred
- `DEBUG`: Detailed debugging information (when enabled)

## Versioning

The application follows semantic versioning (MAJOR.MINOR.PATCH):
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes (backward compatible)

Current version: 1.0.0
