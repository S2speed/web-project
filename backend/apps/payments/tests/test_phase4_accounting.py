from datetime import date
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.music.models import Artist, Song, StreamEvent
from apps.payments.models import ArtistMonthlyStatement, SubscriptionPrice, Transaction
from apps.support.models import Notification
from apps.users.models import CustomUser


class Phase4AccountingTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = CustomUser.objects.create_user(
            email='finance-admin@example.com', password='pass1234', display_name='Admin', role='admin',
        )
        cls.support = CustomUser.objects.create_user(
            email='finance-support@example.com', password='pass1234', display_name='Support', role='support',
        )
        cls.listener = CustomUser.objects.create_user(
            email='finance-listener@example.com', password='pass1234', display_name='Listener', subscription='silver',
        )
        cls.second_listener = CustomUser.objects.create_user(
            email='finance-listener-two@example.com', password='pass1234', display_name='Listener Two', subscription='gold',
        )
        cls.artist_user = CustomUser.objects.create_user(
            email='finance-artist@example.com', password='pass1234', display_name='Artist', role='artist',
        )
        cls.artist = Artist.objects.create(
            user=cls.artist_user,
            stage_name='Accounted Artist',
            is_verified=True,
            verification_status=Artist.VERIFICATION_APPROVED,
        )
        cls.song = Song.objects.create(
            title='Accounting Song',
            artist=cls.artist,
            audio_file='songs/accounting.mp3',
            duration=180,
            release_date=date(2026, 1, 1),
        )

    def setUp(self):
        self.client.force_authenticate(self.admin)

    @property
    def current_month(self):
        return timezone.localdate().strftime('%Y-%m')

    def create_streams(self):
        StreamEvent.objects.create(user=self.listener, song=self.song)
        StreamEvent.objects.create(user=self.listener, song=self.song)
        StreamEvent.objects.create(user=self.second_listener, song=self.song)

    def test_only_admin_can_access_accounting(self):
        self.client.force_authenticate(self.support)
        response = self.client.get('/api/payments/accounting/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_invalid_month_is_rejected(self):
        response = self.client.get('/api/payments/accounting/?month=2026-13')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_accounting_aggregates_streams_listeners_and_reward(self):
        self.create_streams()
        response = self.client.get(f'/api/payments/accounting/?month={self.current_month}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        statement = response.data['results'][0]
        self.assertEqual(statement['stream_count'], 3)
        self.assertEqual(statement['unique_listeners'], 2)
        self.assertEqual(Decimal(statement['reward_amount']), Decimal('0.0284'))
        self.assertEqual(statement['artist_identifier'], self.artist_user.email)

    def test_pending_statement_refreshes_before_settlement(self):
        first = self.client.get('/api/payments/accounting/')
        self.assertEqual(first.data['results'][0]['stream_count'], 0)
        self.create_streams()
        second = self.client.get('/api/payments/accounting/')
        self.assertEqual(second.data['results'][0]['stream_count'], 3)

    def test_settlement_is_idempotent_and_notifies_artist_once(self):
        self.create_streams()
        url = f'/api/payments/accounting/artists/{self.artist.id}/settle/?month={self.current_month}'
        first = self.client.post(url)
        second = self.client.post(url)
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertTrue(first.data['created'])
        self.assertFalse(second.data['created'])
        statement = ArtistMonthlyStatement.objects.get(artist=self.artist)
        self.assertEqual(statement.status, ArtistMonthlyStatement.STATUS_SETTLED)
        self.assertEqual(statement.settled_by, self.admin)
        self.assertEqual(Notification.objects.filter(user=self.artist_user, type='financial').count(), 1)

    def test_settled_statement_keeps_its_snapshot(self):
        self.create_streams()
        url = f'/api/payments/accounting/artists/{self.artist.id}/settle/'
        self.client.post(url)
        StreamEvent.objects.create(user=self.listener, song=self.song)
        response = self.client.get('/api/payments/accounting/')
        self.assertEqual(response.data['results'][0]['stream_count'], 3)

    def test_prices_are_public_and_seeded(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/payments/prices/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({item['subscription_type'] for item in response.data['results']}, {'silver', 'gold'})

    def test_only_admin_can_update_prices(self):
        self.client.force_authenticate(self.support)
        response = self.client.put('/api/payments/prices/', {'silver': '8.50', 'gold': '14.50'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_updates_both_prices_without_code_change(self):
        response = self.client.put('/api/payments/prices/', {'silver': '8.50', 'gold': '14.50'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(SubscriptionPrice.objects.get(subscription_type='silver').price, Decimal('8.50'))
        self.assertEqual(SubscriptionPrice.objects.get(subscription_type='gold').updated_by, self.admin)

    def test_admin_overview_aggregates_distribution_and_current_revenue(self):
        Transaction.objects.create(
            user=self.listener,
            subscription_type='silver',
            amount='8.50',
            status='success',
            verified_at=timezone.now(),
        )
        Transaction.objects.create(
            user=self.second_listener,
            subscription_type='gold',
            amount='14.50',
            status='success',
            verified_at=timezone.now(),
        )
        Transaction.objects.create(
            user=self.listener,
            subscription_type='silver',
            amount='8.50',
            status='failed',
        )
        response = self.client.get('/api/payments/admin/overview/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['subscription_distribution']['silver'], 1)
        self.assertEqual(response.data['subscription_distribution']['gold'], 1)
        self.assertEqual(Decimal(response.data['total_subscription_revenue']), Decimal('23.00'))
        self.assertEqual(response.data['total_subscription_sales'], 2)
