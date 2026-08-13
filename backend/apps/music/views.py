"""Music app API views."""
from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Sum, Q
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import Artist, Album, Song, Playlist, StreamEvent
from .serializers import (
    ArtistSerializer, ArtistDetailSerializer, ArtistStatsSerializer,
    VerifyArtistSerializer, AlbumBriefSerializer, SongBriefSerializer,
    SongSerializer, SongCreateSerializer, SongUpdateSerializer,
    AlbumDetailSerializer, AlbumCreateSerializer, AlbumUpdateSerializer,
    AlbumAddSongSerializer, PlaylistSerializer, PlaylistDetailSerializer,
    PlaylistCreateSerializer, PlaylistUpdateSerializer, PlaylistAddSongSerializer,
    PlaylistReorderSerializer, PlaybackQueueSerializer, QueueReplaceSerializer,
    QueueAddItemSerializer, QueueReorderSerializer, StreamCreateSerializer,
)
from .services import (
    add_playlist_track, add_queue_item, get_or_create_queue, record_stream,
    remove_playlist_track, remove_queue_item, reorder_playlist_tracks,
    reorder_queue, replace_queue,
)
from apps.users.permissions import IsAdminOrSupport
from apps.support.services import create_notification, notify_new_release
from apps.users.permissions import IsArtist


class ArtistListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        queryset = Artist.objects.all().order_by('-created_at')

        is_verified = request.query_params.get('is_verified')
        if is_verified is not None:
            queryset = queryset.filter(is_verified=is_verified.lower() == 'true')

        genre = request.query_params.get('genre')
        if genre:
            queryset = queryset.filter(genre__icontains=genre)

        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(stage_name__icontains=search)

        serializer = ArtistSerializer(queryset, many=True, context={'request': request})
        return Response({'count': queryset.count(), 'results': serializer.data})


class ArtistDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, artist_id):
        artist = get_object_or_404(Artist, id=artist_id)
        serializer = ArtistDetailSerializer(artist, context={'request': request})
        return Response(serializer.data)


class PendingArtistsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSupport]

    def get(self, request):
        pending_artists = Artist.objects.filter(
            is_verified=False,
            verification_status=Artist.VERIFICATION_PENDING,
        ).select_related('user')
        serializer = ArtistSerializer(pending_artists, many=True, context={'request': request})
        return Response({'count': pending_artists.count(), 'results': serializer.data})


class VerifyArtistView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSupport]

    def post(self, request, artist_id):
        serializer = VerifyArtistSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        status_val = serializer.validated_data['status']
        reason = serializer.validated_data.get('reason', '')

        with transaction.atomic():
            artist = get_object_or_404(
                Artist.objects.select_for_update().select_related('user'),
                id=artist_id,
            )
            if artist.verification_status != Artist.VERIFICATION_PENDING:
                return Response(
                    {'detail': 'This artist application has already been reviewed.'},
                    status=status.HTTP_409_CONFLICT,
                )

            now = timezone.now()
            approved = status_val == Artist.VERIFICATION_APPROVED
            artist.is_verified = approved
            artist.verification_status = status_val
            artist.verification_reason = reason
            artist.verified_at = now if approved else None
            artist.verified_by = request.user
            artist.save(update_fields=[
                'is_verified', 'verification_status', 'verification_reason',
                'verified_at', 'verified_by', 'updated_at',
            ])

            user = artist.user
            user.is_verified = approved
            user.verified_at = now if approved else None
            user.verified_by = request.user
            user.rejection_reason = '' if approved else reason
            user.save(update_fields=[
                'is_verified', 'verified_at', 'verified_by',
                'rejection_reason', 'updated_at',
            ])

            message = (
                'Your artist account was approved.' if approved
                else f'Your artist account was rejected. Reason: {reason}'
            )
            create_notification(
                user=user,
                type='verification',
                title='Artist verification result',
                message=message,
                link=f'/artist/{artist.id}',
                dedupe_key=f'artist-verification:{artist.id}:{status_val}',
            )

        return Response({'message': f'Artist {status_val} successfully', 'artist': ArtistSerializer(artist, context={'request': request}).data})


class ArtistStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, artist_id):
        artist = get_object_or_404(Artist, id=artist_id)
        user = request.user

        if user.subscription != 'gold':
            return Response({'error': 'Upgrade to gold to view stats'}, status=status.HTTP_403_FORBIDDEN)

        songs = artist.songs.all()
        total_listeners = artist.total_listeners
        total_streams = artist.total_streams
        avg_streams = total_streams / songs.count() if songs.count() > 0 else 0
        top_songs = songs.order_by('-play_count')[:5]
        monthly_growth = 12.5

        stats_data = {
            'total_listeners': total_listeners,
            'total_streams': total_streams,
            'average_streams_per_song': round(avg_streams, 1),
            'monthly_growth': monthly_growth,
            'top_songs': SongBriefSerializer(top_songs, many=True).data
        }

        serializer = ArtistStatsSerializer(data=stats_data)
        if serializer.is_valid():
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AlbumListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        queryset = Album.objects.all().select_related('artist')

        artist_id = request.query_params.get('artist_id')
        if artist_id:
            queryset = queryset.filter(artist_id=artist_id)

        genre = request.query_params.get('genre')
        if genre:
            queryset = queryset.filter(genre__icontains=genre)

        is_single = request.query_params.get('is_single')
        if is_single is not None:
            queryset = queryset.filter(is_single=is_single.lower() == 'true')

        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(artist__stage_name__icontains=search))

        ordering = request.query_params.get('ordering', '-release_date')
        if ordering in ['release_date', '-release_date']:
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by('-release_date')

        limit = int(request.query_params.get('limit', 20))
        offset = int(request.query_params.get('offset', 0))
        count = queryset.count()
        queryset = queryset[offset:offset + limit]

        serializer = AlbumDetailSerializer(queryset, many=True, context={'request': request})
        return Response({'count': count, 'results': serializer.data})


class AlbumDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, album_id):
        album = get_object_or_404(Album, id=album_id)
        serializer = AlbumDetailSerializer(album, context={'request': request})
        return Response(serializer.data)


