'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import { usePlayer } from '@/contexts/PlayerContext';
import {
  getLatestAlbums,
  getNewReleases,
  getTrendingSongs,
  getUserPlaylists,
} from '@/lib/mockApi';
import { SUBSCRIPTION_TYPES } from '@/utils/constants';

const subscriptionLabels = {
  [SUBSCRIPTION_TYPES.FREE]: 'پایه',
  [SUBSCRIPTION_TYPES.SILVER]: 'نقره‌ای',
  [SUBSCRIPTION_TYPES.GOLD]: 'طلایی',
};

function formatNumber(value) {
  return new Intl.NumberFormat('fa-IR').format(Number(value) || 0);
}

function SectionHeader({ title, href, action }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      {href ? (
        <Link href={href} className="text-sm font-medium text-emerald-300 transition hover:text-emerald-200">
          {action || 'مشاهده همه'}
        </Link>
      ) : null}
    </div>
  );
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

export default function HomePage() {
  const { user, isLoading } = useUser();
  const { playSong } = usePlayer();
  const [homeData, setHomeData] = useState({
    playlists: [],
    albums: [],
    trendingSongs: [],
    newReleases: [],
  });
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadHomeData = async () => {
      setIsDataLoading(true);

      const [playlistResult, albumResult, trendingResult, releaseResult] = await Promise.all([
        user?.id ? getUserPlaylists(user.id) : Promise.resolve({ success: true, data: [] }),
        getLatestAlbums(6),
        getTrendingSongs(6),
        getNewReleases(6),
      ]);

      if (!isMounted) {
        return;
      }

      setHomeData({
        playlists: playlistResult.success ? playlistResult.data : [],
        albums: albumResult.success ? albumResult.data : [],
        trendingSongs: trendingResult.success ? trendingResult.data : [],
        newReleases: releaseResult.success ? releaseResult.data : [],
      });
      setIsDataLoading(false);
    };

    loadHomeData();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const earlyAccess = useMemo(() => homeData.newReleases.slice(0, 3), [homeData.newReleases]);
  const displayName = user?.displayName || 'شنونده مهمان';
  const subscription = user?.subscription || SUBSCRIPTION_TYPES.FREE;
  const isGold = subscription === SUBSCRIPTION_TYPES.GOLD;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8" dir="rtl">
        <div className="animate-pulse space-y-6">
          <div className="h-40 rounded-2xl bg-white/10" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-32 rounded-2xl bg-white/10" />
            <div className="h-32 rounded-2xl bg-white/10" />
            <div className="h-32 rounded-2xl bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8" dir="rtl">
      <section className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-l from-emerald-500/25 via-slate-900 to-slate-950 p-5 shadow-2xl shadow-emerald-950/20 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <CoverImage src={user?.avatar} alt={displayName} className="h-20 w-20 rounded-full ring-2 ring-emerald-300/60 md:h-24 md:w-24" />
            <div>
              <p className="text-sm text-emerald-200">خوش برگشتی</p>
              <h1 className="mt-1 text-3xl font-black md:text-4xl">{displayName}</h1>
              <p className="mt-2 text-sm text-slate-300">اشتراک {subscriptionLabels[subscription] || 'پایه'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-2xl font-bold text-emerald-200">{formatNumber(homeData.playlists.length)}</p>
              <p className="mt-1 text-xs text-slate-300">پلی‌لیست</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-2xl font-bold text-emerald-200">{formatNumber(user?.dailyStreams)}</p>
              <p className="mt-1 text-xs text-slate-300">استریم امروز</p>
            </div>
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/10 p-4 md:col-span-1">
              <p className="text-2xl font-bold text-emerald-200">{formatNumber(user?.followers?.length)}</p>
              <p className="mt-1 text-xs text-slate-300">دنبال‌کننده</p>
            </div>
          </div>
        </div>
      </section>

      {isDataLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-slate-300">در حال آماده‌سازی خانه...</div>
      ) : (
        <div className="space-y-10">
          <section>
            <SectionHeader title="آخرین پلی‌لیست‌های شنیده‌شده" href="/playlists" />
            {homeData.playlists.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {homeData.playlists.slice(0, 4).map((playlist) => (
                  <Link key={playlist.id} href="/playlists" className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:-translate-y-1 hover:bg-white/10">
                    <CoverImage src={playlist.cover} alt={playlist.name} className="mb-4 aspect-square rounded-2xl" />
                    <h3 className="truncate font-semibold">{playlist.name}</h3>
                    <p className="mt-1 text-sm text-slate-400">{formatNumber(playlist.songIds?.length)} آهنگ</p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-center text-slate-300">
                هنوز پلی‌لیستی ندارید. از بخش پلی‌لیست‌ها اولین لیست پخش خود را بسازید.
              </div>
            )}
          </section>

          <section>
            <SectionHeader title="آخرین آلبوم‌های منتشرشده" href="/library" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {homeData.albums.map((album) => (
                <Link key={album.id} href="/library" className="rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:-translate-y-1 hover:bg-white/10">
                  <CoverImage src={album.cover} alt={album.title} className="mb-3 aspect-square rounded-xl" />
                  <h3 className="truncate text-sm font-semibold">{album.title}</h3>
                  <p className="mt-1 truncate text-xs text-slate-400">{album.genre || 'موسیقی'}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <div>
              <SectionHeader title="آهنگ‌های پرشنونده" href="/library" />
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                {homeData.trendingSongs.map((song, index) => (
                  <div key={song.id} className="flex items-center gap-3 border-b border-white/10 p-3 last:border-b-0">
                    <span className="w-8 text-center text-sm text-slate-400">{formatNumber(index + 1)}</span>
                    <CoverImage src={song.cover} alt={song.title} className="h-12 w-12 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{song.title}</p>
                      <p className="truncate text-sm text-slate-400">{song.artist?.stageName || song.artist?.user?.displayName || 'هنرمند'}</p>
                    </div>
                    <span className="hidden text-sm text-slate-400 sm:inline">{formatNumber(song.playCount)} پخش</span>
                    <button
                      type="button"
                      onClick={() => playSong(song)}
                      className="rounded-full bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                    >
                      پخش
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5">
              <SectionHeader title="دسترسی زودهنگام طلایی" href="/settings" action={isGold ? 'مدیریت اشتراک' : 'ارتقا'} />
              <p className="mb-4 text-sm leading-6 text-amber-100/85">
                {isGold ? 'به عنوان کاربر طلایی، آثار جدید را زودتر از دیگران می‌بینید.' : 'این بخش برای نمایش مزیت کاربران طلایی در صفحه خانه آماده شده است.'}
              </p>
              <div className="space-y-3">
                {earlyAccess.map((song) => (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => playSong(song)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-right transition hover:bg-white/10"
                  >
                    <CoverImage src={song.cover} alt={song.title} className="h-11 w-11 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{song.title}</span>
                      <span className="block truncate text-xs text-amber-100/70">انتشار جدید</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
