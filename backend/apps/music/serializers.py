from rest_framework import serializers
from .models import (
	Artist, Album, Song, Playlist, PlaybackQueue, QueueItem, StreamEvent,
)
from apps.users.models import CustomUser
from django.db import transaction
from django.db.models import Sum


class AlbumBriefSerializer(serializers.ModelSerializer):
	track_count = serializers.IntegerField(source='songs.count', read_only=True)

	class Meta:
		model = Album
		fields = ('id', 'title', 'cover', 'release_date', 'track_count', 'is_single')


class SongBriefSerializer(serializers.ModelSerializer):
	duration_formatted = serializers.SerializerMethodField()

	class Meta:
		model = Song
		fields = ('id', 'title', 'cover', 'duration', 'duration_formatted', 'play_count', 'listener_count', 'release_date')

	def get_duration_formatted(self, obj):
		minutes = obj.duration // 60
		seconds = obj.duration % 60
		return f"{minutes}:{seconds:02d}"


class ArtistSerializer(serializers.ModelSerializer):
	user_display_name = serializers.CharField(source='user.display_name', read_only=True)
	user_email = serializers.EmailField(source='user.email', read_only=True)
	followers_count = serializers.IntegerField(source='followers.count', read_only=True)
	is_following = serializers.SerializerMethodField()

	class Meta:
		model = Artist
		fields = (
			'id', 'stage_name', 'user', 'user_display_name', 'user_email',
			'bio', 'genre', 'portfolio', 'is_verified', 'verification_status',
			'verification_reason', 'verified_at', 'verified_by',
			'followers_count', 'is_following', 'total_listeners', 'total_streams',
			'created_at', 'updated_at'
		)
		read_only_fields = (
			'id', 'user', 'is_verified', 'verification_status', 'verification_reason',
			'verified_at', 'verified_by', 'created_at', 'updated_at',
		)

	def get_is_following(self, obj):
		request = self.context.get('request')
		if request and getattr(request.user, 'is_authenticated', False):
			return obj.followers.filter(id=request.user.id).exists()
		return False


class ArtistDetailSerializer(ArtistSerializer):
	albums = serializers.SerializerMethodField()
	singles = serializers.SerializerMethodField()

	class Meta(ArtistSerializer.Meta):
		fields = ArtistSerializer.Meta.fields + ('albums', 'singles')

	def get_albums(self, obj):
		albums = obj.albums.all().order_by('-release_date')
		return AlbumBriefSerializer(albums, many=True).data

	def get_singles(self, obj):
		singles = obj.songs.filter(is_single=True).order_by('-release_date')
		return SongBriefSerializer(singles, many=True).data


class ArtistStatsSerializer(serializers.Serializer):
	total_listeners = serializers.IntegerField()
	total_streams = serializers.IntegerField()
	average_streams_per_song = serializers.FloatField()
	monthly_growth = serializers.FloatField()
	top_songs = SongBriefSerializer(many=True)


class VerifyArtistSerializer(serializers.Serializer):
	status = serializers.ChoiceField(choices=['approved', 'rejected'])
	reason = serializers.CharField(required=False, allow_blank=True)

	def validate(self, attrs):
		reason = attrs.get('reason', '').strip()
		if attrs['status'] == 'rejected' and not reason:
			raise serializers.ValidationError({'reason': 'Reason is required when rejecting'})
		attrs['reason'] = reason
		return attrs


class SongSerializer(serializers.ModelSerializer):
	"""Full serializer for Song objects."""
	artist_name = serializers.CharField(source='artist.stage_name', read_only=True)
	album_title = serializers.CharField(source='album.title', read_only=True, allow_null=True)
	duration_formatted = serializers.SerializerMethodField()
	is_favorite = serializers.SerializerMethodField()

	class Meta:
		model = Song
		fields = (
			'id', 'title', 'artist', 'artist_name', 'album', 'album_title',
			'cover', 'audio_file', 'lyrics', 'duration', 'duration_formatted',
			'genre', 'release_date', 'is_single', 'play_count', 'listener_count',
			'is_favorite', 'created_at', 'updated_at'
		)
		read_only_fields = ('id', 'artist', 'play_count', 'listener_count', 'created_at', 'updated_at')

	def get_duration_formatted(self, obj):
		minutes = obj.duration // 60
		seconds = obj.duration % 60
		return f"{minutes}:{seconds:02d}"

	def get_is_favorite(self, obj):
		request = self.context.get('request')
		if request and getattr(request.user, 'is_authenticated', False):
			return obj.playlists.filter(user=request.user).exists()
		return False


