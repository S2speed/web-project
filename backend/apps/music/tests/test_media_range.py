import shutil
import tempfile
from pathlib import Path

from django.test import RequestFactory, TestCase, override_settings

from config.media import serve_media


class MediaRangeResponseTests(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.media_root = tempfile.mkdtemp(prefix='music-range-tests-')
        cls.media_override = override_settings(MEDIA_ROOT=cls.media_root)
        cls.media_override.enable()
        super().setUpClass()
        songs_directory = Path(cls.media_root) / 'songs'
        songs_directory.mkdir(parents=True)
        (songs_directory / 'sample.mp3').write_bytes(b'0123456789')
        cls.request_factory = RequestFactory()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls.media_override.disable()
        shutil.rmtree(cls.media_root, ignore_errors=True)

    def test_full_media_response_advertises_byte_ranges(self):
        response = serve_media(self.request_factory.get('/media/songs/sample.mp3'), 'songs/sample.mp3')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Accept-Ranges'], 'bytes')
        self.assertEqual(response['Content-Length'], '10')
        self.assertEqual(b''.join(response.streaming_content), b'0123456789')

    def test_media_response_honors_requested_byte_range(self):
        request = self.request_factory.get('/media/songs/sample.mp3', HTTP_RANGE='bytes=2-5')
        response = serve_media(request, 'songs/sample.mp3')

        self.assertEqual(response.status_code, 206)
        self.assertEqual(response['Content-Range'], 'bytes 2-5/10')
        self.assertEqual(response['Content-Length'], '4')
        self.assertEqual(b''.join(response.streaming_content), b'2345')

    def test_media_response_rejects_unsatisfiable_range(self):
        request = self.request_factory.get('/media/songs/sample.mp3', HTTP_RANGE='bytes=20-30')
        response = serve_media(request, 'songs/sample.mp3')

        self.assertEqual(response.status_code, 416)
        self.assertEqual(response['Content-Range'], 'bytes */10')
