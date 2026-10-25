"use client";

import Link from "next/link";
import {
  LuListMusic,
  LuPause,
  LuPlay,
  LuVolume2,
} from "react-icons/lu";
import { useMusic } from "@/components/music-context";

export default function MusicPlayer() {
  const {
    blocked,
    currentTrack,
    holiday,
    isPlaying,
    setVolume,
    settings,
    toggle,
  } = useMusic();

  if (!currentTrack) return null;

  return (
    <div aria-label="Background music" className="music-dock">
      <span aria-hidden="true" className="music-dock-emoji">
        {holiday?.emoji ?? "🎵"}
      </span>
      <div className="music-dock-copy">
        <strong>{currentTrack.title}</strong>
        <span>
          {holiday?.name ?? "Everyday playlist"}
          {blocked && !isPlaying ? " · press play" : ""}
        </span>
      </div>
      <button
        aria-label={isPlaying ? "Pause music" : "Play music"}
        className="music-dock-play"
        onClick={toggle}
        type="button"
      >
        {isPlaying ? <LuPause size={15} /> : <LuPlay size={15} />}
      </button>
      <label className="music-dock-volume" title="Music volume">
        <LuVolume2 aria-hidden="true" size={14} />
        <input
          aria-label="Music volume"
          max={1}
          min={0}
          onChange={(event) => setVolume(Number(event.target.value))}
          step={0.05}
          type="range"
          value={settings.volume}
        />
      </label>
      <Link aria-label="Open music library" className="music-dock-link" href="/music">
        <LuListMusic size={16} />
      </Link>
    </div>
  );
}