class SongCreateSerializer(serializers.ModelSerializer):
	audio_file = serializers.FileField(required=True)
	cover = serializers.ImageField(required=False)

	class Meta:
		model = Song
		fields = (
			'title', 'album', 'cover', 'audio_file', 'lyrics',
			'duration', 'genre', 'release_date', 'is_single',
			'featured_artists'
		)

	def validate(self, data):
		request = self.context.get('request')
		try:
			artist = Artist.objects.get(user=request.user)
		except Artist.DoesNotExist:
			raise serializers.ValidationError('You are not an artist')

		if not artist.is_verified:
			raise serializers.ValidationError('Your artist account is not verified')

		if data.get('album'):
			album = data['album']
			if album.artist != artist:
				raise serializers.ValidationError({'album': 'This album does not belong to you'})

		return data

	def create(self, validated_data):
		request = self.context.get('request')
		artist = Artist.objects.get(user=request.user)
		validated_data['artist'] = artist
		return super().create(validated_data)


class SongUpdateSerializer(serializers.ModelSerializer):
	class Meta:
		model = Song
		fields = ('title', 'cover', 'lyrics', 'genre', 'is_single', 'featured_artists')

	def validate(self, data):
		request = self.context.get('request')
		try:
			artist = Artist.objects.get(user=request.user)
		except Artist.DoesNotExist:
			raise serializers.ValidationError('You are not an artist')

		song = self.instance
		if song.artist != artist:
			raise serializers.ValidationError('You do not have permission to edit this song')

		return data


class AlbumSerializer(serializers.ModelSerializer):
	"""Base serializer for Album."""
	artist_name = serializers.CharField(source='artist.stage_name', read_only=True)
	track_count = serializers.IntegerField(source='songs.count', read_only=True)
	total_duration = serializers.SerializerMethodField()

	class Meta:
		model = Album
		fields = (
			'id', 'title', 'artist', 'artist_name', 'cover',
			'release_date', 'genre', 'description', 'is_single',
			'track_count', 'total_duration', 'created_at', 'updated_at'
		)
		read_only_fields = ('id', 'artist', 'created_at', 'updated_at')

	def get_total_duration(self, obj):
		total = obj.songs.aggregate(total=Sum('duration'))['total']
		if total:
			minutes = total // 60
			seconds = total % 60
			return f"{minutes}:{seconds:02d}"
		return "0:00"


class AlbumDetailSerializer(AlbumSerializer):
	songs = SongSerializer(many=True, read_only=True)

	class Meta(AlbumSerializer.Meta):
		fields = AlbumSerializer.Meta.fields + ('songs',)


class AlbumCreateSerializer(serializers.ModelSerializer):
	cover = serializers.ImageField(required=False)

	class Meta:
		model = Album
		fields = ('title', 'cover', 'release_date', 'genre', 'description', 'is_single')

	def validate(self, data):
		request = self.context.get('request')
		try:
			artist = Artist.objects.get(user=request.user)
		except Artist.DoesNotExist:
			raise serializers.ValidationError('You are not an artist')

		if not artist.is_verified:
			raise serializers.ValidationError('Your artist account is not verified')

		return data

	def create(self, validated_data):
		request = self.context.get('request')
		artist = Artist.objects.get(user=request.user)
		validated_data['artist'] = artist
		return super().create(validated_data)


class AlbumUpdateSerializer(serializers.ModelSerializer):
	class Meta:
		model = Album
		fields = ('title', 'cover', 'genre', 'description', 'is_single')

	def validate(self, data):
		request = self.context.get('request')
		try:
			artist = Artist.objects.get(user=request.user)
		except Artist.DoesNotExist:
			raise serializers.ValidationError('You are not an artist')

		album = self.instance
		if album.artist != artist:
			raise serializers.ValidationError('You do not have permission to edit this album')

		return data


class AlbumAddSongSerializer(serializers.Serializer):
	song_ids = serializers.ListField(child=serializers.IntegerField(), required=True)

	def validate_song_ids(self, value):
		request = self.context.get('request')
		try:
			artist = Artist.objects.get(user=request.user)
		except Artist.DoesNotExist:
			raise serializers.ValidationError('You are not an artist')

		album = self.context.get('album')
		songs = Song.objects.filter(id__in=value)
		if songs.count() != len(value):
			raise serializers.ValidationError('Some songs were not found')

		for song in songs:
			if song.artist != artist:
				raise serializers.ValidationError(f'Song "{song.title}" does not belong to you')
			if song.album and song.album != album:
				raise serializers.ValidationError(f'Song "{song.title}" is already in another album')

		return value


class PlaylistSerializer(serializers.ModelSerializer):
	"""Base serializer for Playlist."""
	user_display_name = serializers.CharField(source='user.display_name', read_only=True)
	track_count = serializers.IntegerField(source='songs.count', read_only=True)
	total_duration = serializers.SerializerMethodField()
	is_owner = serializers.SerializerMethodField()
	song_ids = serializers.SerializerMethodField()

	class Meta:
		model = Playlist
		fields = (
			'id', 'name', 'user', 'user_display_name', 'cover',
			'description', 'is_public', 'track_count', 'total_duration',
			'is_owner', 'song_ids', 'created_at', 'updated_at'
		)
		read_only_fields = ('id', 'user', 'created_at', 'updated_at')

	def get_total_duration(self, obj):
		total = obj.songs.aggregate(total=Sum('duration'))['total']
		if total:
			minutes = total // 60
			seconds = total % 60
			return f"{minutes}:{seconds:02d}"
		return "0:00"

	def get_is_owner(self, obj):
		request = self.context.get('request')
		if request and getattr(request.user, 'is_authenticated', False):
			return obj.user == request.user
		return False

	def get_song_ids(self, obj):
		return list(obj.tracks.order_by('position', 'id').values_list('song_id', flat=True))


