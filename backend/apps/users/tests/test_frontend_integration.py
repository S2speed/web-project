from datetime import date

from rest_framework import status
from rest_framework.test import APITestCase

from apps.music.models import Album, Artist, Song
from apps.users.models import CustomUser


class FrontendIntegrationContractTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.listener = CustomUser.objects.create_user(
            email='listener-ui@example.com', password='pass1234', display_name='Listener UI',
        )
        cls.admin = CustomUser.objects.create_user(
            email='admin-ui@example.com', password='pass1234', display_name='Admin UI', role='admin',
        )
        cls.artist_user = CustomUser.objects.create_user(
            email='artist-ui@example.com', password='pass1234', display_name='Artist UI', role='artist', is_verified=True,
        )
        cls.artist = Artist.objects.create(
            user=cls.artist_user,
            stage_name='Artist UI',
            is_verified=True,
            verification_status=Artist.VERIFICATION_APPROVED,
        )
        cls.album = Album.objects.create(
            artist=cls.artist, title='UI Album', release_date=date(2026, 8, 15),
        )
        cls.song = Song.objects.create(
            artist=cls.artist,
            title='UI Song',
            audio_file='songs/ui.mp3',
            duration=180,
            release_date=date(2026, 8, 15),
        )

    def test_public_profile_works_without_authentication(self):
        response = self.client.get(f'/api/users/profile/{self.listener.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['display_name'], 'Listener UI')

    def test_forgot_password_uses_a_non_enumerating_response(self):
        response = self.client.post('/api/users/forgot-password/', {'email': 'missing@example.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)

    def test_only_admin_can_list_users_for_the_dashboard(self):
        self.client.force_authenticate(self.listener)
        denied = self.client.get('/api/users/')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        allowed = self.client.get('/api/users/')
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertEqual(allowed.data['count'], 3)

    def test_artist_can_move_a_song_into_and_out_of_an_album(self):
        self.client.force_authenticate(self.artist_user)
        added = self.client.put(
            f'/api/music/songs/{self.song.id}/update/',
            {'album': self.album.id},
            format='json',
        )
        self.assertEqual(added.status_code, status.HTTP_200_OK)
        self.assertEqual(added.data['album'], self.album.id)
        self.assertFalse(added.data['is_single'])

        removed = self.client.put(
            f'/api/music/songs/{self.song.id}/update/',
            {'album': None},
            format='json',
        )
        self.assertEqual(removed.status_code, status.HTTP_200_OK)
        self.assertIsNone(removed.data['album'])
        self.assertTrue(removed.data['is_single'])
