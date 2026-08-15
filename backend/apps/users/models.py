"""Models for users app.

Custom user model placeholder.
"""
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.base_user import BaseUserManager
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class CustomUserManager(BaseUserManager):
    """Custom manager that uses email as the unique identifier."""

    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        """Create and save a regular User with the given email and password."""
        if not email:
            raise ValueError('The Email must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a SuperUser with the given email and password."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('role', 'admin')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractUser):
    """Custom user model with roles and subscription tiers.

    Email is used as the unique identifier instead of username.
    """

    username = None
    email = models.EmailField(unique=True)

    ROLE_CHOICES = (
        ('admin', 'admin'),
        ('support', 'support'),
        ('artist', 'artist'),
        ('listener', 'listener'),
    )

    SUBSCRIPTION_CHOICES = (
        ('free', 'free'),
        ('silver', 'silver'),
        ('gold', 'gold'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='listener')
    subscription = models.CharField(max_length=20, choices=SUBSCRIPTION_CHOICES, default='free')
    subscription_expires_at = models.DateTimeField(null=True, blank=True)
    display_name = models.CharField(max_length=100)
    avatar = models.ImageField(upload_to='covers/avatars/', null=True, blank=True)
    bio = models.TextField(blank=True)
    birth_date = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=(('male', 'male'), ('female', 'female'), ('other', 'other')), blank=True)

    # Artist-related fields
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_artists')
    rejection_reason = models.TextField(blank=True)
    genre = models.CharField(max_length=50, blank=True)
    portfolio = models.FileField(upload_to='portfolios/', null=True, blank=True)

    # Stats and relations
    followers = models.ManyToManyField('self', symmetrical=False, related_name='following', blank=True)
    daily_streams = models.PositiveIntegerField(default=0)
    total_streams = models.PositiveIntegerField(default=0)

    notification_settings = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['display_name']

    # attach custom manager
    objects = CustomUserManager()

    class Meta:
        verbose_name = 'user'
        verbose_name_plural = 'users'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.display_name} ({self.email})"

    @property
    def is_artist(self):
        return self.role == 'artist'

    @property
    def is_admin_or_support(self):
        return self.role in ['admin', 'support']

    @property
    def effective_subscription(self):
        if (
            self.subscription != 'free'
            and self.subscription_expires_at is not None
            and self.subscription_expires_at <= timezone.now()
        ):
            return 'free'
        return self.subscription

    @property
    def subscription_limit(self):
        """Return subscription limits for the current user's tier."""
        limits = {
            'free': {'max_playlists': 6, 'max_daily_streams': 60, 'can_upload_avatar': False, 'has_early_access': False, 'can_see_stats': False},
            'silver': {'max_playlists': 100, 'max_daily_streams': None, 'can_upload_avatar': True, 'has_early_access': False, 'can_see_stats': False},
            'gold': {'max_playlists': None, 'max_daily_streams': None, 'can_upload_avatar': True, 'has_early_access': True, 'can_see_stats': True},
        }
        return limits.get(self.effective_subscription, limits['free'])


class UserSettings(models.Model):
    """Server-side preferences shared by every device a user signs in from."""

    LANGUAGE_CHOICES = (
        ('fa', 'Persian'),
        ('en', 'English'),
    )

    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='app_settings',
    )
    notification_in_app = models.BooleanField(default=True)
    notification_push = models.BooleanField(default=True)
    notification_email = models.BooleanField(default=True)
    notification_daily_limit = models.PositiveSmallIntegerField(
        default=10,
        validators=[MinValueValidator(0), MaxValueValidator(50)],
    )
    app_sound = models.BooleanField(default=True)
    language = models.CharField(max_length=5, choices=LANGUAGE_CHOICES, default='fa')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'user setting'
        verbose_name_plural = 'user settings'

    def __str__(self):
        return f'Settings for {self.user.email}'
