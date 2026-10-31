"use client";

import Link from "next/link";
import { useState } from "react";
import {
  LuChevronDown,
  LuListMusic,
  LuPause,
  LuPlay,
  LuSkipBack,
  LuSkipForward,
  LuVolume2,
  LuX,
} from "react-icons/lu";
import { useMusic } from "@/components/music-context";
import { HOLIDAYS } from "@/lib/holidays";
import { isPlayableSource } from "@/lib/music-store";

export default function MusicPlayer() {
  const {
    currentTrack,
    holiday,
    isPlaying,
    nextTrack,
    playTrack,
    previousTrack,
    setVolume,
    settings,
    toggle,
  } = useMusic();
  const [open, setOpen] = useState(false);

  if (!currentTrack) return null;

  const playableTracks = settings.tracks.filter((track) =>
    isPlayableSource(track.source),
  );

  function dayLabel(day: string) {
    if (day === "any") return "Any day";
    return HOLIDAYS[day]?.name ?? "Celebration";
  }

  return (
    <div aria-label="Music player" className={`music-bubble${open ? " is-open" : ""}`}>
      {open && (
        <div className="music-bubble-panel">
          <div className="music-bubble-panel-head">
            <span aria-hidden="true" className="music-bubble-panel-emoji">
              {holiday?.emoji ?? "🎵"}
            </span>
            <div className="music-bubble-panel-copy">
              <strong>{currentTrack.title}</strong>
              <span>{holiday?.name ?? "Any day"}</span>
            </div>
            <button
              aria-label="Close music player"
              className="music-bubble-close"
              onClick={() => setOpen(false)}
              type="button"
            >
              <LuX size={14} />
            </button>
          </div>

          <div className="music-bubble-controls">
            <button
              aria-label="Previous track"
              className="music-bubble-control"
              onClick={() => void previousTrack()}
              type="button"
            >
              <LuSkipBack size={15} />
            </button>
            <button
              aria-label={isPlaying ? "Pause music" : "Play music"}
              className="music-bubble-control music-bubble-play"
              onClick={toggle}
              type="button"
            >
              {isPlaying ? <LuPause size={16} /> : <LuPlay size={16} />}
            </button>
            <button
              aria-label="Next track"
              className="music-bubble-control"
              onClick={() => void nextTrack()}
              type="button"
            >
              <LuSkipForward size={15} />
            </button>
            <label className="music-bubble-volume" title="Music volume">
              <LuVolume2 aria-hidden="true" size={13} />
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
          </div>

          <div className="music-bubble-list">
            {playableTracks.length ? (
              playableTracks.map((track) => {
                const current = track.id === currentTrack.id;
                return (
                  <button
                    className={`music-bubble-track-row${current ? " current" : ""}`}
                    key={track.id}
                    onClick={() => void playTrack(track)}
                    type="button"
                  >
                    <span aria-hidden="true" className="music-bubble-track-emoji">
                      {track.source === "file" ? "🎧" : "🎵"}
                    </span>
                    <span className="music-bubble-track-copy">
                      <strong>{track.title}</strong>
                      <span>{dayLabel(track.day)}</span>
                    </span>
                    {current && isPlaying && (
                      <span aria-hidden="true" className="music-bubble-eq">
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="music-bubble-empty">
                Add a playable track in the Music tab.
              </p>
            )}
          </div>

          <Link className="music-bubble-link" href="/music">
            <LuListMusic size={14} /> Open music library
          </Link>
        </div>
      )}

      <div className="music-bubble-bar">
        <button
          aria-label="Open music player"
          className="music-bubble-art"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {holiday?.emoji ?? "🎵"}
        </button>
        <button
          className="music-bubble-title"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <strong>{currentTrack.title}</strong>
          <span>{holiday?.name ?? "Any day"}</span>
        </button>
        <button
          aria-label={isPlaying ? "Pause music" : "Play music"}
          className="music-bubble-control"
          onClick={toggle}
          type="button"
        >
          {isPlaying ? <LuPause size={15} /> : <LuPlay size={15} />}
        </button>
        <button
          aria-label="Next track"
          className="music-bubble-control"
          onClick={() => void nextTrack()}
          type="button"
        >
          <LuSkipForward size={15} />
        </button>
        <button
          aria-label={open ? "Close music player" : "Open music player"}
          className="music-bubble-expand"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? <LuChevronDown size={15} /> : <LuListMusic size={15} />}
        </button>
      </div>
    </div>
  );
}
