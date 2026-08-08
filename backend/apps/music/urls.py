"""URLs for music app (artists endpoints)."""
from django.urls import path
from .views import (
    ArtistListView, ArtistDetailView, PendingArtistsView,
    VerifyArtistView, ArtistStatsView
)

urlpatterns = [
    path('artists/', ArtistListView.as_view(), name='artist_list'),
    path('artists/<int:artist_id>/', ArtistDetailView.as_view(), name='artist_detail'),
    path('artists/pending/', PendingArtistsView.as_view(), name='pending_artists'),
    path('artists/<int:artist_id>/verify/', VerifyArtistView.as_view(), name='verify_artist'),
    path('artists/<int:artist_id>/stats/', ArtistStatsView.as_view(), name='artist_stats'),
]
