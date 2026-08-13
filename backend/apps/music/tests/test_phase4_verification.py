from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.music.models import Artist
from apps.support.models import Notification
from apps.users.models import CustomUser


class Phase4ArtistVerificationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = CustomUser.objects.create_user(
            email='admin-phase4@example.com', password='pass1234', display_name='Admin', role='admin',
        )
        cls.support = CustomUser.objects.create_user(
            email='support-phase4@example.com', password='pass1234', display_name='Support', role='support',
        )
        cls.listener = CustomUser.objects.create_user(
            email='listener-phase4@example.com', password='pass1234', display_name='Listener',
        )

    def create_application(self, suffix='one'):
        user = CustomUser.objects.create_user(
            email=f'artist-{suffix}@example.com', password='pass1234', display_name=f'Artist {suffix}', role='artist',
        )
        return Artist.objects.create(user=user, stage_name=f'Stage {suffix}')

    def test_support_can_list_only_pending_applications(self):
        pending = self.create_application('pending')
        approved = self.create_application('approved')
        approved.is_verified = True
        approved.verification_status = Artist.VERIFICATION_APPROVED
        approved.save()
        self.client.force_authenticate(self.support)
        response = self.client.get('/api/music/artists/pending/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['id'] for item in response.data['results']], [pending.id])

    def test_listener_cannot_review_applications(self):
        artist = self.create_application('denied')
        self.client.force_authenticate(self.listener)
        response = self.client.post(f'/api/music/artists/{artist.id}/verify/', {'status': 'approved'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_approval_updates_both_profiles_and_notifies_artist(self):
        artist = self.create_application('approve')
        self.client.force_authenticate(self.support)
        response = self.client.post(f'/api/music/artists/{artist.id}/verify/', {'status': 'approved'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        artist.refresh_from_db()
        artist.user.refresh_from_db()
        self.assertTrue(artist.is_verified)
        self.assertEqual(artist.verification_status, Artist.VERIFICATION_APPROVED)
        self.assertEqual(artist.verified_by, self.support)
        self.assertTrue(artist.user.is_verified)
        self.assertIsNotNone(artist.verified_at)
        self.assertTrue(Notification.objects.filter(user=artist.user, type='verification').exists())

    def test_rejection_requires_reason_and_records_decision(self):
        artist = self.create_application('reject')
        self.client.force_authenticate(self.admin)
        invalid = self.client.post(f'/api/music/artists/{artist.id}/verify/', {'status': 'rejected'})
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.post(
            f'/api/music/artists/{artist.id}/verify/',
            {'status': 'rejected', 'reason': 'Portfolio is incomplete.'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        artist.refresh_from_db()
        artist.user.refresh_from_db()
        self.assertEqual(artist.verification_status, Artist.VERIFICATION_REJECTED)
        self.assertEqual(artist.verification_reason, 'Portfolio is incomplete.')
        self.assertEqual(artist.user.rejection_reason, 'Portfolio is incomplete.')
        self.assertIsNone(artist.verified_at)

    def test_application_cannot_be_reviewed_twice(self):
        artist = self.create_application('twice')
        self.client.force_authenticate(self.admin)
        first = self.client.post(f'/api/music/artists/{artist.id}/verify/', {'status': 'approved'})
        second = self.client.post(
            f'/api/music/artists/{artist.id}/verify/',
            {'status': 'rejected', 'reason': 'Changed mind.'},
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(Notification.objects.filter(user=artist.user, type='verification').count(), 1)
