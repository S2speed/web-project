"""URLs for support app."""
from django.urls import path
from . import views

urlpatterns = [
    path('', views.ping, name='support-ping'),
]
