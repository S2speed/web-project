"""Music app API views (artists, albums, songs)."""
from datetime import datetime
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend

from .models import Artist, Album, Song
from .serializers import (
    ArtistSerializer, ArtistDetailSerializer, ArtistStatsSerializer,
    VerifyArtistSerializer, AlbumBriefSerializer, SongBriefSerializer
)
from apps.users.permissions import IsAdminOrSupport
from apps.support.models import Notification


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
        pending_artists = Artist.objects.filter(is_verified=False)
        serializer = ArtistSerializer(pending_artists, many=True, context={'request': request})
        return Response({'count': pending_artists.count(), 'results': serializer.data})


class VerifyArtistView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSupport]

    def post(self, request, artist_id):
        artist = get_object_or_404(Artist, id=artist_id)
        serializer = VerifyArtistSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        status_val = serializer.validated_data['status']
        reason = serializer.validated_data.get('reason', '')

        if status_val == 'approved':
            artist.is_verified = True
            artist.verified_at = datetime.now()
            artist.save()

            user = artist.user
            user.is_verified = True
            user.verified_at = datetime.now()
            user.verified_by = request.user
            user.save()

            message = 'Your artist account was approved'
            notification_type = 'verification'
        else:
            artist.is_verified = False
            artist.save()

            user = artist.user
            user.is_verified = False
            user.rejection_reason = reason
            user.save()

            message = f'Your artist account was rejected. Reason: {reason}'
            notification_type = 'verification'

        Notification.objects.create(
            user=artist.user,
            type=notification_type,
            title='Artist verification result',
            message=message,
            link=f'/artist/{artist.id}'
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
