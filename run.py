#!/usr/bin/env python3
"""
LumiNote Run Script
==================

This script provides a convenient way to start the LumiNote application
with various configuration options. It can be used to run the application
in different modes (development, production) and with custom settings.

Usage:
    python run.py [options]

Options:
    --host          Host address to bind to (default: 0.0.0.0)
    --port          Port number to listen on (default: 2429)
    --debug         Enable debug mode (default: False)
    --config        Configuration mode (development, production, testing)
    --help          Show this help message
"""

import sys
import argparse
import os
from app import app
from config import get_config, DevelopmentConfig, ProductionConfig, TestingConfig

def create_argument_parser():
    """
    Create and configure the argument parser for command line options.
    
    Returns:
        argparse.ArgumentParser: Configured argument parser
    """
    parser = argparse.ArgumentParser(
        description="LumiNote Voice-to-Text Transcription System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                           # Run with default settings
  %(prog)s --port 8080              # Run on port 8080
  %(prog)s --host 127.0.0.1         # Run on localhost only
  %(prog)s --debug                  # Run in debug mode
  %(prog)s --config production      # Run with production settings
        """
    )
    
    parser.add_argument(
        '--host',
        type=str,
        default=None,
        help='Host address to bind to (default: from config, usually 0.0.0.0)'
    )
    
    parser.add_argument(
        '--port',
        type=int,
        default=None,
        help='Port number to listen on (default: from config, usually 2429)'
    )
    
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Enable debug mode (default: False)'
    )
    
    parser.add_argument(
        '--config',
        type=str,
        choices=['development', 'production', 'testing'],
        default=None,
        help='Configuration mode (default: development)'
    )
    
    parser.add_argument(
        '--version',
        action='store_true',
        help='Show version information'
    )
    
    return parser

def main():
    """
    Main function to run the LumiNote application.
    
    Parses command line arguments and starts the Flask application
    with the specified configuration.
    """
    parser = create_argument_parser()
    args = parser.parse_args()
    
    # Show version and exit if requested
    if args.version:
        config = get_config(args.config)
        print(f"LumiNote Voice-to-Text System v{config.APP_VERSION}")
        print(f"Configuration: {config.APP_NAME}")
        print(f"Author: Rak X Dev.")
        return
    
    # Set environment variables based on command line arguments
    if args.config:
        os.environ['FLASK_ENV'] = args.config
    
    if args.debug:
        os.environ['DEBUG'] = 'True'
    
    # Get configuration
    config = get_config(args.config)
    
    # Override config with command line arguments if provided
    host = args.host if args.host is not None else config.HOST
    port = args.port if args.port is not None else config.PORT
    debug = args.debug if args.debug else config.DEBUG
    
    # Print startup information
    print(f"Starting LumiNote Voice-to-Text System v{config.APP_VERSION}")
    print(f"Configuration: {config.APP_NAME}")
    print(f"Host: {host}")
    print(f"Port: {port}")
    print(f"Debug Mode: {debug}")
    print(f"SSL Enabled: {config.SSL_ENABLED}")
    print(f"Log Level: {config.LOG_LEVEL}")
    print("-" * 50)
    
    # Validate configuration
    is_valid, errors = config.validate_config()
    if not is_valid:
        print("Configuration validation failed:")
        for error in errors:
            print(f"  - {error}")
        sys.exit(1)
    
    # Determine SSL context
    ssl_context = None
    if config.SSL_ENABLED:
        ssl_context = config.SSL_CONTEXT
    
    # Start the Flask application
    try:
        app.run(host=host, port=port, debug=debug, ssl_context=ssl_context)
    except KeyboardInterrupt:
        print("\nShutting down LumiNote server...")
        sys.exit(0)
    except Exception as e:
        print(f"Error starting LumiNote server: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
