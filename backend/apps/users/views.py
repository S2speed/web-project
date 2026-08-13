"""Authentication views for users app (JWT)."""
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import status

from .serializers import (
    LoginSerializer, UserSerializer,
    RegisterSerializer, RegisterArtistSerializer,
    UserProfileSerializer, UserUpdateSerializer, FollowSerializer,
    AppSettingsSerializer, DeleteAccountSerializer,
)
from apps.support.services import get_user_settings, notify_users


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserSerializer(user).data,
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RefreshTokenView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            refresh = request.data.get('refresh')
            token = RefreshToken(refresh)
            return Response({'access': str(token.access_token)})
        except Exception:
            return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh = request.data.get('refresh')
            token = RefreshToken(refresh)
            token.blacklist()
            return Response({'message': 'Successfully logged out'})
        except Exception:
            return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)


class UserMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                'message': 'Registration successful',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'display_name': user.display_name,
                    'role': user.role,
                    'subscription': user.subscription
                }
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RegisterArtistView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterArtistSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            staff_users = user.__class__.objects.filter(
                Q(role__in=('admin', 'support')) | Q(is_superuser=True),
            ).distinct()
            notify_users(
                staff_users,
                type='verification',
                title='New artist verification request',
                message=f'{user.display_name} submitted a new artist application.',
                link='/admin/dashboard',
                dedupe_key=f'artist-application:{user.artist_profile.id}',
            )
            return Response({
                'message': 'Artist registration submitted and pending verification',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'display_name': user.display_name,
                    'role': user.role,
                    'subscription': user.subscription,
                    'is_verified': user.is_verified
                }
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        user = get_object_or_404(request.user.__class__, id=user_id)
        serializer = UserProfileSerializer(user, context={'request': request})
        return Response(serializer.data)


class UpdateProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        serializer = UserUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response({
                'message': 'Profile updated successfully',
                'user': serializer.data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class FollowUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = FollowSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            target_user = get_object_or_404(request.user.__class__, id=serializer.validated_data['target_user_id'])

            if request.user.following.filter(id=target_user.id).exists():
                return Response({'error': 'Already following this user'}, status=status.HTTP_400_BAD_REQUEST)

            request.user.following.add(target_user)

            return Response({
                'message': f'Successfully followed {target_user.display_name}',
                'following_count': request.user.following.count()
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UnfollowUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = FollowSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            target_user = get_object_or_404(request.user.__class__, id=serializer.validated_data['target_user_id'])

            if not request.user.following.filter(id=target_user.id).exists():
                return Response({'error': 'You are not following this user'}, status=status.HTTP_400_BAD_REQUEST)

            request.user.following.remove(target_user)

            return Response({
                'message': f'Unfollowed {target_user.display_name}',
                'following_count': request.user.following.count()
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserFollowersView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        user = get_object_or_404(request.user.__class__, id=user_id)
        followers = user.followers.all()
        serializer = UserProfileSerializer(followers, many=True, context={'request': request})
        return Response({'count': followers.count(), 'results': serializer.data})


class UserFollowingView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        user = get_object_or_404(request.user.__class__, id=user_id)
        following = user.following.all()
        serializer = UserProfileSerializer(following, many=True, context={'request': request})
        return Response({'count': following.count(), 'results': serializer.data})


class AppSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings_obj = get_user_settings(request.user)
        return Response(AppSettingsSerializer(settings_obj).data)

    def patch(self, request):
        settings_obj = get_user_settings(request.user)
        serializer = AppSettingsSerializer(
            settings_obj,
            data=request.data,
            partial=True,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        serializer = DeleteAccountSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
