'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { followUser, getAllAlbums, getAllSongs, getArtistById, unfollowUser } from '@/lib/mockApi';
import { SUBSCRIPTION_TYPES as SUBSCRIPTIONS } from '@/utils/constants';

export default function ArtistProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useUser();
  const artistId = params?.id;

  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowProcessing, setIsFollowProcessing] = useState(false);

  const isGoldUser = currentUser?.subscription === SUBSCRIPTIONS.GOLD;
  const followTargetId = artist?.user?.id || artist?.userId || null;
  const followerCount = artist?.user?.followers?.length ?? artist?.followers?.length ?? 0;
  const genreLabel = Array.isArray(artist?.genres) && artist.genres.length > 0 ? artist.genres.join('، ') : artist?.genre || 'هنرمند';

  useEffect(() => {
    let isMounted = true;

    const loadArtistData = async () => {
      setIsLoading(true);
      setError('');

      const artistResult = await getArtistById(artistId);

      if (!isMounted) {
        return;
      }

      if (!artistResult.success) {
        setError('هنرمند پیدا نشد');
        setArtist(null);
        setSongs([]);
        setAlbums([]);
        setIsLoading(false);
        return;
      }

      const nextArtist = artistResult.data;
      setArtist(nextArtist);

      const resolvedArtistId = nextArtist.id;

      const songsResult = await getAllSongs({ artistId: resolvedArtistId });
      if (!isMounted) {
        return;
      }
      if (songsResult.success) {
        setSongs(songsResult.data);
      } else {
        setSongs([]);
      }

      const albumsResult = await getAllAlbums();
      if (!isMounted) {
        return;
      }
      if (albumsResult.success) {
        setAlbums(albumsResult.data.filter((album) => album.artistId === resolvedArtistId));
      } else {
        setAlbums([]);
      }

      if (currentUser) {
        setIsFollowing(followTargetId ? currentUser.following?.includes(followTargetId) || false : false);
      } else {
        setIsFollowing(false);
      }

      setIsLoading(false);
    };

    if (artistId) {
      loadArtistData();
    }

    return () => {
      isMounted = false;
    };
  }, [artistId, currentUser, followTargetId]);

  const handleFollowToggle = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }

    if (!followTargetId) {
      return;
    }

    setIsFollowProcessing(true);

    const result = isFollowing ? await unfollowUser(currentUser.id, followTargetId) : await followUser(currentUser.id, followTargetId);

    if (result.success) {
      setIsFollowing((prev) => !prev);
      setArtist((prev) => {
        if (!prev) {
          return prev;
        }

        const nextFollowers = isFollowing
            ? (prev.user?.followers || prev.followers || []).filter((id) => id !== currentUser.id)
            : [...(prev.user?.followers || prev.followers || []), currentUser.id];

        return {
          ...prev,
          user: prev.user ? { ...prev.user, followers: nextFollowers } : prev.user,
          followers: prev.followers ? nextFollowers : prev.followers,
        };
      });
    }

    setIsFollowProcessing(false);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-green-500" />
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error || 'هنرمند پیدا نشد'}</p>
        <Link href="/" className="mt-4 inline-block text-green-600 hover:underline">
          بازگشت به خانه
        </Link>
      </div>
    );
  }

  const totalListeners = songs.reduce((sum, song) => sum + (Number(song.listeners) || 0), 0);
  const totalStreams = songs.reduce((sum, song) => sum + (Number(song.playCount) || 0), 0);
  const singles = songs.filter((song) => song.isSingle);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8 rounded-2xl bg-gradient-to-r from-green-600 to-blue-600 p-8 text-white shadow-lg">
        <div className="flex flex-col items-center gap-6 md:flex-row">
          <div className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-full bg-white/20">
            {artist.avatar ? (
              <img src={artist.avatar} alt={artist.displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl">{artist.displayName?.[0]?.toUpperCase() || 'A'}</div>
            )}
          </div>

          <div className="flex-1 text-center md:text-right">
            <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <h1 className="text-3xl font-bold">{artist.displayName}</h1>
              {artist.isVerified && (
                <span className="flex items-center gap-1 rounded-full bg-yellow-400 px-3 py-1 text-sm font-bold text-black">
                  ✓ تایید شده
                </span>
              )}
            </div>
            <p className="mt-1 text-white/80">{genreLabel}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm md:justify-start">
              <span>🎵 {songs.length} آهنگ</span>
              <span>💿 {albums.length} آلبوم</span>
              <span>👥 {followerCount} دنبال‌کننده</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {followTargetId && currentUser && currentUser.id !== followTargetId && (
              <button
                type="button"
                onClick={handleFollowToggle}
                disabled={isFollowProcessing}
                className={`rounded-full px-6 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isFollowing ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white text-green-600 hover:bg-gray-100'
                }`}
              >
                {isFollowProcessing ? 'در حال پردازش...' : isFollowing ? 'لغو دنبال کردن' : 'دنبال کردن'}
              </button>
            )}
          </div>
        </div>

        {artist.bio && (
          <div className="mt-6 border-t border-white/20 pt-4">
            <p className="leading-relaxed text-white/90">{artist.bio}</p>
          </div>
        )}
      </div>

      {isGoldUser && (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 text-center shadow-md">
            <p className="text-2xl font-bold text-green-600">{totalListeners}</p>
            <p className="text-sm text-gray-500">شنوندگان منحصربه‌فرد</p>
          </div>
          <div className="rounded-2xl bg-white p-4 text-center shadow-md">
            <p className="text-2xl font-bold text-green-600">{totalStreams}</p>
            <p className="text-sm text-gray-500">کل استریم‌ها</p>
          </div>
          <div className="rounded-2xl bg-white p-4 text-center shadow-md">
            <p className="text-2xl font-bold text-green-600">{songs.length > 0 ? Math.round(totalStreams / songs.length) : 0}</p>
            <p className="text-sm text-gray-500">میانگین استریم در هر آهنگ</p>
          </div>
        </div>
      )}

      {!isGoldUser && currentUser && (
        <div className="mb-8 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-center">
          <p className="text-yellow-800">
            ⭐ برای مشاهده آمار دقیق شنوندگان و استریم‌ها،{' '}
            <Link href="/settings" className="font-semibold text-green-600 hover:underline">
              اشتراک خود را به طلایی ارتقا دهید
            </Link>
          </p>
        </div>
      )}

      {albums.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">آلبوم‌ها</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {albums.map((album) => (
              <Link
                key={album.id}
                href={`/library/album/${album.id}`}
                className="group overflow-hidden rounded-2xl bg-white shadow-md transition hover:shadow-lg"
              >
                <div className="relative aspect-square bg-gray-200">
                  {album.cover ? (
                    <img src={album.cover} alt={album.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-300 to-gray-400 text-4xl">💿</div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="truncate text-sm font-semibold">{album.title}</h3>
                  <p className="text-xs text-gray-500">{album.releaseDate}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {singles.length > 0 ? (
        <div>
          <h2 className="mb-4 text-2xl font-bold text-gray-900">تک‌آهنگ‌ها</h2>
          <div className="overflow-hidden rounded-2xl bg-white shadow-md">
            <div className="divide-y">
              {singles.map((song) => (
                <div key={song.id} className="flex items-center gap-4 p-4 transition hover:bg-gray-50">
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-gray-200">
                    {song.cover ? <img src={song.cover} alt={song.title} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xl">🎵</div>}
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link href={`/player/${song.id}`}>
                      <p className="truncate font-medium transition hover:text-green-600">{song.title}</p>
                    </Link>
                    <p className="truncate text-sm text-gray-500">{song.genre} • {song.releaseDate}</p>
                  </div>

                  {isGoldUser && (
                    <div className="text-right text-sm text-gray-500">
                      <p>{Number(song.playCount) || 0} استریم</p>
                      <p className="text-xs">{Number(song.listeners) || 0} شنونده</p>
                    </div>
                  )}

                  <button type="button" className="text-2xl text-green-600 transition hover:text-green-700">
                    ▶️
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-8 text-center text-gray-500 shadow-md">
          <p className="text-lg">هیچ تک‌آهنگی منتشر نشده است</p>
        </div>
      )}
    </div>
  );
}
