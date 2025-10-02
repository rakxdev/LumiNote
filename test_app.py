"""
Unit tests for LumiNote Voice-to-Text Transcription System.

This test suite covers all major functionality of the application
including web interface loading, text push functionality, and
error handling scenarios.
"""

import unittest
import json
from app import app

class AppTestCase(unittest.TestCase):
    """
    Test case class for LumiNote application testing.
    
    Tests all major endpoints and functionality of the voice-to-text system.
    """
    
    def setUp(self):
        """
        Set up test client before each test method.
        """
        self.app = app.test_client()
        self.app.testing = True

    def test_index_route(self):
        """
        Test that the main index route returns 200 status.
        """
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)

    def test_health_check(self):
        """
        Test the health check endpoint returns proper JSON response.
        """
        response = self.app.get('/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('status', data)
        self.assertIn('timestamp', data)
        self.assertEqual(data['status'], 'healthy')

    def test_push_text_success(self):
        """
        Test successful text push functionality.
        """
        response = self.app.post(
            '/push_text',
            data=json.dumps({'text': 'hello world'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Text pushed successfully')

    def test_push_text_empty(self):
        """
        Test text push with empty text returns 400 error.
        """
        response = self.app.post(
            '/push_text',
            data=json.dumps({'text': ''}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['error'], 'No text provided')

    def test_push_text_no_data(self):
        """
        Test text push with no JSON data returns 400 error.
        """
        response = self.app.post(
            '/push_text',
            data='',
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['error'], 'No JSON data provided')

    def test_push_text_invalid_content_type(self):
        """
        Test text push with invalid content type returns 400 error.
        """
        response = self.app.post(
            '/push_text',
            data='hello world',
            content_type='text/plain'
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['error'], 'No JSON data provided')

    def test_transcribe_no_audio(self):
        """
        Test transcription endpoint with no audio data returns 400 error.
        """
        response = self.app.post('/transcribe')
        self.assertEqual(response.status_code, 400)
        self.assertIn(b'No audio data provided', response.data)

    def test_transcribe_empty_file(self):
        """
        Test transcription endpoint with empty file returns 400 error.
        """
        response = self.app.post(
            '/transcribe',
            data={'audio_data': (None, '')},
            content_type='multipart/form-data'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn(b'No audio file selected', response.data)

if __name__ == '__main__':
    unittest.main()
