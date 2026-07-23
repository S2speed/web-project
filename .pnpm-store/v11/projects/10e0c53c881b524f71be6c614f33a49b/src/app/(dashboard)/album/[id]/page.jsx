'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePlayer } from '@/contexts/PlayerContext';
import { useUser } from '@/contexts/UserContext';
import { addSongToPlaylist, getAlbumById, getUserPlaylists, removeSongFromPlaylist } from '@/lib/mockApi';
import { DEFAULT_COVER } from '@/utils/constants';

export default function AlbumPage() {
  const { id } = useParams();
  const { user } = useUser();
  const { playSong } = usePlayer();
  const [album, setAlbum] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [openSong, setOpenSong] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      getAlbumById(id),
      user?.id ? getUserPlaylists(user.id) : Promise.resolve({ success: true, data: [] }),
    ]).then(([albumResult, playlistResult]) => {
      if (!active) return;
      if (albumResult.success) setAlbum(albumResult.data);
      if (playlistResult.success) setPlaylists(playlistResult.data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [id, user?.id]);

  const togglePlaylist = async (playlist, songId) => {
    const containsSong = playlist.songIds?.includes(songId);
    const result = containsSong
      ? await removeSongFromPlaylist(playlist.id, songId)
      : await addSongToPlaylist(playlist.id, songId);
    setNotice(
      result.success
        ? containsSong ? 'آهنگ از پلی‌لیست حذف شد.' : 'آهنگ به پلی‌لیست اضافه شد.'
        : result.error?.message || 'خطا در مدیریت پلی‌لیست',
    );
    if (result.success) {
      setPlaylists((previous) => previous.map((item) => item.id === playlist.id ? result.data : item));
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-300">در حال دریافت آلبوم...</div>;
  if (!album) return <div className="p-10 text-center text-rose-300">آلبوم پیدا نشد.</div>;

  const artist = album.songs?.[0]?.artist;
  const artistName = artist?.stageName || artist?.user?.displayName || 'هنرمند';
  const totalListeners = album.songs.reduce((sum, song) => sum + (Number(song.listeners) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-col gap-6 rounded-3xl border border-violet-300/20 bg-gradient-to-l from-violet-500/20 to-slate-900 p-6 md:flex-row md:items-end md:p-8">
          <div className="aspect-square w-full max-w-64 overflow-hidden rounded-3xl bg-white/10">
            <img
              src={album.cover || DEFAULT_COVER}
              alt={album.title}
              onError={(event) => {
                event.currentTarget.src = DEFAULT_COVER;
              }}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-violet-200">آلبوم</p>
            <h1 className="mt-2 text-4xl font-black md:text-5xl">{album.title}</h1>
            <Link href={`/artist/${album.artistId}`} className="mt-3 inline-block text-lg text-violet-200 hover:text-white">{artistName}</Link>
            <p className="mt-3 text-sm text-slate-400">{album.genre || 'موسیقی'} • {album.releaseDate || 'بدون تاریخ'} • {album.songs.length.toLocaleString('fa-IR')} قطعه • {totalListeners.toLocaleString('fa-IR')} شنونده</p>
            {album.description && <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{album.description}</p>}
            <button type="button" disabled={!album.songs.length} onClick={() => playSong(album.songs[0], album.songs)} className="mt-6 rounded-full bg-violet-300 px-6 py-3 font-bold text-slate-950 disabled:opacity-40">پخش آلبوم</button>
          </div>
        </header>

        {notice && <div className="rounded-2xl bg-emerald-400/10 p-4 text-sm text-emerald-100">{notice}</div>}

        <section className="overflow-visible rounded-3xl border border-white/10 bg-white/5">
          {album.songs.map((song, index) => (
            <article key={song.id} className="relative flex items-center gap-3 border-b border-white/10 p-4 last:border-0">
              <button type="button" onClick={() => playSong(song, album.songs)} className="w-8 text-slate-500">{index + 1}</button>
              <button type="button" onClick={() => playSong(song, album.songs)} className="min-w-0 flex-1 text-right">
                <strong className="block truncate">{song.title}</strong>
                <span className="text-xs text-slate-400">{artistName} • {Number(song.listeners || 0).toLocaleString('fa-IR')} شنونده</span>
              </button>
              <span className="hidden text-sm text-slate-500 sm:block">{Math.floor((song.duration || 0) / 60)}:{String((song.duration || 0) % 60).padStart(2, '0')}</span>
              <button type="button" onClick={() => setOpenSong(openSong === song.id ? '' : song.id)} className="rounded-xl bg-white/10 px-3 py-2 text-sm">پلی‌لیست</button>
              {openSong === song.id && (
                <div className="absolute left-4 top-14 z-20 w-64 rounded-2xl border border-white/10 bg-slate-900 p-3 shadow-2xl">
                  {playlists.length ? playlists.map((playlist) => (
                    <button key={playlist.id} type="button" onClick={() => togglePlaylist(playlist, song.id)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-right text-sm hover:bg-white/10">
                      <span className="truncate">{playlist.name}</span>
                      <span className={playlist.songIds?.includes(song.id) ? 'text-emerald-300' : 'text-slate-500'}>
                        {playlist.songIds?.includes(song.id) ? 'حذف' : 'افزودن'}
                      </span>
                    </button>
                  )) : <Link href="/playlists" className="block rounded-xl bg-violet-300 px-3 py-2 text-center text-sm font-bold text-slate-950">ایجاد پلی‌لیست</Link>}
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
