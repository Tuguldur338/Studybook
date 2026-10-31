"use client";

import { useEffect, useRef, useState } from "react";
import { LuChevronDown, LuPause, LuPlay, LuX } from "react-icons/lu";
import MusicOrb from "@/components/music-orb";
import { useMusic } from "@/components/music-context";
import { coverUrlFor, embedUrlFor } from "@/lib/music-embed";

export default function MusicEmbedPlayer() {
  const { closeEmbed, embedTrack } = useMusic();
  const [ready, setReady] = useState(false);
  const [cardOpen, setCardOpen] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [paused, setPaused] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!embedTrack) return;
    const timer = window.setTimeout(() => {
      setReady(false);
      setCardOpen(true);
      setPaused(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [embedTrack]);

  useEffect(() => {
    if (!ready || !cardOpen || hovered) return;
    const timer = window.setTimeout(() => setCardOpen(false), 8000);
    return () => window.clearTimeout(timer);
  }, [cardOpen, hovered, ready]);

  if (!embedTrack) return null;

  const url = embedUrlFor(embedTrack);
  if (!url) return null;

  const cover = ready ? null : coverUrlFor(embedTrack);
  const loading = !ready;

  function toggleEmbed() {
    if (!ready || !embedTrack || embedTrack.source !== "youtube") return;
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        event: "command",
        func: paused ? "playVideo" : "pauseVideo",
        args: [],
      }),
      "*",
    );
    setPaused((value) => !value);
  }

  return (
    <>
      {ready && cardOpen && (
        <section
          aria-label="Embedded music"
          className="music-now-card"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className="music-now-top">
            <span className="music-now-kicker">
              <span aria-hidden="true" className="music-now-live" />
              Audio only
            </span>
            <button
              aria-label="Collapse embedded player"
              className="music-now-collapse"
              onClick={() => setCardOpen(false)}
              type="button"
            >
              <LuChevronDown size={15} />
            </button>
          </div>

          <h2 className="music-now-title">{embedTrack.title}</h2>
          <p className="music-now-sub">
            {embedTrack.source === "youtube" ? "YouTube" : "Spotify"} · video
            hidden
          </p>

          <div className="music-now-actions">
            {embedTrack.source === "youtube" && (
              <button
                className="music-now-control"
                onClick={toggleEmbed}
                type="button"
              >
                {paused ? <LuPlay size={14} /> : <LuPause size={14} />}{" "}
                {paused ? "Resume" : "Pause"}
              </button>
            )}
            <button
              className="music-now-control"
              onClick={closeEmbed}
              type="button"
            >
              <LuX size={14} /> Stop audio
            </button>
            <button
              className="music-now-control"
              onClick={() => setCardOpen(false)}
              type="button"
            >
              Hide card
            </button>
          </div>

          <p className="music-now-empty">
            The player is running invisibly so it keeps playing while you study.
          </p>
        </section>
      )}

      <div aria-hidden="true" className="music-embed-media">
        <iframe
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          onLoad={() => setReady(true)}
          ref={iframeRef}
          src={url}
          title={`${embedTrack.title} player`}
        />
      </div>

      <MusicOrb
        cover={cover}
        label={cardOpen ? "Collapse embedded player" : "Open embedded player"}
        loading={loading}
        onClick={() => setCardOpen((value) => !value)}
        onToggle={
          ready && embedTrack.source === "youtube" ? toggleEmbed : undefined
        }
        paused={paused}
        playing={ready && !paused}
      />
    </>
  );
}