class PlaylistDetailSerializer(PlaylistSerializer):
	songs = serializers.SerializerMethodField()

	class Meta(PlaylistSerializer.Meta):
		fields = PlaylistSerializer.Meta.fields + ('songs',)

	def get_songs(self, obj):
		songs = [track.song for track in obj.tracks.select_related('song__artist', 'song__album').order_by('position', 'id')]
		return SongSerializer(songs, many=True, context=self.context).data


class PlaylistCreateSerializer(serializers.ModelSerializer):
	class Meta:
		model = Playlist
		fields = ('name', 'description', 'is_public', 'cover')

	def validate(self, data):
		request = self.context.get('request')
		user = request.user
		max_playlists = getattr(user, 'subscription_limit', {}).get('max_playlists')
		if max_playlists is not None:
			current_count = Playlist.objects.filter(user=user).count()
			if current_count >= max_playlists:
				raise serializers.ValidationError(
					f'You reached the maximum allowed playlists ({max_playlists}). Upgrade to create more.'
				)
		return data

	def create(self, validated_data):
		request = self.context.get('request')
		with transaction.atomic():
			user = CustomUser.objects.select_for_update().get(pk=request.user.pk)
			max_playlists = user.subscription_limit.get('max_playlists')
			if max_playlists is not None and Playlist.objects.filter(user=user).count() >= max_playlists:
				raise serializers.ValidationError(
					f'You reached the maximum allowed playlists ({max_playlists}). Upgrade to create more.'
				)
			validated_data['user'] = user
			return super().create(validated_data)


class PlaylistUpdateSerializer(serializers.ModelSerializer):
	class Meta:
		model = Playlist
		fields = ('name', 'description', 'is_public', 'cover')

	def validate(self, data):
		request = self.context.get('request')
		playlist = self.instance
		if playlist.user != request.user:
			raise serializers.ValidationError('You do not have permission to edit this playlist')
		return data


class PlaylistAddSongSerializer(serializers.Serializer):
	song_id = serializers.IntegerField(required=True)

	def validate_song_id(self, value):
		if not Song.objects.filter(id=value).exists():
			raise serializers.ValidationError('Song not found')
		return value

	def validate(self, data):
		request = self.context.get('request')
		playlist = self.context.get('playlist')
		song_id = data.get('song_id')

		if playlist.user != request.user:
			raise serializers.ValidationError('You do not have permission to edit this playlist')

		if playlist.songs.filter(id=song_id).exists():
			raise serializers.ValidationError('This song is already in the playlist')

		return data


class PlaylistReorderSerializer(serializers.Serializer):
	song_ids = serializers.ListField(
		child=serializers.IntegerField(min_value=1),
		allow_empty=True,
	)


class QueueItemSerializer(serializers.ModelSerializer):
	song = SongSerializer(read_only=True)

	class Meta:
		model = QueueItem
		fields = ('id', 'position', 'song', 'added_at')


class PlaybackQueueSerializer(serializers.ModelSerializer):
	items = QueueItemSerializer(many=True, read_only=True)

	class Meta:
		model = PlaybackQueue
		fields = ('id', 'current_index', 'repeat_mode', 'shuffle', 'items', 'updated_at')


class QueueReplaceSerializer(serializers.Serializer):
	song_ids = serializers.ListField(
		child=serializers.IntegerField(min_value=1),
		allow_empty=True,
	)
	current_index = serializers.IntegerField(min_value=0, default=0)
	repeat_mode = serializers.ChoiceField(choices=PlaybackQueue.REPEAT_CHOICES, default=PlaybackQueue.REPEAT_NONE)
	shuffle = serializers.BooleanField(default=False)


class QueueAddItemSerializer(serializers.Serializer):
	song_id = serializers.PrimaryKeyRelatedField(queryset=Song.objects.all(), source='song')


class QueueReorderSerializer(serializers.Serializer):
	item_ids = serializers.ListField(
		child=serializers.IntegerField(min_value=1),
		allow_empty=True,
	)
	current_index = serializers.IntegerField(min_value=0, required=False)


class StreamCreateSerializer(serializers.Serializer):
	source = serializers.ChoiceField(choices=StreamEvent.SOURCE_CHOICES, default=StreamEvent.SOURCE_DIRECT)
	idempotency_key = serializers.CharField(max_length=64, required=False, allow_blank=True, default='')
