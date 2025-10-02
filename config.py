"""
LumiNote Configuration File
==========================

This configuration file contains all the configurable parameters for the
LumiNote voice-to-text transcription system. These settings can be adjusted
to customize the application behavior, security settings, and performance
parameters.

Configuration can be loaded from environment variables, a .env file, or
directly from this file. The order of precedence is:
1. Environment variables
2. .env file
3. Default values in this file
"""

import os
from datetime import datetime

class Config:
    """
    Base configuration class with default settings.
    
    Contains all configurable parameters for the LumiNote application.
    """
    
    # Application Settings
    APP_NAME = os.environ.get('APP_NAME', 'LumiNote Voice-to-Text')
    APP_VERSION = os.environ.get('APP_VERSION', '1.0')
    APP_DESCRIPTION = os.environ.get('APP_DESCRIPTION', 
                                   'Advanced Voice-to-Text Transcription System')
    
    # Server Configuration
    HOST = os.environ.get('HOST', '0.0.0.0')
    PORT = int(os.environ.get('PORT', 2429))
    DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    # SSL Configuration
    SSL_ENABLED = os.environ.get('SSL_ENABLED', 'True').lower() == 'true'
    SSL_CONTEXT = os.environ.get('SSL_CONTEXT', 'adhoc')  # 'adhoc', 'None', or path to cert files
    
    # Security Settings
    SECRET_KEY = os.environ.get('SECRET_KEY', 
                               os.urandom(24).hex())  # Generate random secret key
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))  # 16MB max file size
    
    # Audio Processing Settings
    AUDIO_FORMAT = os.environ.get('AUDIO_FORMAT', 'wav')
    SUPPORTED_AUDIO_FORMATS = ['wav', 'mp3', 'ogg', 'flac', 'm4a', 'aac']
    AUDIO_SAMPLE_RATE = int(os.environ.get('AUDIO_SAMPLE_RATE', 16000))  # Hz
    AUDIO_CHANNELS = int(os.environ.get('AUDIO_CHANNELS', 1))  # Mono
    
    # Speech Recognition Settings
    SPEECH_ENERGY_THRESHOLD = int(os.environ.get('SPEECH_ENERGY_THRESHOLD', 300))
    SPEECH_DYNAMIC_THRESHOLD = os.environ.get('SPEECH_DYNAMIC_THRESHOLD', 'True').lower() == 'true'
    SPEECH_PHRASE_THRESHOLD = float(os.environ.get('SPEECH_PHRASE_THRESHOLD', 0.3))
    SPEECH_TIMEOUT = os.environ.get('SPEECH_TIMEOUT', None)  # None means no timeout
    SPEECH_PHRASE_TIME_LIMIT = os.environ.get('SPEECH_PHRASE_TIME_LIMIT', None)  # None means no limit
    
    # PyAutoGUI Settings
    PYAUTOGUI_PAUSE = float(os.environ.get('PYAUTOGUI_PAUSE', 0.01))  # Seconds between actions
    PYAUTOGUI_FAILSAFE = os.environ.get('PYAUTOGUI_FAILSAFE', 'True').lower() == 'true'
    
    # Logging Configuration
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    LOG_FILE = os.environ.get('LOG_FILE', 'server.log')
    LOG_FORMAT = os.environ.get('LOG_FORMAT', 
                              '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # Rate Limiting (if implemented)
    RATELIMIT_STORAGE_URL = os.environ.get('RATELIMIT_STORAGE_URL', 'memory://')
    RATELIMIT_DEFAULT = os.environ.get('RATELIMIT_DEFAULT', '200 per day, 50 per hour')
    
    # Session Configuration
    PERMANENT_SESSION_LIFETIME = int(os.environ.get('PERMANENT_SESSION_LIFETIME', 3600))  # 1 hour
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'True').lower() == 'true'
    SESSION_COOKIE_HTTPONLY = os.environ.get('SESSION_COOKIE_HTTPONLY', 'True').lower() == 'true'
    SESSION_COOKIE_SAMESITE = os.environ.get('SESSION_COOKIE_SAMESITE', 'Lax')
    
    # CORS Settings (if Flask-CORS is used)
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')
    CORS_METHODS = os.environ.get('CORS_METHODS', 'GET,POST,PUT,DELETE,OPTIONS')
    CORS_HEADERS = os.environ.get('CORS_HEADERS', 'Content-Type,Authorization')
    
    @classmethod
    def get_config_summary(cls):
        """
        Get a summary of the current configuration settings.
        
        Returns:
            dict: Dictionary containing key configuration settings
        """
        return {
            'app_name': cls.APP_NAME,
            'app_version': cls.APP_VERSION,
            'host': cls.HOST,
            'port': cls.PORT,
            'debug': cls.DEBUG,
            'ssl_enabled': cls.SSL_ENABLED,
            'max_content_length': cls.MAX_CONTENT_LENGTH,
            'supported_audio_formats': cls.SUPPORTED_AUDIO_FORMATS,
            'log_level': cls.LOG_LEVEL,
            'log_file': cls.LOG_FILE
        }
    
    @classmethod
    def validate_config(cls):
        """
        Validate the configuration settings.
        
        Returns:
            tuple: (is_valid: bool, errors: list)
        """
        errors = []
        
        # Validate port range
        if not (1 <= cls.PORT <= 65535):
            errors.append(f"Port must be between 1 and 65535, got {cls.PORT}")
        
        # Validate audio sample rate
        if cls.AUDIO_SAMPLE_RATE <= 0:
            errors.append(f"Audio sample rate must be positive, got {cls.AUDIO_SAMPLE_RATE}")
        
        # Validate audio channels
        if cls.AUDIO_CHANNELS not in [1, 2]:
            errors.append(f"Audio channels must be 1 (mono) or 2 (stereo), got {cls.AUDIO_CHANNELS}")
        
        # Validate supported audio formats
        if not cls.SUPPORTED_AUDIO_FORMATS:
            errors.append("At least one audio format must be supported")
        
        # Validate log level
        valid_log_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        if cls.LOG_LEVEL not in valid_log_levels:
            errors.append(f"Log level must be one of {valid_log_levels}, got {cls.LOG_LEVEL}")
        
        return len(errors) == 0, errors

class DevelopmentConfig(Config):
    """
    Development environment configuration.
    """
    DEBUG = True
    LOG_LEVEL = 'DEBUG'
    SSL_ENABLED = False  # Disable SSL for development

class ProductionConfig(Config):
    """
    Production environment configuration.
    """
    DEBUG = False
    LOG_LEVEL = 'INFO'
    SSL_ENABLED = True
    SECRET_KEY = os.environ.get('SECRET_KEY')  # Must be set in production

class TestingConfig(Config):
    """
    Testing environment configuration.
    """
    DEBUG = True
    TESTING = True
    SSL_ENABLED = False
    LOG_LEVEL = 'WARNING'  # Reduce logging during tests

# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

def get_config(config_name=None):
    """
    Get the appropriate configuration class.
    
    Args:
        config_name (str): Configuration name ('development', 'production', 'testing')
        
    Returns:
        Config: Configuration class instance
    """
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')
    
    return config.get(config_name, config['default'])

# Validate configuration on import
config_instance = get_config()
is_valid, validation_errors = config_instance.validate_config()

if not is_valid:
    print("Configuration validation errors:")
    for error in validation_errors:
        print(f"  - {error}")
    raise ValueError("Invalid configuration settings")
