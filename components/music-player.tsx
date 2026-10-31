"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LuChevronDown,
  LuListMusic,
  LuPause,
  LuPlay,
  LuSkipBack,
  LuSkipForward,
  LuVolume2,
} from "react-icons/lu";
import MusicOrb from "@/components/music-orb";
import { useMusic } from "@/components/music-context";
import { coverUrlFor } from "@/lib/music-embed";
import { HOLIDAYS } from "@/lib/holidays";
import { isPlayableSource } from "@/lib/music-store";

const SOURCE_LABELS: Record<string, string> = {
  file: "Audio file",
  url: "Audio link",
  link: "Audio link",
  youtube: "YouTube",
  spotify: "Spotify",
  builtin: "Holiday theme",
};

export default function MusicPlayer() {
  const {
    embedTrack,
    isPlaying,
    nextTrack,
    nowPlaying,
    pause,
    playTrack,
    previousTrack,
    setVolume,
    settings,
    startingTrack,
  } = useMusic();
  const [cardOpen, setCardOpen] = useState(true);
  const [playlistOpen, setPlaylistOpen] = useState(false);

  useEffect(() => {
    if (!nowPlaying) return;
    const timer = window.setTimeout(() => {
      setCardOpen(true);
      setPlaylistOpen(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [nowPlaying]);

  if (embedTrack || (!nowPlaying && !startingTrack)) return null;

  const loading = Boolean(startingTrack);
  const cover = startingTrack ? coverUrlFor(startingTrack) : null;
  const showCard = Boolean(cardOpen && nowPlaying && !loading);
  const playableTracks = settings.tracks.filter((track) =>
    isPlayableSource(track.source),
  );

  function dayLabel(day: string) {
    if (day === "any") return "Any day";
    if (day === "personal") return "Personal playlist";
    return HOLIDAYS[day]?.name ?? "Celebration";
  }

  function togglePlayback() {
    if (!nowPlaying) return;
    if (isPlaying) pause();
    else void playTrack(nowPlaying);
  }

  return (
    <>
      {showCard && nowPlaying && (
        <section className="music-now-card" aria-label="Now playing">
          <div className="music-now-top">
            <span className="music-now-kicker">
              <span aria-hidden="true" className="music-now-live" />
              Now playing
            </span>
            <button
              aria-label="Collapse music player"
              className="music-now-collapse"
              onClick={() => setCardOpen(false)}
              type="button"
            >
              <LuChevronDown size={15} />
            </button>
          </div>

          <h2 className="music-now-title">{nowPlaying.title}</h2>
          <p className="music-now-sub">
            {nowPlaying.playlist ?? dayLabel(nowPlaying.day)} ·{" "}
            {SOURCE_LABELS[nowPlaying.source] ?? nowPlaying.source}
          </p>

          <div className="music-now-controls">
            <button
              aria-label="Previous track"
              className="music-now-control"
              onClick={() => void previousTrack()}
              type="button"
            >
              <LuSkipBack size={15} />
            </button>
            <button
              aria-label={isPlaying ? "Pause music" : "Play music"}
              className="music-now-play"
              onClick={togglePlayback}
              type="button"
            >
              {isPlaying ? <LuPause size={17} /> : <LuPlay size={17} />}
            </button>
            <button
              aria-label="Next track"
              className="music-now-control"
              onClick={() => void nextTrack()}
              type="button"
            >
              <LuSkipForward size={15} />
            </button>
            <button
              aria-expanded={playlistOpen}
              aria-label="Open playlist"
              className="music-now-control"
              onClick={() => setPlaylistOpen((value) => !value)}
              type="button"
            >
              <LuListMusic size={15} />
            </button>
          </div>

          <label className="music-now-volume">
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

          {playlistOpen && (
            <div className="music-now-playlist">
              {playableTracks.length ? (
                playableTracks.map((track) => (
                  <button
                    className={`music-now-row${track.id === nowPlaying.id ? " is-current" : ""}`}
                    key={track.id}
                    onClick={() => void playTrack(track)}
                    type="button"
                  >
                    <span aria-hidden="true" className="music-now-row-icon">
                      {track.id === nowPlaying.id ? "◉" : "•"}
                    </span>
                    <span className="music-now-row-copy">
                      <strong>{track.title}</strong>
                      <span>{dayLabel(track.day)}</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="music-now-empty">
                  Add a playable track in the Music tab.
                </p>
              )}
            </div>
          )}

          <Link className="music-now-library" href="/music">
            Open music library
          </Link>
        </section>
      )}

      <MusicOrb
        cover={cover}
        label={cardOpen ? "Collapse music player" : "Open music player"}
        loading={loading}
        onClick={() => setCardOpen((value) => !value)}
        playing={isPlaying && !loading}
      />
    </>
  );
}
