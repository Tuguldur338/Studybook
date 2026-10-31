"use client";

import { useEffect, useState } from "react";
import { LuX } from "react-icons/lu";
import { useMusic } from "@/components/music-context";
import { embedUrlFor } from "@/lib/music-embed";

export default function MusicEmbedPlayer() {
  const { closeEmbed, embedTrack } = useMusic();
  const [audioOnly, setAudioOnly] = useState(true);

  useEffect(() => {
    if (!embedTrack) return;
    const timer = window.setTimeout(() => {
      setAudioOnly(embedTrack.source === "youtube");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [embedTrack]);

  if (!embedTrack) return null;

  const url = embedUrlFor(embedTrack);
  if (!url) return null;

  return (
    <div
      className={`music-embed-dock${audioOnly ? " is-audio-only" : ""}`}
    >
      <div className="music-embed-dock-head">
        <span aria-hidden="true" className="music-embed-dock-emoji">
          {embedTrack.source === "youtube" ? "📺" : "🎧"}
        </span>
        <span className="music-embed-dock-copy">
          <strong>{embedTrack.title}</strong>
          <span>{audioOnly ? "Audio only" : "Embedded player"}</span>
        </span>
        <button
          className="music-embed-dock-toggle"
          onClick={() => setAudioOnly((value) => !value)}
          type="button"
        >
          {audioOnly ? "Show video" : "Audio only"}
        </button>
        <button
          aria-label="Close embedded player"
          className="music-embed-dock-close"
          onClick={closeEmbed}
          type="button"
        >
          <LuX size={14} />
        </button>
      </div>
      <div className="music-embed-dock-frame">
        <iframe
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          src={url}
          title={`${embedTrack.title} player`}
        />
      </div>
    </div>
  );
}
