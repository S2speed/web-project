from rest_framework import status
from rest_framework.test import APITestCase

from apps.support.models import Notification, Ticket
from apps.users.models import CustomUser


class Phase4TicketTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = CustomUser.objects.create_user(
            email='ticket-owner@example.com', password='pass1234', display_name='Owner',
        )
        cls.other = CustomUser.objects.create_user(
            email='ticket-other@example.com', password='pass1234', display_name='Other',
        )
        cls.support = CustomUser.objects.create_user(
            email='ticket-support@example.com', password='pass1234', display_name='Support', role='support',
        )
        cls.admin = CustomUser.objects.create_user(
            email='ticket-admin@example.com', password='pass1234', display_name='Admin', role='admin',
        )

    def setUp(self):
        self.client.force_authenticate(self.owner)

    def test_user_can_create_ticket_and_staff_are_notified(self):
        response = self.client.post('/api/support/tickets/', {'subject': 'Billing', 'message': 'Please help.'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'open')
        self.assertEqual(Notification.objects.filter(type='ticket').count(), 2)

    def test_user_list_is_scoped_to_owned_tickets(self):
        own = Ticket.objects.create(user=self.owner, subject='Own', message='A')
        Ticket.objects.create(user=self.other, subject='Other', message='B')
        response = self.client.get('/api/support/tickets/')
        self.assertEqual([item['id'] for item in response.data['results']], [own.id])

    def test_other_user_cannot_read_or_reply_to_ticket(self):
        ticket = Ticket.objects.create(user=self.owner, subject='Private', message='Secret')
        self.client.force_authenticate(self.other)
        detail = self.client.get(f'/api/support/tickets/{ticket.id}/')
        reply = self.client.post(f'/api/support/tickets/{ticket.id}/replies/', {'message': 'Intrusion'})
        self.assertEqual(detail.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(reply.status_code, status.HTTP_403_FORBIDDEN)

    def test_support_can_filter_and_search_all_tickets(self):
        match = Ticket.objects.create(user=self.owner, subject='Payment problem', message='Help')
        Ticket.objects.create(user=self.other, subject='Playback', message='Noise', status='closed')
        self.client.force_authenticate(self.support)
        response = self.client.get('/api/support/tickets/?status=open&search=payment')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['id'] for item in response.data['results']], [match.id])

    def test_support_reply_assigns_ticket_and_notifies_owner(self):
        ticket = Ticket.objects.create(user=self.owner, subject='Reply', message='Question')
        self.client.force_authenticate(self.support)
        response = self.client.post(f'/api/support/tickets/{ticket.id}/replies/', {'message': 'Resolved.'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, 'answered')
        self.assertEqual(ticket.assigned_to, self.support)
        self.assertTrue(ticket.replies.get().is_from_support)
        self.assertTrue(Notification.objects.filter(user=self.owner, type='ticket').exists())

    def test_owner_reply_returns_ticket_to_open(self):
        ticket = Ticket.objects.create(user=self.owner, subject='Follow-up', message='Question', status='answered')
        response = self.client.post(f'/api/support/tickets/{ticket.id}/replies/', {'message': 'I need more help.'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, 'open')
        self.assertFalse(ticket.replies.get().is_from_support)

    def test_closed_ticket_rejects_new_replies(self):
        ticket = Ticket.objects.create(user=self.owner, subject='Closed', message='Done', status='closed')
        response = self.client.post(f'/api/support/tickets/{ticket.id}/replies/', {'message': 'Again'})
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_close_is_idempotent(self):
        ticket = Ticket.objects.create(user=self.owner, subject='Close', message='Done')
        first = self.client.post(f'/api/support/tickets/{ticket.id}/close/')
        second = self.client.post(f'/api/support/tickets/{ticket.id}/close/')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        ticket.refresh_from_db()
        self.assertIsNotNone(ticket.resolved_at)
