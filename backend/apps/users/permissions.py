from rest_framework.permissions import BasePermission


class IsOwnerOrReadOnly(BasePermission):
    """Custom permission: only owners can edit, others read-only."""

    def has_object_permission(self, request, view, obj):
        from rest_framework import permissions
        if request.method in permissions.SAFE_METHODS:
            return True
        return getattr(obj, 'user', None) == request.user


class IsAdminOrSupport(BasePermission):
    """Access allowed for admin and support roles."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in ['admin', 'support'])


class IsAdmin(BasePermission):
    """Access allowed only for admin role."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')


class IsArtist(BasePermission):
    """Access allowed only for artist role."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'artist')
