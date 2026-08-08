"""Simple views for music app."""
from django.http import JsonResponse


def ping(request):
    """Healthcheck endpoint for the music app."""
    return JsonResponse({'status': 'ok', 'app': 'music'})
