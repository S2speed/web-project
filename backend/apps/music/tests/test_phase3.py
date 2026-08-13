from datetime import date

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.music.models import (
    Artist, PlaybackQueue, Playlist, PlaylistTrack, QueueItem, Song, StreamEvent,
)
from apps.users.models import CustomUser


class Phase3APITestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = CustomUser.objects.create_user(
            email='listener@example.com', password='pass1234', display_name='Listener',
        )
        cls.other = CustomUser.objects.create_user(
            email='other@example.com', password='pass1234', display_name='Other',
        )
        cls.artist_user = CustomUser.objects.create_user(
            email='artist@example.com', password='pass1234', display_name='Artist', role='artist',
        )
        cls.artist = Artist.objects.create(
            user=cls.artist_user, stage_name='Phase Three', is_verified=True,
        )
        cls.songs = [
            Song.objects.create(
                title=f'Song {index}', artist=cls.artist, audio_file=f'songs/{index}.mp3',
                duration=180 + index, release_date=date(2026, 1, index),
            )
            for index in range(1, 4)
        ]

    def setUp(self):
        self.client.force_authenticate(self.user)

    def playlist_url(self, suffix=''):
        return f'/api/music/playlists/{suffix}'

    def test_playlist_list_is_scoped_to_current_user(self):
        own = Playlist.objects.create(name='Mine', user=self.user)
        Playlist.objects.create(name='Theirs', user=self.other)
        response = self.client.get(self.playlist_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['id'] for item in response.data['results']], [own.id])

    def test_private_playlist_is_hidden_from_other_users(self):
        playlist = Playlist.objects.create(name='Private', user=self.other, is_public=False)
        response = self.client.get(self.playlist_url(f'{playlist.id}/'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_free_subscription_is_limited_to_six_playlists(self):
        for index in range(6):
            Playlist.objects.create(name=f'List {index}', user=self.user)
        response = self.client.post(self.playlist_url('create/'), {'name': 'Too many'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Playlist.objects.filter(user=self.user).count(), 6)

    def test_silver_subscription_is_limited_to_one_hundred_playlists(self):
        self.user.subscription = 'silver'
        self.user.save(update_fields=['subscription'])
        Playlist.objects.bulk_create([Playlist(name=f'List {index}', user=self.user) for index in range(100)])
        response = self.client.post(self.playlist_url('create/'), {'name': 'Too many'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_gold_subscription_has_no_playlist_limit(self):
        self.user.subscription = 'gold'
        self.user.save(update_fields=['subscription'])
        response = self.client.get(self.playlist_url('check-limit/'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['allowed'])
        self.assertIsNone(response.data['limit'])

    def test_playlist_add_rejects_duplicates_and_preserves_order(self):
        playlist = Playlist.objects.create(name='Ordered', user=self.user)
        for song in self.songs[:2]:
            response = self.client.post(self.playlist_url(f'{playlist.id}/add-song/'), {'song_id': song.id})
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        duplicate = self.client.post(self.playlist_url(f'{playlist.id}/add-song/'), {'song_id': self.songs[0].id})
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(list(playlist.tracks.values_list('song_id', flat=True)), [self.songs[0].id, self.songs[1].id])

    def test_playlist_tracks_can_be_reordered(self):
        playlist = Playlist.objects.create(name='Ordered', user=self.user)
        for position, song in enumerate(self.songs):
            PlaylistTrack.objects.create(playlist=playlist, song=song, position=position)
        ids = [song.id for song in reversed(self.songs)]
        response = self.client.put(self.playlist_url(f'{playlist.id}/reorder/'), {'song_ids': ids}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['song_ids'], ids)

    def test_removing_playlist_track_compacts_positions(self):
        playlist = Playlist.objects.create(name='Ordered', user=self.user)
        for position, song in enumerate(self.songs):
            PlaylistTrack.objects.create(playlist=playlist, song=song, position=position)
        response = self.client.delete(self.playlist_url(f'{playlist.id}/remove-song/{self.songs[1].id}/'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(list(playlist.tracks.values_list('position', flat=True)), [0, 1])

    def test_playlist_cannot_be_changed_by_non_owner(self):
        playlist = Playlist.objects.create(name='Theirs', user=self.other)
        response = self.client.post(self.playlist_url(f'{playlist.id}/add-song/'), {'song_id': self.songs[0].id})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(playlist.tracks.count(), 0)

    def test_get_queue_creates_an_empty_queue(self):
        response = self.client.get('/api/music/queue/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['items'], [])
        self.assertTrue(PlaybackQueue.objects.filter(user=self.user).exists())

    def test_queue_can_be_replaced_with_order_and_preferences(self):
        response = self.client.put('/api/music/queue/', {
            'song_ids': [self.songs[1].id, self.songs[0].id],
            'current_index': 1,
            'repeat_mode': 'all',
            'shuffle': True,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['song']['id'] for item in response.data['items']], [self.songs[1].id, self.songs[0].id])
        self.assertEqual(response.data['current_index'], 1)
        self.assertEqual(response.data['repeat_mode'], 'all')
        self.assertTrue(response.data['shuffle'])

    def test_queue_allows_the_same_song_more_than_once(self):
        response = self.client.put('/api/music/queue/', {
            'song_ids': [self.songs[0].id, self.songs[0].id],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['items']), 2)

    def test_queue_item_delete_compacts_positions(self):
        queue = PlaybackQueue.objects.create(user=self.user, current_index=2)
        items = [QueueItem.objects.create(queue=queue, song=song, position=index) for index, song in enumerate(self.songs)]
        response = self.client.delete(f'/api/music/queue/items/{items[0].id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(list(queue.items.values_list('position', flat=True)), [0, 1])
        queue.refresh_from_db()
        self.assertEqual(queue.current_index, 1)

    def test_queue_items_can_be_reordered(self):
        queue = PlaybackQueue.objects.create(user=self.user)
        items = [QueueItem.objects.create(queue=queue, song=song, position=index) for index, song in enumerate(self.songs)]
        item_ids = [item.id for item in reversed(items)]
        response = self.client.put('/api/music/queue/reorder/', {'item_ids': item_ids, 'current_index': 1}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['id'] for item in response.data['items']], item_ids)
        self.assertEqual(response.data['current_index'], 1)

    def test_queue_is_private_to_each_user(self):
        other_queue = PlaybackQueue.objects.create(user=self.other)
        other_item = QueueItem.objects.create(queue=other_queue, song=self.songs[0], position=0)
        response = self.client.delete(f'/api/music/queue/items/{other_item.id}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(QueueItem.objects.filter(id=other_item.id).exists())

    def test_stream_increments_plays_and_only_counts_unique_listener_once(self):
        first = self.client.post(f'/api/music/songs/{self.songs[0].id}/play/', {}, format='json')
        second = self.client.post(f'/api/music/songs/{self.songs[0].id}/play/', {}, format='json')
        self.songs[0].refresh_from_db()
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.songs[0].play_count, 2)
        self.assertEqual(self.songs[0].listener_count, 1)

    def test_stream_idempotency_key_prevents_double_counting(self):
        payload = {'idempotency_key': 'playback-session-1', 'source': 'queue'}
        first = self.client.post(f'/api/music/songs/{self.songs[0].id}/play/', payload, format='json')
        second = self.client.post(f'/api/music/songs/{self.songs[0].id}/play/', payload, format='json')
        self.songs[0].refresh_from_db()
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertFalse(second.data['created'])
        self.assertEqual(self.songs[0].play_count, 1)

    def test_free_daily_stream_limit_is_enforced(self):
        StreamEvent.objects.bulk_create([
            StreamEvent(user=self.user, song=self.songs[0], played_at=timezone.now())
            for _ in range(60)
        ])
        response = self.client.post(f'/api/music/songs/{self.songs[0].id}/play/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(StreamEvent.objects.filter(user=self.user).count(), 60)

    def test_silver_subscription_has_unlimited_daily_streams(self):
        self.user.subscription = 'silver'
        self.user.save(update_fields=['subscription'])
        StreamEvent.objects.bulk_create([
            StreamEvent(user=self.user, song=self.songs[0], played_at=timezone.now())
            for _ in range(60)
        ])
        response = self.client.post(f'/api/music/songs/{self.songs[0].id}/play/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data['daily']['limit'])

    def test_song_stats_require_gold_or_resource_owner(self):
        denied = self.client.get(f'/api/music/songs/{self.songs[0].id}/stats/')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.user.subscription = 'gold'
        self.user.save(update_fields=['subscription'])
        allowed = self.client.get(f'/api/music/songs/{self.songs[0].id}/stats/')
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertEqual(allowed.data['song_id'], self.songs[0].id)

    def test_my_stream_stats_reports_limit_and_usage(self):
        StreamEvent.objects.create(user=self.user, song=self.songs[0])
        response = self.client.get('/api/music/streams/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['today'], 1)
        self.assertEqual(response.data['daily_limit'], 60)
        self.assertEqual(response.data['remaining_today'], 59)
