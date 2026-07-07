'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import {
  canCreatePlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylistById,
  getUserPlaylists,
  renamePlaylist,
} from '@/lib/mockApi';
import { SUBSCRIPTION_TYPES as SUBSCRIPTIONS } from '@/utils/constants';

const subscriptionLabels = {
  [SUBSCRIPTIONS.FREE]: 'پایه',
  [SUBSCRIPTIONS.SILVER]: 'نقره‌ای',
  [SUBSCRIPTIONS.GOLD]: 'طلایی',
};

function formatNumber(value) {
  return new Intl.NumberFormat('fa-IR').format(Number(value) || 0);
}

function limitText(limitInfo) {
  if (!limitInfo) {
    return 'در حال بررسی محدودیت...';
  }

  if (limitInfo.subscription === SUBSCRIPTIONS.GOLD) {
    return 'اشتراک طلایی: ساخت پلی‌لیست نامحدود';
  }

  return `اشتراک ${subscriptionLabels[limitInfo.subscription] || 'پایه'}: ${formatNumber(limitInfo.currentCount)} از ${formatNumber(limitInfo.limit)} پلی‌لیست`;
}

function SongPreview({ song }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl bg-white/[0.04] p-2">
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white/10">
        {song.cover ? <img src={song.cover} alt={song.title} className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-white">{song.title}</p>
        <p className="truncate text-[11px] text-slate-400">{song.artist?.stageName || song.artist?.user?.displayName || 'هنرمند'}</p>
      </div>
    </div>
  );
}

