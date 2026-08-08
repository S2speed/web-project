from django.db import models
from django.conf import settings
from django.utils import timezone


class Artist(models.Model):
    """Artist profile linked one-to-one with a user."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='artist_profile')
    stage_name = models.CharField(max_length=100)
    bio = models.TextField(blank=True)
    genre = models.CharField(max_length=50, blank=True)
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    portfolio = models.FileField(upload_to='portfolios/', null=True, blank=True)
    followers = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='followed_artists', blank=True)
    total_listeners = models.PositiveIntegerField(default=0)
    total_streams = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'artist'
        verbose_name_plural = 'artists'
        ordering = ['-created_at']

    def __str__(self):
        return self.stage_name

    @property
    def user_display_name(self):
        return self.user.display_name

    def update_stats(self):
        """Update aggregated stats for the artist."""
        songs = self.songs.all()
        self.total_streams = sum(song.play_count for song in songs)
        # unique listeners calculation could be implemented here
        self.save()


class Album(models.Model):
    """Album model containing multiple songs."""

    title = models.CharField(max_length=200)
    artist = models.ForeignKey(Artist, on_delete=models.CASCADE, related_name='albums')
    cover = models.ImageField(upload_to='covers/albums/', null=True, blank=True)
    release_date = models.DateField()
    genre = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    is_single = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'album'
        verbose_name_plural = 'albums'
        ordering = ['-release_date']

    def __str__(self):
        return f"{self.title} - {self.artist.stage_name}"

    @property
    def track_count(self):
        return self.songs.count()

    @property
    def total_duration(self):
        return sum(song.duration for song in self.songs.all())


class Song(models.Model):
    """Song model with file and playback statistics."""

    title = models.CharField(max_length=200)
    artist = models.ForeignKey(Artist, on_delete=models.CASCADE, related_name='songs')
    album = models.ForeignKey(Album, on_delete=models.SET_NULL, null=True, blank=True, related_name='songs')
    cover = models.ImageField(upload_to='covers/songs/', null=True, blank=True)
    audio_file = models.FileField(upload_to='songs/')
    lyrics = models.TextField(blank=True)
    duration = models.PositiveIntegerField(help_text='duration in seconds')
    genre = models.CharField(max_length=50, blank=True)
    release_date = models.DateField()
    is_single = models.BooleanField(default=True)
    featured_artists = models.ManyToManyField(Artist, related_name='featured_in', blank=True)

    # statistics
    play_count = models.PositiveIntegerField(default=0)
    listener_count = models.PositiveIntegerField(default=0)
    listeners = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='listened_songs', blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'song'
        verbose_name_plural = 'songs'
        ordering = ['-release_date']

    def __str__(self):
        return f"{self.title} - {self.artist.stage_name}"

    @property
    def formatted_duration(self):
        minutes = self.duration // 60
        seconds = self.duration % 60
        return f"{minutes}:{seconds:02d}"

    def increment_play_count(self, user=None):
        """Increment play count and optionally update unique listener count."""
        self.play_count = models.F('play_count') + 1
        if user and not self.listeners.filter(pk=user.pk).exists():
            self.listener_count = models.F('listener_count') + 1
            self.listeners.add(user)
        self.save()
        # refresh from db to resolve F expressions
        self.refresh_from_db()
        self.artist.update_stats()


class Playlist(models.Model):
    """Playlist created by a user containing many songs."""

    name = models.CharField(max_length=100)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='playlists')
    songs = models.ManyToManyField(Song, related_name='playlists', blank=True)
    is_public = models.BooleanField(default=True)
    cover = models.ImageField(upload_to='covers/playlists/', null=True, blank=True)
    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'playlist'
        verbose_name_plural = 'playlists'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['user', 'name'], name='unique_playlist_name_per_user')
        ]

    def __str__(self):
        return f"{self.name} - {self.user.display_name}"

    @property
    def total_duration(self):
        return sum(song.duration for song in self.songs.all())

    @property
    def track_count(self):
        return self.songs.count()

    def can_user_create(self, user):
        """Check if the user can create another playlist based on subscription limits."""
        max_playlists = user.subscription_limit.get('max_playlists')
        if max_playlists is None:
            return True
        return user.playlists.count() < max_playlists
