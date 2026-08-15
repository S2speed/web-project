"""URLs for users app (including auth endpoints)."""
from django.urls import path
from .views import (
    LoginView, RefreshTokenView, LogoutView, UserMeView,
    RegisterView, RegisterArtistView,
    UserProfileView, UpdateProfileView,
    FollowUserView, UnfollowUserView,
    UserFollowersView, UserFollowingView,
    AppSettingsView, DeleteAccountView,
    ForgotPasswordView, AdminUserListView,
)

urlpatterns = [
    # Authentication
    path('register/', RegisterView.as_view(), name='register'),
    path('register/artist/', RegisterArtistView.as_view(), name='register_artist'),
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', RefreshTokenView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot_password'),
    path('me/', UserMeView.as_view(), name='user_me'),
    path('', AdminUserListView.as_view(), name='admin_user_list'),
    path('settings/', AppSettingsView.as_view(), name='app_settings'),
    path('settings/account/', DeleteAccountView.as_view(), name='delete_account'),

    # Profile
    path('profile/<int:user_id>/', UserProfileView.as_view(), name='user_profile'),
    path('profile/update/', UpdateProfileView.as_view(), name='update_profile'),

    # Follow
    path('follow/', FollowUserView.as_view(), name='follow_user'),
    path('unfollow/', UnfollowUserView.as_view(), name='unfollow_user'),

    # Followers & Following
    path('<int:user_id>/followers/', UserFollowersView.as_view(), name='user_followers'),
    path('<int:user_id>/following/', UserFollowingView.as_view(), name='user_following'),
]
