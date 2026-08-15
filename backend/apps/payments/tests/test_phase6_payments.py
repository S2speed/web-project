from datetime import datetime, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.payments.models import SubscriptionPrice, Transaction, UserSubscription
from apps.payments.services import add_months
from apps.support.models import Notification
from apps.users.models import CustomUser


class Phase6PaymentTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = CustomUser.objects.create_user(
            email='phase6-listener@example.com',
            password='pass1234',
            display_name='Phase Six Listener',
        )
        cls.other_user = CustomUser.objects.create_user(
            email='phase6-other@example.com',
            password='pass1234',
            display_name='Other Listener',
        )
        cls.admin = CustomUser.objects.create_user(
            email='phase6-admin@example.com',
            password='pass1234',
            display_name='Phase Six Admin',
            role='admin',
        )
        SubscriptionPrice.objects.update_or_create(
            subscription_type='silver', defaults={'price': '100.00', 'duration_days': 30},
        )
        SubscriptionPrice.objects.update_or_create(
            subscription_type='gold', defaults={'price': '250.00', 'duration_days': 30},
        )

    def setUp(self):
        self.client.force_authenticate(self.user)

    def checkout(self, plan='silver', months=1, key='checkout-key'):
        return self.client.post('/api/payments/checkout/', {
            'subscription_type': plan,
            'duration_months': months,
            'idempotency_key': key,
        }, format='json')

    def complete(self, transaction, result='success'):
        return self.client.post(
            f'/api/payments/sandbox/{transaction.gateway_authority}/',
            {'status': result},
            format='json',
        )

    def test_checkout_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.checkout()
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_checkout_accepts_only_paid_plans_and_supported_durations(self):
        free = self.checkout(plan='free')
        unsupported_duration = self.checkout(months=2, key='duration-key')
        self.assertEqual(free.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(unsupported_duration.status_code, status.HTTP_400_BAD_REQUEST)

    def test_checkout_snapshots_monthly_price_for_selected_duration(self):
        response = self.checkout(months=3)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payment = Transaction.objects.get()
        self.assertEqual(payment.amount, Decimal('300.00'))
        self.assertEqual(payment.duration_months, 3)
        self.assertEqual(payment.status, 'pending')
        self.assertTrue(payment.gateway_authority)
        self.assertIn(payment.gateway_authority, response.data['transaction']['payment_url'])

    def test_checkout_keeps_price_snapshot_after_admin_price_change(self):
        self.checkout()
        payment = Transaction.objects.get()
        SubscriptionPrice.objects.filter(subscription_type='silver').update(price='999.00')
        payment.refresh_from_db()
        self.assertEqual(payment.amount, Decimal('100.00'))

    def test_idempotency_reuses_same_checkout(self):
        first = self.checkout(key='same-request')
        second = self.checkout(key='same-request')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertFalse(second.data['created'])
        self.assertEqual(Transaction.objects.count(), 1)

    def test_idempotency_key_cannot_be_reused_for_different_purchase(self):
        self.checkout(key='conflict')
        response = self.checkout(plan='gold', key='conflict')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(Transaction.objects.count(), 1)

    def test_transaction_history_is_scoped_to_authenticated_user(self):
        mine = Transaction.objects.create(
            user=self.user, subscription_type='silver', amount='100.00',
        )
        Transaction.objects.create(
            user=self.other_user, subscription_type='gold', amount='250.00',
        )
        response = self.client.get('/api/payments/transactions/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row['id'] for row in response.data['results']], [mine.id])

    def test_successful_callback_activates_subscription_and_notifies_once(self):
        self.checkout(plan='gold', months=3)
        payment = Transaction.objects.get()
        response = self.complete(payment)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payment.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(payment.status, 'success')
        self.assertTrue(payment.reference_id.startswith('SBX-'))
        self.assertEqual(self.user.subscription, 'gold')
        self.assertIsNotNone(self.user.subscription_expires_at)
        self.assertEqual(UserSubscription.objects.count(), 1)
        self.assertEqual(Notification.objects.filter(user=self.user, type='subscription').count(), 1)

    def test_failed_callback_does_not_activate_subscription(self):
        self.checkout()
        payment = Transaction.objects.get()
        response = self.complete(payment, 'failed')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        payment.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(payment.status, 'failed')
        self.assertEqual(self.user.subscription, 'free')
        self.assertFalse(UserSubscription.objects.exists())

    def test_expired_pending_payment_is_rejected(self):
        self.checkout()
        payment = Transaction.objects.get()
        Transaction.objects.filter(pk=payment.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
        payment.refresh_from_db()
        response = self.complete(payment)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        payment.refresh_from_db()
        self.assertEqual(payment.status, 'failed')
        self.assertIn('expired', payment.failure_reason.lower())

    def test_repeated_success_callback_is_idempotent(self):
        self.checkout()
        payment = Transaction.objects.get()
        first = self.complete(payment)
        second = self.complete(payment)
        self.assertTrue(first.data['changed'])
        self.assertFalse(second.data['changed'])
        self.assertEqual(UserSubscription.objects.count(), 1)
        self.assertEqual(Notification.objects.filter(user=self.user, type='subscription').count(), 1)

    def test_same_plan_renewal_extends_from_current_expiry(self):
        self.checkout(months=3, key='first')
        first_payment = Transaction.objects.get(idempotency_key='first')
        self.complete(first_payment)
        self.user.refresh_from_db()
        first_expiry = self.user.subscription_expires_at

        self.checkout(months=6, key='renewal')
        renewal = Transaction.objects.get(idempotency_key='renewal')
        self.complete(renewal)
        self.user.refresh_from_db()
        renewal_period = renewal.subscription_period
        self.assertEqual(renewal_period.starts_at, first_expiry)
        self.assertEqual(self.user.subscription_expires_at, add_months(first_expiry, 6))

    def test_switching_plan_replaces_previous_period(self):
        self.checkout(plan='gold', months=12, key='gold')
        gold_payment = Transaction.objects.get(idempotency_key='gold')
        self.complete(gold_payment)

        self.checkout(plan='silver', key='silver')
        silver_payment = Transaction.objects.get(idempotency_key='silver')
        self.complete(silver_payment)
        gold_payment.subscription_period.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(gold_payment.subscription_period.status, UserSubscription.STATUS_REPLACED)
        self.assertEqual(self.user.subscription, 'silver')

    def test_current_subscription_endpoint_downgrades_expired_user(self):
        expired = timezone.now() - timedelta(minutes=1)
        self.user.subscription = 'silver'
        self.user.subscription_expires_at = expired
        self.user.save(update_fields=['subscription', 'subscription_expires_at'])
        payment = Transaction.objects.create(
            user=self.user, subscription_type='silver', amount='100.00', status='success',
        )
        UserSubscription.objects.create(
            user=self.user,
            transaction=payment,
            subscription_type='silver',
            starts_at=expired - timedelta(days=30),
            expires_at=expired,
        )
        response = self.client.get('/api/payments/subscriptions/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['subscription_type'], 'free')
        self.assertIsNone(response.data['expires_at'])
        self.assertEqual(response.data['subscription']['status'], UserSubscription.STATUS_EXPIRED)

    def test_cancel_and_resume_change_period_end_flag_without_early_downgrade(self):
        self.checkout()
        payment = Transaction.objects.get()
        self.complete(payment)
        cancelled = self.client.post('/api/payments/subscriptions/cancel/')
        self.assertEqual(cancelled.status_code, status.HTTP_200_OK)
        self.assertTrue(cancelled.data['subscription']['cancel_at_period_end'])
        self.user.refresh_from_db()
        self.assertEqual(self.user.subscription, 'silver')
        resumed = self.client.post('/api/payments/subscriptions/resume/')
        self.assertEqual(resumed.status_code, status.HTTP_200_OK)
        self.assertFalse(resumed.data['subscription']['cancel_at_period_end'])

    def test_cancel_without_active_subscription_returns_conflict(self):
        response = self.client.post('/api/payments/subscriptions/cancel/')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_calendar_month_extension_clamps_end_of_month(self):
        value = timezone.make_aware(datetime(2024, 1, 31, 12, 0))
        self.assertEqual(add_months(value, 1).date().isoformat(), '2024-02-29')

    def test_expired_paid_tier_uses_free_entitlements_immediately(self):
        self.user.subscription = 'gold'
        self.user.subscription_expires_at = timezone.now() - timedelta(seconds=1)
        self.assertEqual(self.user.effective_subscription, 'free')
        self.assertEqual(self.user.subscription_limit['max_playlists'], 6)

    def test_admin_report_is_admin_only_and_rejects_invalid_month(self):
        forbidden = self.client.get('/api/payments/admin/reports/')
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.admin)
        invalid = self.client.get('/api/payments/admin/reports/?month=not-a-month')
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_report_returns_backend_aggregates(self):
        now = timezone.now()
        Transaction.objects.create(
            user=self.user,
            subscription_type='silver',
            duration_months=3,
            amount='300.00',
            status='success',
            verified_at=now,
        )
        Transaction.objects.create(
            user=self.other_user,
            subscription_type='gold',
            duration_months=1,
            amount='250.00',
            status='failed',
        )
        self.user.subscription = 'silver'
        self.user.subscription_expires_at = now + timedelta(days=5)
        self.user.save(update_fields=['subscription', 'subscription_expires_at'])
        self.client.force_authenticate(self.admin)
        response = self.client.get(f'/api/payments/admin/reports/?month={timezone.localdate():%Y-%m}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['transactions']['by_status']['success'], 1)
        self.assertEqual(response.data['transactions']['by_status']['failed'], 1)
        self.assertEqual(Decimal(response.data['revenue']['total']), Decimal('300.00'))
        self.assertEqual(response.data['revenue']['by_plan']['silver']['sales'], 1)
        self.assertEqual(response.data['revenue']['by_duration_months']['3']['sales'], 1)
        self.assertEqual(response.data['subscribers']['active'], 1)
        self.assertEqual(response.data['subscribers']['expiring_within_7_days'], 1)
