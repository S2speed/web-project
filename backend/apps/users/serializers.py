from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import make_password
from apps.music.models import Artist
from .models import CustomUser


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(email=data.get('email'), password=data.get('password'))
        if not user:
            raise serializers.ValidationError('Invalid credentials')
        if not user.is_active:
            raise serializers.ValidationError('User account is disabled')
        return {'user': user}


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ('id', 'email', 'display_name', 'role', 'subscription', 'avatar', 'is_verified', 'bio', 'genre')


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    confirm_password = serializers.CharField(write_only=True, min_length=6)
    privacy_accepted = serializers.BooleanField(write_only=True, required=True)

    class Meta:
        model = CustomUser
        fields = (
            'email', 'display_name', 'password', 'confirm_password',
            'birth_date', 'gender', 'privacy_accepted'
        )

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match'})
        if not data.get('privacy_accepted', False):
            raise serializers.ValidationError({'privacy_accepted': 'Privacy must be accepted'})
        if CustomUser.objects.filter(email=data['email']).exists():
            raise serializers.ValidationError({'email': 'This email is already registered'})
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        validated_data.pop('privacy_accepted')
        validated_data['password'] = make_password(validated_data['password'])
        validated_data['role'] = 'listener'
        validated_data['subscription'] = 'free'
        validated_data['username'] = validated_data['email']
        return super().create(validated_data)


class RegisterArtistSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    confirm_password = serializers.CharField(write_only=True, min_length=6)
    artist_name = serializers.CharField(write_only=True, required=True)
    bio = serializers.CharField(write_only=True, required=False, allow_blank=True)
    genre = serializers.CharField(write_only=True, required=False, allow_blank=True)
    portfolio = serializers.FileField(write_only=True, required=False)

    class Meta:
        model = CustomUser
        fields = (
            'email', 'display_name', 'password', 'confirm_password',
            'birth_date', 'gender', 'artist_name', 'bio', 'genre', 'portfolio'
        )

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match'})
        if CustomUser.objects.filter(email=data['email']).exists():
            raise serializers.ValidationError({'email': 'This email is already registered'})
        return data

    def create(self, validated_data):
        artist_name = validated_data.pop('artist_name')
        bio = validated_data.pop('bio', '')
        genre = validated_data.pop('genre', '')
        portfolio = validated_data.pop('portfolio', None)
        validated_data.pop('confirm_password')
        validated_data['password'] = make_password(validated_data['password'])
        validated_data['role'] = 'artist'
        validated_data['subscription'] = 'gold'
        validated_data['username'] = validated_data['email']
        validated_data['is_verified'] = False

        user = CustomUser.objects.create(**validated_data)

        Artist.objects.create(
            user=user,
            stage_name=artist_name,
            bio=bio,
            genre=genre,
            is_verified=False,
            portfolio=portfolio
        )

        return user


class ArtistRegistrationResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ('id', 'email', 'display_name', 'role', 'subscription', 'is_verified')


class UserProfileSerializer(serializers.ModelSerializer):
    followers_count = serializers.IntegerField(source='followers.count', read_only=True)
    following_count = serializers.IntegerField(source='following.count', read_only=True)
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = (
            'id', 'email', 'display_name', 'username', 'role', 'subscription',
            'avatar', 'bio', 'birth_date', 'gender', 'is_verified',
            'followers_count', 'following_count', 'daily_streams', 'total_streams',
            'is_following', 'created_at'
        )
        read_only_fields = ('id', 'email', 'username', 'role', 'created_at')

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and getattr(request.user, 'is_authenticated', False):
            return obj.followers.filter(id=request.user.id).exists()
        return False


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ('display_name', 'avatar', 'bio', 'birth_date', 'gender')
        read_only_fields = ('id', 'email', 'username', 'role', 'subscription')

    def validate_avatar(self, value):
        user = self.instance
        if not user.subscription_limit.get('can_upload_avatar', False):
            raise serializers.ValidationError('Upgrade your subscription to upload an avatar')
        return value


class FollowSerializer(serializers.Serializer):
    target_user_id = serializers.IntegerField()

    def validate_target_user_id(self, value):
        request = self.context.get('request')
        if request and request.user.id == value:
            raise serializers.ValidationError("You can't follow yourself")
        if not CustomUser.objects.filter(id=value).exists():
            raise serializers.ValidationError('Target user not found')
        return value
