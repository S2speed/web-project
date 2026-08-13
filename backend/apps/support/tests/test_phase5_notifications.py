from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.support.models import Notification
from apps.support.services import create_notification
from apps.users.models import CustomUser, UserSettings


class Phase5NotificationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = CustomUser.objects.create_user(
            email='notifications@example.com', password='pass1234', display_name='Notifications User',
        )
        cls.other = CustomUser.objects.create_user(
            email='notifications-other@example.com', password='pass1234', display_name='Other User',
        )

    def setUp(self):
        self.client.force_authenticate(self.user)

    def notification(self, user=None, **kwargs):
        return Notification.objects.create(
            user=user or self.user,
            type=kwargs.pop('type', 'ticket'),
            title=kwargs.pop('title', 'Notice'),
            message=kwargs.pop('message', 'Message'),
            **kwargs,
        )

    def test_list_is_scoped_to_current_user_and_reports_unread_count(self):
        own = self.notification()
        self.notification(user=self.other)
        response = self.client.get('/api/support/notifications/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['id'] for item in response.data['results']], [own.id])
        self.assertEqual(response.data['unread_count'], 1)

    def test_list_can_filter_by_state_and_type(self):
        self.notification(type='ticket')
        read = self.notification(type='financial', is_read=True, read_at=timezone.now())
        response = self.client.get('/api/support/notifications/?state=read&type=financial')
        self.assertEqual([item['id'] for item in response.data['results']], [read.id])

    def test_invalid_filter_is_rejected(self):
        response = self.client.get('/api/support/notifications/?state=archived')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_mark_read_is_idempotent_and_sets_timestamp(self):
        notification = self.notification()
        first = self.client.patch(f'/api/support/notifications/{notification.id}/read/')
        second = self.client.patch(f'/api/support/notifications/{notification.id}/read/')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        notification.refresh_from_db()
        self.assertTrue(notification.is_read)
        self.assertIsNotNone(notification.read_at)

    def test_user_cannot_read_or_delete_another_users_notification(self):
        notification = self.notification(user=self.other)
        read = self.client.patch(f'/api/support/notifications/{notification.id}/read/')
        delete = self.client.delete(f'/api/support/notifications/{notification.id}/')
        self.assertEqual(read.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(delete.status_code, status.HTTP_404_NOT_FOUND)

    def test_mark_all_read_only_updates_unread_items_for_current_user(self):
        self.notification()
        self.notification()
        self.notification(is_read=True, read_at=timezone.now())
        self.notification(user=self.other)
        response = self.client.post('/api/support/notifications/read-all/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['updated_count'], 2)
        self.assertEqual(Notification.objects.filter(user=self.user, is_read=False).count(), 0)
        self.assertEqual(Notification.objects.filter(user=self.other, is_read=False).count(), 1)

    def test_user_can_delete_own_notification(self):
        notification = self.notification()
        response = self.client.delete(f'/api/support/notifications/{notification.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Notification.objects.filter(id=notification.id).exists())

    def test_in_app_preference_prevents_creation(self):
        UserSettings.objects.create(user=self.user, notification_in_app=False)
        result = create_notification(
            user=self.user, type='ticket', title='Hidden', message='Hidden',
        )
        self.assertIsNone(result)
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 0)

    def test_daily_limit_is_enforced(self):
        UserSettings.objects.create(user=self.user, notification_daily_limit=1)
        first = create_notification(user=self.user, type='ticket', title='One', message='One')
        second = create_notification(user=self.user, type='ticket', title='Two', message='Two')
        self.assertIsNotNone(first)
        self.assertIsNone(second)

    def test_dedupe_key_prevents_duplicate_notifications(self):
        first = create_notification(
            user=self.user, type='ticket', title='One', message='One', dedupe_key='same-event',
        )
        second = create_notification(
            user=self.user, type='ticket', title='Two', message='Two', dedupe_key='same-event',
        )
        self.assertEqual(first.id, second.id)
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 1)

    def test_subscription_expiry_warning_is_created_once(self):
        self.user.subscription = 'silver'
        self.user.subscription_expires_at = timezone.now() + timedelta(days=2)
        self.user.save(update_fields=['subscription', 'subscription_expires_at'])
        first = self.client.get('/api/support/notifications/')
        second = self.client.get('/api/support/notifications/')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(Notification.objects.filter(user=self.user, type='subscription').count(), 1)

    def test_distant_subscription_expiry_does_not_generate_warning(self):
        self.user.subscription = 'gold'
        self.user.subscription_expires_at = timezone.now() + timedelta(days=30)
        self.user.save(update_fields=['subscription', 'subscription_expires_at'])
        self.client.get('/api/support/notifications/')
        self.assertFalse(Notification.objects.filter(user=self.user, type='subscription').exists())
