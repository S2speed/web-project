from rest_framework import serializers
from .models import Artist, Album, Song
from apps.users.models import CustomUser


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
			'bio', 'genre', 'is_verified', 'verified_at',
			'followers_count', 'is_following', 'total_listeners', 'total_streams',
			'created_at', 'updated_at'
		)
		read_only_fields = ('id', 'user', 'created_at', 'updated_at')

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

	def validate_reason(self, value):
		if self.initial_data.get('status') == 'rejected' and not value:
			raise serializers.ValidationError('Reason is required when rejecting')
		return value
