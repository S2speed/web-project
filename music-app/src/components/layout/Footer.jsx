'use client';

import { usePlayer } from '@/contexts/PlayerContext';

export default function Footer() {
  const { currentSong, isPlaying, togglePlay, previous, next } = usePlayer();

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-white/10 bg-slate-950/95 text-white backdrop-blur md:h-20">
      <div className="mx-auto flex h-full items-center justify-between gap-2 px-3 md:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:w-1/3 md:flex-none md:gap-3">
          {currentSong ? (
            <>
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/10 md:h-12 md:w-12 md:rounded-xl">
                {currentSong.cover ? <img src={currentSong.cover} alt={currentSong.title} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{currentSong.title}</p>
                <p className="truncate text-xs text-slate-400">هنرمند</p>
              </div>
            </>
          ) : (
            <span className="truncate text-xs text-slate-500 md:text-sm">هیچ آهنگی در حال پخش نیست</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <button type="button" aria-label="آهنگ قبلی" onClick={previous} className="hidden transition-colors hover:text-emerald-400 sm:block">
            ⏮
          </button>
          <button
            type="button"
            aria-label={isPlaying ? 'توقف پخش' : 'پخش'}
            onClick={togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-400 md:h-10 md:w-10"
          >
            {isPlaying ? '⏸' : '▶️'}
          </button>
          <button type="button" aria-label="آهنگ بعدی" onClick={next} className="transition-colors hover:text-emerald-400">
            ⏭
          </button>
        </div>

        <div className="hidden w-1/3 justify-end md:flex">
          <span className="text-sm text-slate-400">🔊 70%</span>
        </div>
      </div>
    </footer>
  );
}
