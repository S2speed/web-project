"""URLs for music app (artists endpoints)."""
from django.urls import path
from .views import (
    ArtistListView, ArtistDetailView, PendingArtistsView,
    VerifyArtistView, ArtistStatsView,
    SongListView, SongDetailView, SongCreateView,
    SongUpdateView, SongDeleteView, IncrementPlayCountView,
    AlbumListView, AlbumDetailView, AlbumCreateView,
    AlbumUpdateView, AlbumDeleteView,
    AlbumAddSongsView, AlbumRemoveSongView
    ,PlaylistListView, PlaylistDetailView, PlaylistCreateView,
    PlaylistUpdateView, PlaylistDeleteView, PlaylistAddSongView,
    PlaylistRemoveSongView, PlaylistCheckLimitView, PlaylistReorderView,
    PlaybackQueueView, QueueItemCreateView, QueueItemDeleteView,
    QueueReorderView, MyStreamStatsView, SongStreamStatsView,
)

urlpatterns = [
    path('artists/', ArtistListView.as_view(), name='artist_list'),
    path('artists/<int:artist_id>/', ArtistDetailView.as_view(), name='artist_detail'),
    path('artists/pending/', PendingArtistsView.as_view(), name='pending_artists'),
    path('artists/<int:artist_id>/verify/', VerifyArtistView.as_view(), name='verify_artist'),
    path('artists/<int:artist_id>/stats/', ArtistStatsView.as_view(), name='artist_stats'),
    
    # Songs
    path('songs/', SongListView.as_view(), name='song_list'),
    path('songs/<int:song_id>/', SongDetailView.as_view(), name='song_detail'),
    path('songs/create/', SongCreateView.as_view(), name='song_create'),
    path('songs/<int:song_id>/update/', SongUpdateView.as_view(), name='song_update'),
    path('songs/<int:song_id>/delete/', SongDeleteView.as_view(), name='song_delete'),
    path('songs/<int:song_id>/play/', IncrementPlayCountView.as_view(), name='song_play'),
    path('songs/<int:song_id>/stats/', SongStreamStatsView.as_view(), name='song_stream_stats'),
    path('streams/me/', MyStreamStatsView.as_view(), name='my_stream_stats'),
    
    # Albums
    path('albums/', AlbumListView.as_view(), name='album_list'),
    path('albums/<int:album_id>/', AlbumDetailView.as_view(), name='album_detail'),
    path('albums/create/', AlbumCreateView.as_view(), name='album_create'),
    path('albums/<int:album_id>/update/', AlbumUpdateView.as_view(), name='album_update'),
    path('albums/<int:album_id>/delete/', AlbumDeleteView.as_view(), name='album_delete'),
    path('albums/<int:album_id>/add-songs/', AlbumAddSongsView.as_view(), name='album_add_songs'),
    path('albums/<int:album_id>/remove-song/<int:song_id>/', AlbumRemoveSongView.as_view(), name='album_remove_song'),

    # Playlists
    path('playlists/', PlaylistListView.as_view(), name='playlist_list'),
    path('playlists/<int:playlist_id>/', PlaylistDetailView.as_view(), name='playlist_detail'),
    path('playlists/create/', PlaylistCreateView.as_view(), name='playlist_create'),
    path('playlists/<int:playlist_id>/update/', PlaylistUpdateView.as_view(), name='playlist_update'),
    path('playlists/<int:playlist_id>/delete/', PlaylistDeleteView.as_view(), name='playlist_delete'),
    path('playlists/<int:playlist_id>/add-song/', PlaylistAddSongView.as_view(), name='playlist_add_song'),
    path('playlists/<int:playlist_id>/remove-song/<int:song_id>/', PlaylistRemoveSongView.as_view(), name='playlist_remove_song'),
    path('playlists/<int:playlist_id>/reorder/', PlaylistReorderView.as_view(), name='playlist_reorder'),
    path('playlists/check-limit/', PlaylistCheckLimitView.as_view(), name='playlist_check_limit'),

    # Playback queue
    path('queue/', PlaybackQueueView.as_view(), name='playback_queue'),
    path('queue/items/', QueueItemCreateView.as_view(), name='queue_item_create'),
    path('queue/items/<int:item_id>/', QueueItemDeleteView.as_view(), name='queue_item_delete'),
    path('queue/reorder/', QueueReorderView.as_view(), name='queue_reorder'),
]