export default function PlaylistsPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const [playlists, setPlaylists] = useState([]);
  const [limitInfo, setLimitInfo] = useState(null);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadPlaylists = async () => {
    if (!user?.id) {
      setIsDataLoading(false);
      return;
    }

    setIsDataLoading(true);
    setError('');

    const [playlistResult, limitResult] = await Promise.all([getUserPlaylists(user.id), canCreatePlaylist(user.id)]);

    if (playlistResult.success) {
      const detailedPlaylists = await Promise.all(
        playlistResult.data.map(async (playlist) => {
          const result = await getPlaylistById(playlist.id);
          return result.success ? result.data : { ...playlist, songs: [] };
        }),
      );
      setPlaylists(detailedPlaylists);
    } else {
      setError(playlistResult.error?.message || 'خطا در دریافت پلی‌لیست‌ها');
    }

    if (limitResult.success) {
      setLimitInfo(limitResult.data);
    }

    setIsDataLoading(false);
  };

  useEffect(() => {
    loadPlaylists();
  }, [user?.id]);

  const totalSongs = useMemo(() => playlists.reduce((sum, playlist) => sum + (playlist.songIds?.length || 0), 0), [playlists]);

  const handleCreate = async (event) => {
    event.preventDefault();

    if (!user?.id) {
      router.push('/login');
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    const result = await createPlaylist(user.id, newName);

    if (result.success) {
      setNewName('');
      setNotice('پلی‌لیست جدید ساخته شد');
      await loadPlaylists();
    } else {
      setError(result.error?.message || 'خطا در ایجاد پلی‌لیست');
    }

    setIsSaving(false);
  };

  const startRename = (playlist) => {
    setEditingId(playlist.id);
    setEditingName(playlist.name);
    setError('');
    setNotice('');
  };

  const handleRename = async (event) => {
    event.preventDefault();

    if (!editingId) {
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');

    const result = await renamePlaylist(editingId, editingName);

    if (result.success) {
      setPlaylists((previous) => previous.map((playlist) => (playlist.id === editingId ? { ...playlist, ...result.data } : playlist)));
      setEditingId(null);
      setEditingName('');
      setNotice('نام پلی‌لیست تغییر کرد');
    } else {
      setError(result.error?.message || 'خطا در تغییر نام پلی‌لیست');
    }

    setIsSaving(false);
  };

  const handleDelete = async (playlistId) => {
    setIsSaving(true);
    setError('');
    setNotice('');

    const result = await deletePlaylist(playlistId);

    if (result.success) {
      setNotice('پلی‌لیست حذف شد');
      await loadPlaylists();
    } else {
      setError(result.error?.message || 'خطا در حذف پلی‌لیست');
    }

    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-950" dir="rtl">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[70vh] bg-slate-950 p-8 text-center text-white" dir="rtl">
        <p className="text-slate-300">برای مدیریت پلی‌لیست‌ها ابتدا وارد حساب شوید.</p>
        <Link href="/login" className="mt-4 inline-block rounded-full bg-emerald-400 px-5 py-2 text-sm font-bold text-slate-950">
          ورود
        </Link>
      </div>
    );
  }

  const canCreate = Boolean(limitInfo?.allowed);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-l from-emerald-500/20 via-slate-900 to-slate-950 p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm text-emerald-200">پلی‌لیست‌ها</p>
              <h1 className="mt-2 text-3xl font-black md:text-4xl">مدیریت لیست‌های پخش</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                پلی‌لیست بسازید، نام آن را تغییر دهید، حذف کنید و آهنگ‌های اضافه‌شده به هر لیست را در کارت آن ببینید.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
                <p className="text-2xl font-black text-emerald-300">{formatNumber(playlists.length)}</p>
                <p className="text-xs text-slate-400">پلی‌لیست</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
                <p className="text-2xl font-black text-emerald-300">{formatNumber(totalSongs)}</p>
                <p className="text-xs text-slate-400">آهنگ</p>
              </div>
              <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 sm:col-span-1">
                <p className="text-sm font-bold text-emerald-200">{subscriptionLabels[user.subscription] || 'پایه'}</p>
                <p className="text-xs text-slate-400">اشتراک</p>
              </div>
            </div>
          </div>
        </header>

        {(error || notice) && (
          <div className={`rounded-2xl border p-4 text-sm ${error ? 'border-red-400/30 bg-red-500/10 text-red-100' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'}`}>
            {error || notice}
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <form onSubmit={handleCreate} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
            <h2 className="text-xl font-bold">ایجاد پلی‌لیست</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{limitText(limitInfo)}</p>
            {limitInfo && !limitInfo.allowed && (
              <p className="mt-2 text-sm leading-6 text-amber-100">به سقف اشتراک فعلی رسیده‌اید. برای ساخت لیست‌های بیشتر، اشتراک را ارتقا دهید.</p>
            )}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="نام پلی‌لیست جدید"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-emerald-300"
              />
              <button
                type="submit"
                disabled={isSaving || !canCreate}
                className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ایجاد
              </button>
            </div>
          </form>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
            <h2 className="text-xl font-bold">محدودیت اشتراک‌ها</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-300">پایه: حداکثر ۶ پلی‌لیست</div>
              <div className="rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-300">نقره‌ای: حداکثر ۱۰۰ پلی‌لیست</div>
              <div className="rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-300">طلایی: نامحدود</div>
            </div>
          </div>
        </section>

        <section>
          {isDataLoading ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-300">در حال دریافت پلی‌لیست‌ها...</div>
          ) : playlists.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {playlists.map((playlist) => (
                <article key={playlist.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.05]">
                  {editingId === playlist.id ? (
                    <form onSubmit={handleRename} className="mb-4 flex gap-2">
                      <input
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white outline-none focus:border-emerald-300"
                      />
                      <button type="submit" disabled={isSaving} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">
                        ذخیره
                      </button>
                    </form>
                  ) : (
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-bold">{playlist.name}</h3>
                        <p className="mt-1 text-sm text-slate-400">{formatNumber(playlist.songIds?.length)} آهنگ</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => startRename(playlist)} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15">
                          تغییر نام
                        </button>
                        <button type="button" onClick={() => handleDelete(playlist.id)} disabled={isSaving} className="rounded-xl bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-500/25 disabled:opacity-50">
                          حذف
                        </button>
                      </div>
                    </div>
                  )}

                  {playlist.songs?.length ? (
                    <div className="space-y-2">
                      {playlist.songs.slice(0, 4).map((song) => (
                        <SongPreview key={song.id} song={song} />
                      ))}
                      {playlist.songs.length > 4 && <p className="pt-1 text-xs text-slate-500">+ {formatNumber(playlist.songs.length - 4)} آهنگ دیگر</p>}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-5 text-center text-sm text-slate-400">
                      هنوز آهنگی به این پلی‌لیست اضافه نشده است.
                    </div>
                  )}

                  <Link href="/library" className="mt-4 inline-flex w-full justify-center rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15">
                    افزودن آهنگ از کتابخانه
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
              <p className="text-xl font-bold text-white">هنوز پلی‌لیستی ندارید</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">اولین پلی‌لیست خود را بسازید تا آهنگ‌ها را در کارت آن ببینید.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
