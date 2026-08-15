from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from apps.users.models import CustomUser
from apps.music.models import Artist, Album, Song, Playlist
from apps.payments.models import SubscriptionPrice


class Command(BaseCommand):
    help = 'Seed database with initial data for development'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding database...')

        users_data = [
            {
                'email': 'admin@music.com',
                'display_name': 'Admin',
                'role': 'admin',
                'subscription': 'gold',
                'is_superuser': True,
                'is_staff': True,
                'is_verified': True,
            },
            {
                'email': 'support@music.com',
                'display_name': 'Support One',
                'role': 'support',
                'subscription': 'gold',
                'is_verified': True,
            },
            {
                'email': 'reza@music.com',
                'display_name': 'Reza',
                'role': 'artist',
                'subscription': 'gold',
                'is_verified': True,
                'bio': 'Sample artist',
                'genre': 'pop',
            },
            {
                'email': 'ahmad@music.com',
                'display_name': 'Ahmad',
                'role': 'listener',
                'subscription': 'free',
            },
            {
                'email': 'sara@music.com',
                'display_name': 'Sara',
                'role': 'listener',
                'subscription': 'gold',
            },
        ]

        created_users = []
        for data in users_data:
            password = data.pop('password', 'Test123!')
            user, created = CustomUser.objects.get_or_create(
                email=data['email'],
                defaults={
                    **data,
                    'password': make_password(password),
                }
            )
            created_users.append(user)
            self.stdout.write(f"{'✅' if created else '⏳'} user: {user.email}")

        artist_users = CustomUser.objects.filter(role='artist')
        for user in artist_users:
            artist, created = Artist.objects.get_or_create(
                user=user,
                defaults={
                    'stage_name': user.display_name,
                    'bio': user.bio or '',
                    'genre': user.genre or '',
                    'is_verified': user.is_verified,
                }
            )
            self.stdout.write(f"{'✅' if created else '⏳'} artist: {artist.stage_name}")

        artist = Artist.objects.first()
        if artist:
            album, created = Album.objects.get_or_create(
                title='Sample Album',
                artist=artist,
                defaults={
                    'release_date': timezone.now().date(),
                    'genre': 'pop',
                    'description': 'Sample album for testing',
                    'is_single': False,
                }
            )
            self.stdout.write(f"{'✅' if created else '⏳'} album: {album.title}")

            song_titles = ['Song One', 'Song Two', 'Song Three']
            for title in song_titles:
                song, created = Song.objects.get_or_create(
                    title=title,
                    artist=artist,
                    album=album,
                    defaults={
                        'duration': 180,
                        'genre': 'pop',
                        'release_date': timezone.now().date(),
                        'audio_file': 'songs/placeholder.mp3',
                        'audio_file_low': 'songs/low/placeholder-low.mp3',
                        'is_single': False,
                    }
                )
                self.stdout.write(f"{'✅' if created else '⏳'} song: {song.title}")

        prices_data = [
            {'subscription_type': 'silver', 'price': 50000, 'duration_days': 30},
            {'subscription_type': 'gold', 'price': 100000, 'duration_days': 30},
        ]
        for data in prices_data:
            price, created = SubscriptionPrice.objects.get_or_create(
                subscription_type=data['subscription_type'],
                defaults=data
            )
            self.stdout.write(f"{'✅' if created else '⏳'} price: {price.subscription_type} - {price.price}")

        self.stdout.write(self.style.SUCCESS('✅ Seed data created'))
