from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, UserSettings


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    """Admin for CustomUser with extended fields."""

    list_display = ('email', 'display_name', 'role', 'subscription', 'is_verified', 'is_active')
    list_filter = ('role', 'subscription', 'is_verified', 'is_active', 'created_at')
    search_fields = ('email', 'display_name')
    ordering = ('-created_at',)

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('display_name', 'avatar', 'bio', 'birth_date', 'gender')}),
        ('Role & Subscription', {'fields': ('role', 'subscription', 'subscription_expires_at')}),
        ('Artist Info', {'fields': ('is_verified', 'verified_at', 'verified_by', 'rejection_reason', 'genre', 'portfolio')}),
        ('Stats', {'fields': ('followers', 'daily_streams', 'total_streams')}),
        ('Settings', {'fields': ('notification_settings',)}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'created_at', 'updated_at')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'display_name', 'password1', 'password2', 'role', 'subscription'),
        }),
    )

    readonly_fields = ('created_at', 'updated_at', 'verified_at')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Non-superusers could be restricted here if desired
        return qs


@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    list_display = (
        'user', 'language', 'app_sound', 'notification_in_app',
        'notification_daily_limit', 'updated_at',
    )
    list_filter = ('language', 'app_sound', 'notification_in_app')
    search_fields = ('user__email', 'user__display_name')
    readonly_fields = ('created_at', 'updated_at')
