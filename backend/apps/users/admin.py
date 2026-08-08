from django.contrib import admin
from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    """Admin registration for CustomUser."""
    list_display = ('id', 'username', 'email', 'is_staff', 'is_active')
