"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [leaving, setLeaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const closeCard = useCallback(() => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setLeaving(true);
    closeTimerRef.current = window.setTimeout(() => {
      setCardOpen(false);
      setLeaving(false);
      closeTimerRef.current = null;
    }, 520);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!embedTrack) return;
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    const timer = window.setTimeout(() => {
      setReady(false);
      setCardOpen(true);
      setPaused(false);
      setLeaving(false);
      setExpanded(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [embedTrack]);

  useEffect(() => {
    if (!ready || !cardOpen || leaving || expanded || hovered) return;
    const timer = window.setTimeout(closeCard, 3600);
    return () => window.clearTimeout(timer);
  }, [cardOpen, closeCard, expanded, hovered, leaving, ready]);

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
          className={`music-now-card${paused ? " is-paused" : " is-playing"}${expanded ? " is-expanded" : " is-compact"}${leaving ? " is-leaving" : ""}`}
          key={embedTrack.id}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {!expanded ? (
            <button
              aria-label="Show embedded music controls"
              className="music-now-compact"
              onClick={() => setExpanded(true)}
              type="button"
            >
              <span aria-hidden="true" className="music-now-live" />
              <span className="music-now-compact-title">
                {embedTrack.title}
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
                  Audio only
                  <span aria-hidden="true" className="music-now-eq">
                    <i />
                    <i />
                    <i />
                  </span>
                </span>
                <button
                  aria-label="Collapse embedded player"
                  className="music-now-collapse"
                  onClick={closeCard}
                  type="button"
                >
                  <LuChevronDown size={15} />
                </button>
              </div>

              <h2 className="music-now-title">{embedTrack.title}</h2>
              <p className="music-now-sub">
                {embedTrack.source === "youtube" ? "YouTube" : "Spotify"} Ã‚Â·
                video hidden
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
                  onClick={closeCard}
                  type="button"
                >
                  Hide card
                </button>
              </div>

              <p className="music-now-empty">
                The player is running invisibly so it keeps playing while you
                study.
              </p>
            </>
          )}
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
        label={
          cardOpen
            ? expanded
              ? "Collapse embedded player"
              : "Show embedded music controls"
            : "Open embedded player"
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
        playing={ready && !paused}
      />
    </>
  );
}
