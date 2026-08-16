"""Root URL configuration for the backend."""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings

from .media import serve_media

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('apps.users.urls')),
    path('api/music/', include('apps.music.urls')),
    path('api/payments/', include('apps.payments.urls')),
    path('api/support/', include('apps.support.urls')),
]

if settings.DEBUG:
    urlpatterns += [
        path(f"{settings.MEDIA_URL.lstrip('/')}<path:path>", serve_media, name='development-media'),
    ]
