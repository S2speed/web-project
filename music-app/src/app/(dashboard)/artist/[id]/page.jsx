'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { usePlayer } from '@/contexts/PlayerContext';
import { useUser } from '@/contexts/UserContext';
import { followUser, getArtistById, unfollowUser } from '@/lib/mockApi';
import { SUBSCRIPTION_TYPES as SUBSCRIPTIONS } from '@/utils/constants';

function formatNumber(value) {
  return new Intl.NumberFormat('fa-IR').format(Number(value) || 0);
}

function CoverImage({ src, alt, className = '' }) {
  return (
    <div className={`overflow-hidden bg-white/10 ${className}`}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-2xl text-slate-500">♪</div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-center">
      <p className="text-2xl font-black text-emerald-300">{formatNumber(value)}</p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
  );
}

export default function ArtistProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useUser();
  const { playSong } = usePlayer();
  const artistId = params?.id;

  const [artist, setArtist] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowProcessing, setIsFollowProcessing] = useState(false);

  const artistUser = artist?.user || null;
  const followTargetId = artistUser?.id || artist?.userId || null;
  const artistName = artist?.stageName || artistUser?.displayName || 'هنرمند';
  const artistAvatar = artistUser?.avatar || artist?.cover;
  const artistBio = artistUser?.bio || artist?.bio || 'بیوگرافی برای این هنرمند ثبت نشده است.';
  const genres = Array.isArray(artist?.genres) && artist.genres.length ? artist.genres.join('، ') : artist?.genre || 'موسیقی';
  const songs = artist?.songs || [];
  const albums = artist?.albums || [];
  const singles = useMemo(() => songs.filter((song) => song.isSingle || !song.albumId), [songs]);
  const isVerified = artist?.verificationStatus === 'approved' || artistUser?.isVerified;
  const isGoldUser = currentUser?.subscription === SUBSCRIPTIONS.GOLD;
  const followerCount = artistUser?.followers?.length || 0;
  const isOwnArtistProfile = Boolean(currentUser?.id && followTargetId && currentUser.id === followTargetId);

  const stats = useMemo(() => {
    const totalListeners = songs.reduce((sum, song) => sum + (Number(song.listeners) || 0), 0);
    const totalStreams = songs.reduce((sum, song) => sum + (Number(song.playCount) || 0), 0);

    return {
      totalListeners: Math.max(totalListeners, Number(artist?.monthlyListeners) || 0),
      totalStreams,
      averageStreams: songs.length ? Math.round(totalStreams / songs.length) : 0,
    };
  }, [artist?.monthlyListeners, songs]);

  useEffect(() => {
    let isMounted = true;

    const loadArtistData = async () => {
      setIsLoading(true);
      setError('');

      const result = await getArtistById(artistId);

      if (!isMounted) {
        return;
      }

      if (result.success) {
        setArtist(result.data);
        const targetId = result.data.user?.id || result.data.userId || null;
        setIsFollowing(Boolean(targetId && currentUser?.following?.includes(targetId)));
      } else {
        setArtist(null);
        setError(result.error?.message || 'هنرمند پیدا نشد');
      }

      setIsLoading(false);
    };

    if (artistId) {
      loadArtistData();
    }

    return () => {
      isMounted = false;
    };
  }, [artistId, currentUser?.following]);

  const handleFollowToggle = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }

    if (!followTargetId || isOwnArtistProfile) {
      return;
    }

    setIsFollowProcessing(true);
    setError('');

    const result = isFollowing ? await unfollowUser(currentUser.id, followTargetId) : await followUser(currentUser.id, followTargetId);

    if (result.success) {
      setIsFollowing((previous) => !previous);
      setArtist((previous) => {
        if (!previous?.user) {
          return previous;
        }

        const followers = isFollowing
          ? (previous.user.followers || []).filter((id) => id !== currentUser.id)
          : [...(previous.user.followers || []), currentUser.id];

        return { ...previous, user: { ...previous.user, followers } };
      });
    } else {
      setError(result.error?.message || 'خطا در تغییر وضعیت دنبال کردن');
    }

    setIsFollowProcessing(false);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-950" dir="rtl">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-400" />
      </div>
    );
  }

  if (error && !artist) {
    return (
      <div className="min-h-[70vh] bg-slate-950 p-8 text-center text-white" dir="rtl">
        <p className="text-red-300">{error}</p>
        <Link href="/" className="mt-4 inline-block text-emerald-300 hover:underline">
          بازگشت به خانه
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-8">
        {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-l from-cyan-500/20 via-slate-900 to-slate-950 p-5 shadow-2xl shadow-black/30 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-right">
              <CoverImage src={artistAvatar} alt={artistName} className="h-32 w-32 shrink-0 rounded-full border-4 border-cyan-300/40" />
              <div>
                <div className="mb-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <span className="rounded-full bg-cyan-300 px-3 py-1 text-xs font-bold text-slate-950">{genres}</span>
                  {isVerified && (
                    <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
                      نشان هنرمند تایید شده
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-black md:text-4xl">{artistName}</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{artistBio}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 text-center lg:text-right">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4">
                <p className="text-2xl font-black text-cyan-200">{formatNumber(followerCount)}</p>
                <p className="text-sm text-slate-400">دنبال‌کننده</p>
              </div>

              {followTargetId && !isOwnArtistProfile && (
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  disabled={isFollowProcessing}
                  className={`rounded-full px-6 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${isFollowing ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'}`}
                >
                  {isFollowProcessing ? 'در حال پردازش...' : isFollowing ? 'لغو دنبال کردن' : 'دنبال کردن'}
                </button>
              )}
            </div>
          </div>
        </section>

        {isGoldUser ? (
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard label="شنوندگان کلی" value={stats.totalListeners} />
            <StatCard label="کل استریم‌ها" value={stats.totalStreams} />
            <StatCard label="میانگین استریم هر آهنگ" value={stats.averageStreams} />
          </section>
        ) : currentUser ? (
          <section className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-center text-sm leading-6 text-amber-100">
            کاربران طلایی می‌توانند آمار کلی شنوندگان و تعداد استریم‌های این هنرمند را مشاهده کنند.
          </section>
        ) : null}

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">آلبوم‌ها</h2>
            <span className="text-sm text-slate-400">{formatNumber(albums.length)} آلبوم</span>
          </div>

          {albums.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {albums.map((album) => (
                <Link key={album.id} href="/library" className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 transition hover:-translate-y-1 hover:bg-white/10">
                  <CoverImage src={album.cover} alt={album.title} className="mb-3 aspect-square rounded-xl" />
                  <h3 className="truncate font-semibold">{album.title}</h3>
                  <p className="mt-1 truncate text-sm text-slate-400">{album.releaseDate || 'بدون تاریخ انتشار'}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.04] p-6 text-center text-slate-300">
              هنوز آلبومی برای این هنرمند منتشر نشده است.
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">تک‌آهنگ‌ها</h2>
            <span className="text-sm text-slate-400">{formatNumber(singles.length)} تک‌آهنگ</span>
          </div>

          {singles.length ? (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05]">
              {singles.map((song) => (
                <div key={song.id} className="flex items-center gap-3 border-b border-white/10 p-4 last:border-b-0">
                  <CoverImage src={song.cover} alt={song.title} className="h-14 w-14 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{song.title}</p>
                    <p className="truncate text-sm text-slate-400">{song.genre || genres} • {song.releaseDate || 'بدون تاریخ'}</p>
                  </div>
                  {isGoldUser && (
                    <div className="hidden text-left text-sm text-slate-400 sm:block">
                      <p>{formatNumber(song.playCount)} استریم</p>
                      <p className="text-xs">{formatNumber(song.listeners)} شنونده</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => playSong(song)}
                    className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
                  >
                    پخش
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.04] p-6 text-center text-slate-300">
              هنوز تک‌آهنگی برای این هنرمند منتشر نشده است.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
