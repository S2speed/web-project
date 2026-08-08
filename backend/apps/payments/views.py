"""Simple views for payments app."""
from django.http import JsonResponse


def ping(request):
    """Healthcheck endpoint for the payments app."""
    return JsonResponse({'status': 'ok', 'app': 'payments'})
