'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePlayer } from '@/contexts/PlayerContext';
import { useUser } from '@/contexts/UserContext';
import {
  addSongToPlaylist,
  getAllAlbums,
  getAllArtists,
  getAllSongs,
  getPlaylistById,
  getUserPlaylists,
  removeSongFromPlaylist,
} from '@/lib/mockApi';
import { LIBRARY_SORT_OPTIONS } from '@/utils/constants';
import { buildLibraryAlbums, filterAndSortAlbums, filterAndSortSingles, getArtistName } from '@/utils/library';

function formatNumber(value) {
  return new Intl.NumberFormat('fa-IR').format(Number(value) || 0);
}

function CoverImage({ src, alt, className = '' }) {
  return (
    <div className={`overflow-hidden bg-white/10 ${className}`}>
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl text-slate-500">♪</div>}
    </div>
  );
}

export default function LibraryPage() {
  const { user, isLoading } = useUser();
  const { playSong } = usePlayer();
  const [songs, setSongs] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [artists, setArtists] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState(LIBRARY_SORT_OPTIONS.RELEASE_DATE);
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);
  const [openMenuSongId, setOpenMenuSongId] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isDataLoading, setIsDataLoading] = useState(true);

  const loadLibrary = async () => {
    setIsDataLoading(true);
    setError('');

    const [songsResult, albumsResult, artistsResult, playlistsResult] = await Promise.all([
      getAllSongs(),
      getAllAlbums(),
      getAllArtists(),
      user?.id ? getUserPlaylists(user.id) : Promise.resolve({ success: true, data: [] }),
    ]);

    if (songsResult.success) {
      setSongs(songsResult.data);
    }

    if (artistsResult.success) {
      setArtists(artistsResult.data);
    }

    if (albumsResult.success) {
      setAlbums(albumsResult.data);
    }

    if (playlistsResult.success) {
      const detailedPlaylists = await Promise.all(
        playlistsResult.data.map(async (playlist) => {
          const result = await getPlaylistById(playlist.id);
          return result.success ? result.data : { ...playlist, songs: [] };
        }),
      );
      setPlaylists(detailedPlaylists);
    }

    if (!songsResult.success || !albumsResult.success || !artistsResult.success) {
      setError('خطا در دریافت آرشیو موسیقی');
    }

    setIsDataLoading(false);
  };

  useEffect(() => {
    loadLibrary();
  }, [user?.id]);

  const enrichedAlbums = useMemo(() => buildLibraryAlbums(albums, songs, artists), [albums, artists, songs]);
  const filteredAlbums = useMemo(() => filterAndSortAlbums(enrichedAlbums, query, sortBy), [enrichedAlbums, query, sortBy]);
  const filteredSingles = useMemo(() => filterAndSortSingles(songs, query, sortBy), [query, songs, sortBy]);

  const selectedAlbum = selectedAlbumId ? enrichedAlbums.find((album) => album.id === selectedAlbumId) : null;

  const handlePlaylistToggle = async (playlist, song) => {
    setNotice('');
    setError('');

    const containsSong = playlist.songIds?.includes(song.id);
    const result = containsSong ? await removeSongFromPlaylist(playlist.id, song.id) : await addSongToPlaylist(playlist.id, song.id);

    if (result.success) {
      setNotice(containsSong ? 'آهنگ از پلی‌لیست حذف شد' : `آهنگ به ${playlist.name} اضافه شد`);
      await loadLibrary();
    } else {
      setError(result.error?.message || 'خطا در مدیریت پلی‌لیست');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-950" dir="rtl">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-l from-violet-500/20 via-slate-900 to-slate-950 p-6 md:p-8">
          <p className="text-sm text-violet-200">آلبوم‌ها و تک‌آهنگ‌ها</p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">آرشیو کشف موسیقی</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            آثار را بر اساس نام آهنگ، آلبوم یا هنرمند جستجو کنید، مرتب‌سازی کنید و تک‌آهنگ‌ها را به پلی‌لیست‌های خود اضافه یا از آن‌ها حذف کنید.
          </p>
        </header>

        {(notice || error) && (
          <div className={`rounded-2xl border p-4 text-sm ${error ? 'border-red-400/30 bg-red-500/10 text-red-100' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'}`}>
            {error || notice}
          </div>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جستجو بر اساس نام اثر یا هنرمند"
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-violet-300"
            />
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-violet-300"
            >
              <option value={LIBRARY_SORT_OPTIONS.RELEASE_DATE}>جدیدترین انتشار</option>
              <option value={LIBRARY_SORT_OPTIONS.LISTENERS}>بیشترین شنونده</option>
            </select>
          </div>
        </section>

        {isDataLoading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-300">در حال دریافت آرشیو...</div>
        ) : (
          <>
            {selectedAlbum && (
              <section className="rounded-3xl border border-violet-300/20 bg-violet-300/[0.08] p-5 md:p-6">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-violet-200">آهنگ‌های آلبوم</p>
                    <h2 className="text-2xl font-black">{selectedAlbum.title}</h2>
                    <Link href={`/artist/${selectedAlbum.artistId}`} className="mt-1 inline-block text-sm text-violet-100 hover:text-white">
                      {getArtistName(selectedAlbum.artist)}
                    </Link>
                  </div>
                  <button type="button" onClick={() => setSelectedAlbumId(null)} className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15">
                    بستن آلبوم
                  </button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
                  {selectedAlbum.songs.length ? (
                    selectedAlbum.songs.map((song) => (
                      <TrackRow key={song.id} song={song} playlists={playlists} openMenuSongId={openMenuSongId} setOpenMenuSongId={setOpenMenuSongId} onPlay={playSong} onPlaylistToggle={handlePlaylistToggle} />
                    ))
                  ) : (
                    <div className="p-6 text-center text-slate-300">برای این آلبوم آهنگی ثبت نشده است.</div>
                  )}
                </div>
              </section>
            )}

            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold">آلبوم‌ها</h2>
                <span className="text-sm text-slate-400">{formatNumber(filteredAlbums.length)} نتیجه</span>
              </div>

              {filteredAlbums.length ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {filteredAlbums.map((album) => (
                    <article key={album.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
                      <button type="button" onClick={() => setSelectedAlbumId(album.id)} className="block w-full text-right">
                        <CoverImage src={album.cover} alt={album.title} className="mb-4 aspect-square rounded-2xl" />
                        <h3 className="truncate text-lg font-bold">{album.title}</h3>
                      </button>
                      <Link href={`/artist/${album.artistId}`} className="mt-1 inline-block truncate text-sm text-violet-200 hover:text-white">
                        {getArtistName(album.artist)}
                      </Link>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                        <span>{album.releaseDate || 'بدون تاریخ'}</span>
                        <span>{formatNumber(album.listeners)} شنونده</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-slate-300">آلبومی مطابق جستجو پیدا نشد.</div>
              )}
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold">تک‌آهنگ‌ها</h2>
                <span className="text-sm text-slate-400">{formatNumber(filteredSingles.length)} نتیجه</span>
              </div>

              {filteredSingles.length ? (
                <div className="overflow-visible rounded-3xl border border-white/10 bg-white/[0.03]">
                  {filteredSingles.map((song) => (
                    <TrackRow key={song.id} song={song} playlists={playlists} openMenuSongId={openMenuSongId} setOpenMenuSongId={setOpenMenuSongId} onPlay={playSong} onPlaylistToggle={handlePlaylistToggle} />
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-slate-300">تک‌آهنگی مطابق جستجو پیدا نشد.</div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function TrackRow({ song, playlists, openMenuSongId, setOpenMenuSongId, onPlay, onPlaylistToggle }) {
  const isMenuOpen = openMenuSongId === song.id;

  return (
    <div className="relative flex items-center gap-3 border-b border-white/10 p-4 last:border-b-0">
      <button type="button" onClick={() => onPlay(song)} className="shrink-0">
        <CoverImage src={song.cover} alt={song.title} className="h-14 w-14 rounded-xl" />
      </button>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => onPlay(song)} className="block max-w-full truncate text-right font-semibold text-white hover:text-violet-200">
          {song.title}
        </button>
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm text-slate-400">
          <Link href={`/artist/${song.artistId}`} className="hover:text-white">
            {getArtistName(song.artist)}
          </Link>
          {song.album && <span>• {song.album.title}</span>}
          <span>• {formatNumber(song.listeners)} شنونده</span>
        </div>
      </div>
      <button type="button" onClick={() => onPlay(song)} className="rounded-full bg-violet-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-violet-200">
        پخش
      </button>
      <div className="relative">
        <button type="button" onClick={() => setOpenMenuSongId(isMenuOpen ? null : song.id)} className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/15">
          پلی‌لیست
        </button>
        {isMenuOpen && (
          <div className="absolute left-0 top-12 z-30 w-64 rounded-2xl border border-white/10 bg-slate-900 p-3 shadow-2xl shadow-black/40">
            {playlists.length ? (
              <div className="space-y-2">
                {playlists.map((playlist) => {
                  const checked = playlist.songIds?.includes(song.id);
                  return (
                    <button
                      key={playlist.id}
                      type="button"
                      onClick={() => onPlaylistToggle(playlist, song)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-right text-sm text-slate-200 hover:bg-white/10"
                    >
                      <span className="truncate">{playlist.name}</span>
                      <span className={checked ? 'text-emerald-300' : 'text-slate-500'}>{checked ? 'حذف' : 'افزودن'}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-400">برای افزودن آهنگ، ابتدا یک پلی‌لیست بسازید.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
