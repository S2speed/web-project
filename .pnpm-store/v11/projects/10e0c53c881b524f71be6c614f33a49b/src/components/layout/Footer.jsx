'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePlayer } from '@/contexts/PlayerContext';
import { useUser } from '@/contexts/UserContext';
import { DEFAULT_COVER, PLAYER_REPEAT_MODES, SUBSCRIPTION_TYPES } from '@/utils/constants';

const time = (value) => {
  const seconds = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const artistName = (song) => song?.artist?.stageName || song?.artist?.user?.displayName || 'هنرمند';

export default function Footer() {
  const player = usePlayer();
  const { user } = useUser();
  const [expanded, setExpanded] = useState(false);
  const {
    currentSong, isPlaying, togglePlay, previous, next, progress, duration, seek, volume, setVolume,
    queue, currentIndex, playSong, repeatMode, toggleRepeat, isShuffle, toggleShuffle, error,
    removeQueueItem, moveQueueItem, clearUpcoming,
  } = player;
  const isGold = user?.subscription === SUBSCRIPTION_TYPES.GOLD;
  const repeatLabel = repeatMode === PLAYER_REPEAT_MODES.ONE ? 'تکرار یک' : repeatMode === PLAYER_REPEAT_MODES.ALL ? 'تکرار صف' : 'بدون تکرار';

  return (
    <>
      <footer className="fixed bottom-0 left-0 right-0 z-50 min-h-16 border-t border-white/10 bg-slate-950/95 text-white backdrop-blur md:min-h-24">
        <div className="mx-auto flex min-h-16 items-center justify-between gap-2 px-3 md:min-h-20 md:px-5">
          <button type="button" onClick={() => currentSong && setExpanded(true)} className="flex min-w-0 flex-1 items-center gap-2 text-right md:w-1/3 md:flex-none md:gap-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-white/10 md:h-14 md:w-14">
              <img
                src={currentSong?.cover || DEFAULT_COVER}
                alt={currentSong?.title || ''}
                onError={(event) => {
                  event.currentTarget.src = DEFAULT_COVER;
                }}
                className="h-full w-full object-cover"
              />
            </div>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{currentSong?.title || 'هیچ آهنگی در حال پخش نیست'}</span>
              <span className="block truncate text-xs text-slate-400">{currentSong ? artistName(currentSong) : 'برای شروع، یک آهنگ انتخاب کنید'}</span>
            </span>
          </button>

          <div className="flex shrink-0 flex-col items-center gap-1">
            <div className="flex items-center gap-2 sm:gap-4">
              <button type="button" onClick={toggleShuffle} aria-pressed={isShuffle} className={`hidden text-sm sm:block ${isShuffle ? 'text-emerald-300' : 'text-slate-400'}`}>🔀</button>
              <button type="button" aria-label="آهنگ قبلی" onClick={previous} className="transition hover:text-emerald-300">⏮</button>
              <button type="button" aria-label={isPlaying ? 'توقف پخش' : 'پخش'} onClick={togglePlay} disabled={!currentSong} className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 font-bold text-slate-950 disabled:opacity-40 md:h-11 md:w-11">
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button type="button" aria-label="آهنگ بعدی" onClick={next} className="transition hover:text-emerald-300">⏭</button>
              <button type="button" onClick={toggleRepeat} title={repeatLabel} className={`hidden text-sm sm:block ${repeatMode !== PLAYER_REPEAT_MODES.NONE ? 'text-emerald-300' : 'text-slate-400'}`}>{repeatMode === PLAYER_REPEAT_MODES.ONE ? '🔂' : '🔁'}</button>
            </div>
            <div className="hidden w-[min(34vw,32rem)] items-center gap-2 text-[10px] text-slate-500 md:flex">
              <span>{time(progress)}</span>
              <input aria-label="نوار پیشرفت" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(progress, duration || 0)} onChange={(event) => seek(event.target.value)} className="w-full accent-emerald-400" />
              <span>{time(duration)}</span>
            </div>
          </div>

          <div className="hidden w-1/3 items-center justify-end gap-3 md:flex">
            <span className="text-sm">🔊</span>
            <input aria-label="میزان صدا" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(event.target.value)} className="w-28 accent-emerald-400" />
            <span className="w-9 text-xs text-slate-400">{Math.round(volume * 100)}%</span>
          </div>
        </div>
        {error && <p className="px-4 pb-1 text-center text-xs text-rose-300">{error}</p>}
      </footer>

      {expanded && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950 p-5 text-white md:p-8" dir="rtl">
          <div className="mx-auto max-w-5xl">
            <header className="flex items-center justify-between">
              <div><p className="text-sm text-emerald-300">در حال پخش</p><h2 className="text-2xl font-black">پخش‌کننده موسیقی</h2></div>
              <button type="button" onClick={() => setExpanded(false)} className="rounded-full bg-white/10 px-4 py-2 text-xl">×</button>
            </header>

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <section className="text-center">
                <div className="mx-auto aspect-square w-full max-w-md overflow-hidden rounded-[2rem] bg-white/10 shadow-2xl">
                  <img
                    src={currentSong?.cover || DEFAULT_COVER}
                    alt={currentSong?.title || ''}
                    onError={(event) => {
                      event.currentTarget.src = DEFAULT_COVER;
                    }}
                    className="h-full w-full object-cover"
                  />
                </div>
                <h1 className="mt-6 text-3xl font-black">{currentSong?.title}</h1>
                <div className="mt-2 flex flex-wrap justify-center gap-2 text-sm text-slate-400">
                  {currentSong?.artistId && <Link href={`/artist/${currentSong.artistId}`} onClick={() => setExpanded(false)} className="hover:text-emerald-300">{artistName(currentSong)}</Link>}
                  {currentSong?.albumId && <><span>•</span><Link href={`/album/${currentSong.albumId}`} onClick={() => setExpanded(false)} className="hover:text-emerald-300">{currentSong.album?.title || 'آلبوم'}</Link></>}
                </div>

                <div className="mx-auto mt-7 max-w-xl">
                  <input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(progress, duration || 0)} onChange={(event) => seek(event.target.value)} className="w-full accent-emerald-400" />
                  <div className="flex justify-between text-xs text-slate-500"><span>{time(progress)}</span><span>{time(duration)}</span></div>
                  <div className="mt-5 flex items-center justify-center gap-6">
                    <button type="button" onClick={toggleShuffle} className={isShuffle ? 'text-emerald-300' : 'text-slate-400'}>🔀</button>
                    <button type="button" onClick={previous} className="text-2xl">⏮</button>
                    <button type="button" onClick={togglePlay} className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400 text-2xl text-slate-950">{isPlaying ? '⏸' : '▶'}</button>
                    <button type="button" onClick={next} className="text-2xl">⏭</button>
                    <button type="button" onClick={toggleRepeat} title={repeatLabel} className={repeatMode !== PLAYER_REPEAT_MODES.NONE ? 'text-emerald-300' : 'text-slate-400'}>{repeatMode === PLAYER_REPEAT_MODES.ONE ? '🔂' : '🔁'}</button>
                  </div>
                  <div className="mt-6 flex items-center gap-3"><span>🔊</span><input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(event.target.value)} className="w-full accent-emerald-400" /></div>
                </div>

                {isGold && currentSong && (
                  <div className="mx-auto mt-6 grid max-w-xl grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-amber-300/10 p-4"><strong className="text-xl text-amber-200">{Number(currentSong.listeners || 0).toLocaleString('fa-IR')}</strong><span className="block text-xs text-slate-400">شنونده</span></div>
                    <div className="rounded-2xl bg-amber-300/10 p-4"><strong className="text-xl text-amber-200">{Number(currentSong.playCount || 0).toLocaleString('fa-IR')}</strong><span className="block text-xs text-slate-400">استریم</span></div>
                  </div>
                )}

                <section className="mx-auto mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/5 p-5 text-right">
                  <h3 className="font-bold">متن آهنگ</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-slate-300">{currentSong?.lyrics || 'متن این آهنگ ثبت نشده است.'}</p>
                </section>
              </section>

              <aside className="h-fit rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold">صف پخش</h3>
                    <p className="mt-1 text-xs text-slate-500">{Math.max(queue.length - currentIndex - 1, 0).toLocaleString('fa-IR')} آهنگ آینده</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearUpcoming}
                    disabled={currentIndex >= queue.length - 1}
                    className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    پاک‌کردن آینده
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {queue.length ? queue.map((song, index) => (
                    <div key={`${song.id}-${index}`} className={`flex items-center gap-2 rounded-xl p-2 ${index === currentIndex ? 'bg-emerald-400/15 text-emerald-100' : 'hover:bg-white/10'}`}>
                      <button type="button" onClick={() => playSong(song, queue)} className="flex min-w-0 flex-1 items-center gap-3 text-right">
                        <span className="w-6 text-xs text-slate-500">{index + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-sm">{song.title}</span>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" aria-label="انتقال به بالا" onClick={() => moveQueueItem(index, index - 1)} disabled={index === 0} className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/10 disabled:opacity-25">↑</button>
                        <button type="button" aria-label="انتقال به پایین" onClick={() => moveQueueItem(index, index + 1)} disabled={index === queue.length - 1} className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/10 disabled:opacity-25">↓</button>
                        <button type="button" aria-label="حذف از صف" onClick={() => removeQueueItem(index)} disabled={index === currentIndex} className="rounded-lg px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-25">×</button>
                      </div>
                    </div>
                  )) : <p className="text-sm text-slate-400">صف پخش خالی است.</p>}
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
