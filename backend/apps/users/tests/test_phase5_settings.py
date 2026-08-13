from rest_framework import status
from rest_framework.test import APITestCase

from apps.music.models import Playlist
from apps.users.models import CustomUser, UserSettings


class Phase5SettingsTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = CustomUser.objects.create_user(
            email='settings@example.com', password='pass1234', display_name='Settings User',
        )
        cls.other = CustomUser.objects.create_user(
            email='settings-other@example.com', password='pass1234', display_name='Other User',
        )

    def setUp(self):
        self.client.force_authenticate(self.user)

    def test_settings_require_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/users/settings/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_settings_endpoint_creates_documented_defaults(self):
        response = self.client.get('/api/users/settings/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['language'], 'fa')
        self.assertTrue(response.data['app_sound'])
        self.assertEqual(response.data['notification_settings']['daily_limit'], 10)
        self.assertEqual(response.data['subscription']['type'], 'free')
        self.assertTrue(UserSettings.objects.filter(user=self.user).exists())

    def test_partial_update_is_persisted_and_mirrored_for_legacy_clients(self):
        payload = {
            'notification_settings': {'in_app': False, 'daily_limit': 4},
            'app_sound': False,
            'language': 'en',
        }
        response = self.client.patch('/api/users/settings/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        settings_obj = UserSettings.objects.get(user=self.user)
        self.assertFalse(settings_obj.notification_in_app)
        self.assertEqual(settings_obj.notification_daily_limit, 4)
        self.assertEqual(settings_obj.language, 'en')
        self.user.refresh_from_db()
        self.assertEqual(self.user.notification_settings['dailyLimit'], 4)

    def test_invalid_language_is_rejected(self):
        response = self.client.patch('/api/users/settings/', {'language': 'de'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_daily_limit_must_be_between_zero_and_fifty(self):
        response = self.client.patch(
            '/api/users/settings/',
            {'notification_settings': {'daily_limit': 51}},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_each_user_has_independent_settings(self):
        self.client.patch('/api/users/settings/', {'language': 'en'}, format='json')
        self.client.force_authenticate(self.other)
        response = self.client.get('/api/users/settings/')
        self.assertEqual(response.data['language'], 'fa')

    def test_account_delete_rejects_wrong_password(self):
        response = self.client.delete(
            '/api/users/settings/account/',
            {'password': 'wrong-pass', 'confirmation': 'حذف حساب'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(CustomUser.objects.filter(id=self.user.id).exists())

    def test_account_delete_rejects_wrong_confirmation_phrase(self):
        response = self.client.delete(
            '/api/users/settings/account/',
            {'password': 'pass1234', 'confirmation': 'delete'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_account_delete_removes_user_and_owned_data(self):
        Playlist.objects.create(user=self.user, name='Private data')
        response = self.client.delete(
            '/api/users/settings/account/',
            {'password': 'pass1234', 'confirmation': 'حذف حساب'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CustomUser.objects.filter(id=self.user.id).exists())
        self.assertFalse(Playlist.objects.filter(user_id=self.user.id).exists())
