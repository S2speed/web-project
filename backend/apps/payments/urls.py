"""URLs for payments app."""
from django.urls import path
from . import views

urlpatterns = [
    path('prices/', views.SubscriptionPriceView.as_view(), name='subscription-prices'),
    path('accounting/', views.ArtistAccountingView.as_view(), name='artist-accounting'),
    path('accounting/artists/<int:artist_id>/settle/', views.ArtistSettlementView.as_view(), name='artist-settlement'),
    path('admin/overview/', views.AdminOverviewView.as_view(), name='admin-overview'),
]
