"""Simple views for users app."""
from django.http import JsonResponse


def ping(request):
    """Healthcheck endpoint for the users app."""
    return JsonResponse({'status': 'ok', 'app': 'users'})
