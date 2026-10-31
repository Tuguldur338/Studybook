"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [hovered, setHovered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const closeCard = useCallback(() => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setLeaving(true);
    closeTimerRef.current = window.setTimeout(() => {
      setCardOpen(false);
      setLeaving(false);
      closeTimerRef.current = null;
    }, 420);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!nowPlaying) return;
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    const timer = window.setTimeout(() => {
      setCardOpen(true);
      setPlaylistOpen(false);
      setLeaving(false);
      setExpanded(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [nowPlaying]);

  useEffect(() => {
    if (
      !cardOpen ||
      leaving ||
      expanded ||
      !nowPlaying ||
      startingTrack ||
      hovered
    ) {
      return;
    }
    const timer = window.setTimeout(closeCard, 2000);
    return () => window.clearTimeout(timer);
  }, [
    cardOpen,
    closeCard,
    expanded,
    hovered,
    leaving,
    nowPlaying,
    startingTrack,
  ]);

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
        <section
          className={`music-now-card${isPlaying ? " is-playing" : " is-paused"}${expanded ? " is-expanded" : " is-compact"}${leaving ? " is-leaving" : ""}`}
          aria-label="Now playing"
          key={nowPlaying.id}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {!expanded ? (
            <button
              aria-label="Show music controls"
              className="music-now-compact"
              onClick={() => setExpanded(true)}
              type="button"
            >
              <span aria-hidden="true" className="music-now-live" />
              <span className="music-now-compact-title">
                {nowPlaying.title}
              </span>
              <span aria-hidden="true" className="music-now-eq">
                <i />
                <i />
                <i />
              </span>
            </button>
          ) : (
            <>
              <div className="music-now-top">
                <span className="music-now-kicker">
                  <span aria-hidden="true" className="music-now-live" />
                  Now playing
                  <span aria-hidden="true" className="music-now-eq">
                    <i />
                    <i />
                    <i />
                  </span>
                </span>
                <button
                  aria-label="Collapse music player"
                  className="music-now-collapse"
                  onClick={closeCard}
                  type="button"
                >
                  <LuChevronDown size={15} />
                </button>
              </div>

              <h2 className="music-now-title">{nowPlaying.title}</h2>
              <p className="music-now-sub">
                {nowPlaying.playlist ?? dayLabel(nowPlaying.day)} Â·{" "}
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
                          {track.id === nowPlaying.id ? "â—‰" : "â€¢"}
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
            </>
          )}
        </section>
      )}

      <MusicOrb
        cover={cover}
        label={
          cardOpen
            ? expanded
              ? "Collapse music player"
              : "Show music controls"
            : "Open music player"
        }
        loading={loading}
        onClick={() => {
          if (cardOpen) {
            if (expanded) closeCard();
            else setExpanded(true);
          } else {
            setExpanded(true);
            setLeaving(false);
            setCardOpen(true);
          }
        }}
        onToggle={togglePlayback}
        paused={!isPlaying}
        playing={isPlaying && !loading}
      />
    </>
  );
}
