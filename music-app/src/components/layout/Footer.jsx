'use client';

import { usePlayer } from '@/contexts/PlayerContext';

export default function Footer() {
  const { currentSong, isPlaying, togglePlay, previous, next } = usePlayer();

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 h-20 border-t border-white/10 bg-slate-950/95 text-white backdrop-blur">
      <div className="mx-auto flex h-full items-center justify-between px-4">
        <div className="flex w-1/4 items-center gap-3">
          {currentSong ? (
            <>
              <div className="h-12 w-12 overflow-hidden rounded-xl bg-white/10">
                {currentSong.cover ? <img src={currentSong.cover} alt={currentSong.title} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{currentSong.title}</p>
                <p className="truncate text-xs text-slate-400">هنرمند</p>
              </div>
            </>
          ) : (
            <span className="text-sm text-slate-500">هیچ آهنگی در حال پخش نیست</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button type="button" onClick={previous} className="transition-colors hover:text-emerald-400">
            ⏮
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-400"
          >
            {isPlaying ? '⏸' : '▶️'}
          </button>
          <button type="button" onClick={next} className="transition-colors hover:text-emerald-400">
            ⏭
          </button>
        </div>

        <div className="flex w-1/4 justify-end">
          <span className="text-sm text-slate-400">🔊 70%</span>
        </div>
      </div>
    </footer>
  );
}
