"""Simple views for support app."""
from django.http import JsonResponse


def ping(request):
    """Healthcheck endpoint for the support app."""
    return JsonResponse({'status': 'ok', 'app': 'support'})
