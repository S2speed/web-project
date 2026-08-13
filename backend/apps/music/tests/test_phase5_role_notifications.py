from datetime import date

from rest_framework import status
from rest_framework.test import APITestCase

from apps.music.models import Artist, Song
from apps.support.models import Notification
from apps.support.services import notify_new_release
from apps.users.models import CustomUser, UserSettings


class Phase5RoleNotificationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = CustomUser.objects.create_user(
            email='phase5-admin@example.com', password='pass1234', display_name='Admin', role='admin',
        )
        cls.support = CustomUser.objects.create_user(
            email='phase5-support@example.com', password='pass1234', display_name='Support', role='support',
        )
        cls.artist_user = CustomUser.objects.create_user(
            email='phase5-artist@example.com', password='pass1234', display_name='Artist', role='artist',
        )
        cls.artist = Artist.objects.create(
            user=cls.artist_user,
            stage_name='Phase Five Artist',
            is_verified=True,
            verification_status=Artist.VERIFICATION_APPROVED,
        )
        cls.follower = CustomUser.objects.create_user(
            email='phase5-follower@example.com', password='pass1234', display_name='Follower',
        )
        cls.other = CustomUser.objects.create_user(
            email='phase5-non-follower@example.com', password='pass1234', display_name='Not Following',
        )

    def create_song(self, suffix='one'):
        return Song.objects.create(
            title=f'Release {suffix}',
            artist=self.artist,
            audio_file=f'songs/release-{suffix}.mp3',
            duration=180,
            release_date=date(2026, 8, 1),
        )

    def test_artist_registration_notifies_admin_and_support(self):
        response = self.client.post('/api/users/register/artist/', {
            'email': 'new-phase5-artist@example.com',
            'display_name': 'New Artist',
            'password': 'pass1234',
            'confirm_password': 'pass1234',
            'artist_name': 'New Stage',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        recipients = set(Notification.objects.filter(
            type='verification', title='New artist verification request',
        ).values_list('user_id', flat=True))
        self.assertEqual(recipients, {self.admin.id, self.support.id})

    def test_new_release_notifies_followers_but_not_other_users(self):
        self.artist.user.followers.add(self.follower)
        song = self.create_song('followers')
        notify_new_release(song)
        self.assertTrue(Notification.objects.filter(user=self.follower, type='new_release').exists())
        self.assertFalse(Notification.objects.filter(user=self.other, type='new_release').exists())

    def test_artist_profile_followers_are_also_notified(self):
        self.artist.followers.add(self.follower)
        song = self.create_song('profile-followers')
        notification = notify_new_release(song)[0]
        self.assertEqual(notification.user, self.follower)
        self.assertEqual(notification.link, f'/songs/{song.id}')

    def test_new_release_respects_preferences_and_is_deduplicated(self):
        self.artist.user.followers.add(self.follower, self.other)
        UserSettings.objects.create(user=self.other, notification_in_app=False)
        song = self.create_song('preferences')
        notify_new_release(song)
        notify_new_release(song)
        self.assertEqual(Notification.objects.filter(user=self.follower, type='new_release').count(), 1)
        self.assertFalse(Notification.objects.filter(user=self.other, type='new_release').exists())