class AlbumCreateView(APIView):
    permission_classes = [IsAuthenticated, IsArtist]

    def post(self, request):
        try:
            artist = Artist.objects.get(user=request.user)
        except Artist.DoesNotExist:
            return Response({'error': 'You are not an artist'}, status=status.HTTP_403_FORBIDDEN)

        if not artist.is_verified:
            return Response({'error': 'Your artist account is not verified'}, status=status.HTTP_403_FORBIDDEN)

        serializer = AlbumCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            album = serializer.save()
            return Response(AlbumDetailSerializer(album, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AlbumUpdateView(APIView):
    permission_classes = [IsAuthenticated, IsArtist]

    def put(self, request, album_id):
        album = get_object_or_404(Album, id=album_id)
        try:
            artist = Artist.objects.get(user=request.user)
        except Artist.DoesNotExist:
            return Response({'error': 'You are not an artist'}, status=status.HTTP_403_FORBIDDEN)

        if album.artist != artist:
            return Response({'error': 'You do not have permission to edit this album'}, status=status.HTTP_403_FORBIDDEN)

        serializer = AlbumUpdateSerializer(album, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(AlbumDetailSerializer(album, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AlbumDeleteView(APIView):
    permission_classes = [IsAuthenticated, IsArtist]

    def delete(self, request, album_id):
        album = get_object_or_404(Album, id=album_id)
        try:
            artist = Artist.objects.get(user=request.user)
        except Artist.DoesNotExist:
            return Response({'error': 'You are not an artist'}, status=status.HTTP_403_FORBIDDEN)

        if album.artist != artist:
            return Response({'error': 'You do not have permission to delete this album'}, status=status.HTTP_403_FORBIDDEN)

        album.songs.update(album=None)
        album.delete()
        return Response({'message': 'Album deleted successfully'}, status=status.HTTP_204_NO_CONTENT)


class AlbumAddSongsView(APIView):
    permission_classes = [IsAuthenticated, IsArtist]

    def post(self, request, album_id):
        album = get_object_or_404(Album, id=album_id)
        try:
            artist = Artist.objects.get(user=request.user)
        except Artist.DoesNotExist:
            return Response({'error': 'You are not an artist'}, status=status.HTTP_403_FORBIDDEN)

        if album.artist != artist:
            return Response({'error': 'You do not have permission to edit this album'}, status=status.HTTP_403_FORBIDDEN)

        if album.is_single:
            return Response({'error': 'Single albums cannot contain multiple songs'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AlbumAddSongSerializer(data=request.data, context={'request': request, 'album': album})
        if serializer.is_valid():
            song_ids = serializer.validated_data['song_ids']
            songs = Song.objects.filter(id__in=song_ids)
            for song in songs:
                song.album = album
                song.save()

            return Response({'message': f'{len(songs)} songs added to album', 'album': AlbumDetailSerializer(album, context={'request': request}).data})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AlbumRemoveSongView(APIView):
    permission_classes = [IsAuthenticated, IsArtist]

    def post(self, request, album_id, song_id):
        album = get_object_or_404(Album, id=album_id)
        song = get_object_or_404(Song, id=song_id)
        try:
            artist = Artist.objects.get(user=request.user)
        except Artist.DoesNotExist:
            return Response({'error': 'You are not an artist'}, status=status.HTTP_403_FORBIDDEN)

        if album.artist != artist:
            return Response({'error': 'You do not have permission to edit this album'}, status=status.HTTP_403_FORBIDDEN)

        if song.album != album:
            return Response({'error': 'This song is not in the album'}, status=status.HTTP_400_BAD_REQUEST)

        song.album = None
        song.save()

        return Response({'message': f'Song "{song.title}" removed from album', 'album': AlbumDetailSerializer(album, context={'request': request}).data})


class PlaylistListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Playlist.objects.filter(user=request.user).order_by('-created_at')

        is_public = request.query_params.get('is_public')
        if is_public is not None:
            queryset = queryset.filter(is_public=is_public.lower() == 'true')

        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(name__icontains=search)

        try:
            limit = min(max(int(request.query_params.get('limit', 20)), 1), 100)
            offset = max(int(request.query_params.get('offset', 0)), 0)
        except ValueError:
            return Response({'error': 'limit and offset must be integers'}, status=status.HTTP_400_BAD_REQUEST)
        count = queryset.count()
        queryset = queryset[offset:offset + limit]

        serializer = PlaylistSerializer(queryset, many=True, context={'request': request})
        return Response({'count': count, 'results': serializer.data})


class PlaylistDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, playlist_id):
        playlist = get_object_or_404(Playlist, id=playlist_id)
        if not playlist.is_public and playlist.user != request.user:
            return Response({'error': 'You do not have access to this playlist'}, status=status.HTTP_403_FORBIDDEN)
        serializer = PlaylistDetailSerializer(playlist, context={'request': request})
        return Response(serializer.data)


class PlaylistCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PlaylistCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            playlist = serializer.save()
            return Response(PlaylistDetailSerializer(playlist, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PlaylistUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, playlist_id):
        return self._update(request, playlist_id)

    def patch(self, request, playlist_id):
        return self._update(request, playlist_id)

    def _update(self, request, playlist_id):
        playlist = get_object_or_404(Playlist, id=playlist_id)
        if playlist.user != request.user:
            return Response({'error': 'You do not have permission to edit this playlist'}, status=status.HTTP_403_FORBIDDEN)
        serializer = PlaylistUpdateSerializer(playlist, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(PlaylistDetailSerializer(playlist, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PlaylistDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, playlist_id):
        playlist = get_object_or_404(Playlist, id=playlist_id)
        if playlist.user != request.user:
            return Response({'error': 'You do not have permission to delete this playlist'}, status=status.HTTP_403_FORBIDDEN)
        playlist.delete()
        return Response({'message': 'Playlist deleted successfully'}, status=status.HTTP_204_NO_CONTENT)


class PlaylistAddSongView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, playlist_id):
        playlist = get_object_or_404(Playlist, id=playlist_id)
        if playlist.user != request.user:
            return Response({'error': 'You do not have permission to edit this playlist'}, status=status.HTTP_403_FORBIDDEN)
        serializer = PlaylistAddSongSerializer(data=request.data, context={'request': request, 'playlist': playlist})
        if serializer.is_valid():
            song_id = serializer.validated_data['song_id']
            song = Song.objects.get(id=song_id)
            add_playlist_track(playlist, song)
            return Response(
                {
                    'message': f'Song "{song.title}" added to playlist',
                    'playlist': PlaylistDetailSerializer(playlist, context={'request': request}).data,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PlaylistRemoveSongView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, playlist_id, song_id):
        playlist = get_object_or_404(Playlist, id=playlist_id)
        if playlist.user != request.user:
            return Response({'error': 'You do not have permission to edit this playlist'}, status=status.HTTP_403_FORBIDDEN)
        song = get_object_or_404(Song, id=song_id)
        remove_playlist_track(playlist, song)
        return Response({'message': f'Song "{song.title}" removed from playlist', 'playlist': PlaylistDetailSerializer(playlist, context={'request': request}).data})

    # Backward-compatible alias for the Phase 1 client.
    def post(self, request, playlist_id, song_id):
        return self.delete(request, playlist_id, song_id)


class PlaylistReorderView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, playlist_id):
        playlist = get_object_or_404(Playlist, id=playlist_id)
        if playlist.user != request.user:
            return Response({'error': 'You do not have permission to edit this playlist'}, status=status.HTTP_403_FORBIDDEN)
        serializer = PlaylistReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reorder_playlist_tracks(playlist, serializer.validated_data['song_ids'])
        return Response(PlaylistDetailSerializer(playlist, context={'request': request}).data)


class PlaylistCheckLimitView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        max_playlists = getattr(user, 'subscription_limit', {}).get('max_playlists')
        current_count = Playlist.objects.filter(user=user).count()
        can_create = max_playlists is None or current_count < max_playlists
        remaining = max_playlists - current_count if max_playlists is not None else None
        return Response({
            'can_create': can_create,
            'allowed': can_create,
            'current_count': current_count,
            'max_allowed': max_playlists,
            'limit': max_playlists,
            'remaining': remaining,
            'subscription': user.subscription,
        })


class PlaybackQueueView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queue = get_or_create_queue(request.user)
        return Response(PlaybackQueueSerializer(queue, context={'request': request}).data)

    def put(self, request):
        serializer = QueueReplaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        queue = replace_queue(request.user, **serializer.validated_data)
        return Response(PlaybackQueueSerializer(queue, context={'request': request}).data)

    def delete(self, request):
        queue = get_or_create_queue(request.user)
        queue.items.all().delete()
        queue.current_index = 0
        queue.save(update_fields=['current_index', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class QueueItemCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = QueueAddItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = add_queue_item(request.user, serializer.validated_data['song'])
        queue = item.queue
        return Response(
            PlaybackQueueSerializer(queue, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class QueueItemDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, item_id):
        queue = remove_queue_item(request.user, item_id)
        return Response(PlaybackQueueSerializer(queue, context={'request': request}).data)


class QueueReorderView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        serializer = QueueReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        queue = reorder_queue(request.user, **serializer.validated_data)
        return Response(PlaybackQueueSerializer(queue, context={'request': request}).data)


class SongListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        queryset = Song.objects.all().select_related('artist', 'album')

        genre = request.query_params.get('genre')
        if genre:
            queryset = queryset.filter(genre__icontains=genre)

        artist_id = request.query_params.get('artist_id')
        if artist_id:
            queryset = queryset.filter(artist_id=artist_id)

        album_id = request.query_params.get('album_id')
        if album_id:
            queryset = queryset.filter(album_id=album_id)

        is_single = request.query_params.get('is_single')
        if is_single is not None:
            queryset = queryset.filter(is_single=is_single.lower() == 'true')

        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(artist__stage_name__icontains=search))

        ordering = request.query_params.get('ordering', '-release_date')
        if ordering in ['play_count', '-play_count', 'release_date', '-release_date']:
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by('-release_date')

        limit = int(request.query_params.get('limit', 20))
        offset = int(request.query_params.get('offset', 0))
        count = queryset.count()
        queryset = queryset[offset:offset + limit]

        serializer = SongSerializer(queryset, many=True, context={'request': request})
        return Response({'count': count, 'next': None, 'previous': None, 'results': serializer.data})


class SongDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, song_id):
        song = get_object_or_404(Song, id=song_id)
        serializer = SongSerializer(song, context={'request': request})
        return Response(serializer.data)


class SongCreateView(APIView):
    permission_classes = [IsAuthenticated, IsArtist]

    def post(self, request):
        try:
            artist = Artist.objects.get(user=request.user)
        except Artist.DoesNotExist:
            return Response({'error': 'You are not an artist'}, status=status.HTTP_403_FORBIDDEN)

        if not artist.is_verified:
            return Response({'error': 'Your artist account is not verified'}, status=status.HTTP_403_FORBIDDEN)

        serializer = SongCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            song = serializer.save()
            notify_new_release(song)
            return Response(SongSerializer(song, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SongUpdateView(APIView):
    permission_classes = [IsAuthenticated, IsArtist]

    def put(self, request, song_id):
        song = get_object_or_404(Song, id=song_id)
        try:
            artist = Artist.objects.get(user=request.user)
        except Artist.DoesNotExist:
            return Response({'error': 'You are not an artist'}, status=status.HTTP_403_FORBIDDEN)

        if song.artist != artist:
            return Response({'error': 'You do not have permission to edit this song'}, status=status.HTTP_403_FORBIDDEN)

        serializer = SongUpdateSerializer(song, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(SongSerializer(song, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SongDeleteView(APIView):
    permission_classes = [IsAuthenticated, IsArtist]

    def delete(self, request, song_id):
        song = get_object_or_404(Song, id=song_id)
        try:
            artist = Artist.objects.get(user=request.user)
        except Artist.DoesNotExist:
            return Response({'error': 'You are not an artist'}, status=status.HTTP_403_FORBIDDEN)

        if song.artist != artist:
            return Response({'error': 'You do not have permission to delete this song'}, status=status.HTTP_403_FORBIDDEN)

        song.delete()
        return Response({'message': 'Song deleted successfully'}, status=status.HTTP_204_NO_CONTENT)


class IncrementPlayCountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, song_id):
        song = get_object_or_404(Song, id=song_id)
        serializer = StreamCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event, created = record_stream(
            user=request.user,
            song=song,
            **serializer.validated_data,
        )
        song.refresh_from_db(fields=['play_count', 'listener_count'])
        today = timezone.localdate()
        used_today = StreamEvent.objects.filter(user=request.user, played_at__date=today).count()
        daily_limit = request.user.subscription_limit.get('max_daily_streams')
        remaining = None if daily_limit is None else max(daily_limit - used_today, 0)
        return Response(
            {
                'message': 'Stream recorded' if created else 'Stream was already recorded',
                'created': created,
                'event_id': event.id,
                'play_count': song.play_count,
                'listener_count': song.listener_count,
                'daily': {
                    'used': used_today,
                    'limit': daily_limit,
                    'remaining': remaining,
                },
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class MyStreamStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        queryset = StreamEvent.objects.filter(user=request.user)
        used_today = queryset.filter(played_at__date=today).count()
        daily_limit = request.user.subscription_limit.get('max_daily_streams')
        return Response({
            'today': used_today,
            'total': queryset.count(),
            'daily_limit': daily_limit,
            'remaining_today': None if daily_limit is None else max(daily_limit - used_today, 0),
            'subscription': request.user.subscription,
        })


class SongStreamStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, song_id):
        song = get_object_or_404(Song.objects.select_related('artist__user'), id=song_id)
        can_view = (
            request.user.subscription == 'gold'
            or request.user == song.artist.user
            or request.user.role in ('admin', 'support')
        )
        if not can_view:
            return Response(
                {'error': 'A gold subscription is required to view song statistics.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        since = timezone.now() - timedelta(days=30)
        recent = StreamEvent.objects.filter(song=song, played_at__gte=since)
        by_day = list(
            recent.annotate(day=TruncDate('played_at'))
            .values('day')
            .annotate(streams=Count('id'), listeners=Count('user_id', distinct=True))
            .order_by('day')
        )
        return Response({
            'song_id': song.id,
            'play_count': song.play_count,
            'listener_count': song.listener_count,
            'last_30_days': {
                'streams': recent.count(),
                'listeners': recent.values('user_id').distinct().count(),
                'by_day': by_day,
            },
        })
