from django.contrib import admin
from .models import Artist, Album, Song, Playlist
from apps.users.models import CustomUser


@admin.register(Artist)
class ArtistAdmin(admin.ModelAdmin):
	list_display = ('stage_name', 'user', 'is_verified', 'genre', 'total_streams')
	list_filter = ('is_verified', 'genre', 'created_at')
	search_fields = ('stage_name', 'user__email', 'bio')
	ordering = ('-created_at',)
	readonly_fields = ('created_at', 'updated_at', 'total_streams', 'total_listeners')

	fieldsets = (
		('Main', {'fields': ('user', 'stage_name', 'bio', 'genre')}),
		('Status', {'fields': ('is_verified', 'verified_at', 'portfolio')}),
		('Stats', {'fields': ('followers', 'total_listeners', 'total_streams')}),
		('Dates', {'fields': ('created_at', 'updated_at')}),
	)

	def formfield_for_foreignkey(self, db_field, request, **kwargs):
		if db_field.name == 'user':
			kwargs['queryset'] = CustomUser.objects.filter(role='artist')
		return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(Album)
class AlbumAdmin(admin.ModelAdmin):
	list_display = ('title', 'artist', 'release_date', 'is_single', 'track_count')
	list_filter = ('is_single', 'genre', 'release_date')
	search_fields = ('title', 'artist__stage_name')
	ordering = ('-release_date',)
	readonly_fields = ('created_at', 'updated_at')

	fieldsets = (
		('Main', {'fields': ('title', 'artist', 'cover', 'release_date', 'genre', 'description')}),
		('Type', {'fields': ('is_single',)}),
		('Dates', {'fields': ('created_at', 'updated_at')}),
	)


@admin.register(Song)
class SongAdmin(admin.ModelAdmin):
	list_display = ('title', 'artist', 'album', 'duration', 'play_count', 'listener_count')
	list_filter = ('genre', 'is_single', 'release_date')
	search_fields = ('title', 'artist__stage_name', 'album__title')
	ordering = ('-release_date',)
	readonly_fields = ('created_at', 'updated_at', 'play_count', 'listener_count')

	fieldsets = (
		('Main', {'fields': ('title', 'artist', 'album', 'cover', 'audio_file', 'lyrics', 'duration')}),
		('Classification', {'fields': ('genre', 'release_date', 'is_single', 'featured_artists')}),
		('Stats', {'fields': ('play_count', 'listener_count')}),
		('Dates', {'fields': ('created_at', 'updated_at')}),
	)

	def get_queryset(self, request):
		qs = super().get_queryset(request)
		if not request.user.is_superuser and getattr(request.user, 'role', None) == 'artist':
			try:
				artist = request.user.artist_profile
				qs = qs.filter(artist=artist)
			except Exception:
				pass
		return qs


@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
	list_display = ('name', 'user', 'track_count', 'is_public', 'created_at')
	list_filter = ('is_public', 'created_at')
	search_fields = ('name', 'user__display_name', 'user__email')
	ordering = ('-created_at',)
	readonly_fields = ('created_at', 'updated_at')
