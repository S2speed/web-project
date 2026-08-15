import shutil
import tempfile
from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.music.models import Artist, Song
from apps.users.models import CustomUser


class SongAudioQualityTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        cls.media_root = tempfile.mkdtemp(prefix='music-quality-tests-')
        cls.media_override = override_settings(MEDIA_ROOT=cls.media_root)
        cls.media_override.enable()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls.media_override.disable()
        shutil.rmtree(cls.media_root, ignore_errors=True)

    @classmethod
    def setUpTestData(cls):
        cls.artist_user = CustomUser.objects.create_user(
            email='quality-artist@example.com',
            password='pass1234',
            display_name='Quality Artist',
            role='artist',
            is_verified=True,
        )
        cls.artist = Artist.objects.create(
            user=cls.artist_user,
            stage_name='Quality Artist',
            is_verified=True,
            verification_status=Artist.VERIFICATION_APPROVED,
        )
        cls.legacy_song = Song.objects.create(
            title='Legacy High Only',
            artist=cls.artist,
            audio_file='songs/legacy-high.mp3',
            duration=180,
            release_date=date(2026, 8, 15),
        )
        cls.multi_quality_song = Song.objects.create(
            title='Two Qualities',
            artist=cls.artist,
            audio_file='songs/song-high.mp3',
            audio_file_low='songs/low/song-low.mp3',
            duration=180,
            release_date=date(2026, 8, 15),
        )

    def setUp(self):
        self.client.force_authenticate(self.artist_user)

    @staticmethod
    def audio(name, content):
        return SimpleUploadedFile(name, content, content_type='audio/mpeg')

    def test_song_response_exposes_distinct_low_and_high_sources(self):
        response = self.client.get(f'/api/music/songs/{self.multi_quality_song.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['available_qualities'], ['low', 'high'])
        self.assertEqual(response.data['default_quality'], 'high')
        self.assertTrue(response.data['audio_sources']['low'].endswith('/media/songs/low/song-low.mp3'))
        self.assertTrue(response.data['audio_sources']['high'].endswith('/media/songs/song-high.mp3'))
        self.assertNotEqual(response.data['audio_sources']['low'], response.data['audio_sources']['high'])

    def test_legacy_song_reports_only_its_real_available_quality(self):
        response = self.client.get(f'/api/music/songs/{self.legacy_song.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['available_qualities'], ['high'])
        self.assertNotIn('low', response.data['audio_sources'])

    def test_new_song_upload_requires_low_quality_file(self):
        response = self.client.post('/api/music/songs/create/', {
            'title': 'Missing Low',
            'audio_file': self.audio('missing-low-high.mp3', b'high-quality-audio'),
            'duration': 180,
            'release_date': '2026-08-15',
            'is_single': True,
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('audio_file_low', response.data)

    def test_artist_can_upload_both_quality_files(self):
        response = self.client.post('/api/music/songs/create/', {
            'title': 'New Multi Quality Song',
            'audio_file': self.audio('new-high.mp3', b'high-quality-audio'),
            'audio_file_low': self.audio('new-low.mp3', b'low-quality-audio'),
            'duration': 180,
            'release_date': '2026-08-15',
            'is_single': True,
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['available_qualities'], ['low', 'high'])
        self.assertNotEqual(response.data['audio_sources']['low'], response.data['audio_sources']['high'])
        song = Song.objects.get(id=response.data['id'])
        self.assertTrue(song.audio_file.name.startswith('songs/'))
        self.assertTrue(song.audio_file_low.name.startswith('songs/low/'))

    def test_artist_can_replace_a_quality_file(self):
        response = self.client.put(
            f'/api/music/songs/{self.multi_quality_song.id}/update/',
            {'audio_file_low': self.audio('replacement-low.mp3', b'replacement-low-audio')},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['audio_sources']['low'].endswith('/media/songs/low/replacement-low.mp3'))
        self.multi_quality_song.refresh_from_db()
        self.assertTrue(self.multi_quality_song.audio_file_low.name.endswith('replacement-low.mp3'))

    def test_artist_detail_brief_songs_include_quality_metadata(self):
        response = self.client.get(f'/api/music/artists/{self.artist.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        song = next(item for item in response.data['singles'] if item['id'] == self.multi_quality_song.id)
        self.assertEqual(song['available_qualities'], ['low', 'high'])
