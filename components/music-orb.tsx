"use client";

import { LuMusic, LuPause, LuPlay } from "react-icons/lu";

export default function MusicOrb({
  cover,
  label,
  loading,
  onClick,
  onToggle,
  paused = false,
  playing,
}: {
  cover?: string | null;
  label: string;
  loading?: boolean;
  onClick: () => void;
  onToggle?: () => void;
  paused?: boolean;
  playing?: boolean;
}) {
  return (
    <div className="music-orb-wrap">
      <button
        aria-label={label}
        className={`music-orb${loading ? " is-loading" : ""}${playing ? " is-playing" : ""}`}
        onClick={onClick}
        type="button"
      >
        {cover ? (
          <span
            aria-hidden="true"
            className="music-orb-cover"
            style={{ backgroundImage: `url("${cover}")` }}
          />
        ) : (
          <span aria-hidden="true" className="music-orb-vinyl">
            <LuMusic size={17} />
          </span>
        )}
        {loading && <span aria-hidden="true" className="music-orb-spinner" />}
        {playing && !loading && (
          <span aria-hidden="true" className="music-orb-eq">
            <i />
            <i />
            <i />
          </span>
        )}
      </button>

      {onToggle && (
        <button
          aria-label={paused ? "Resume music" : "Pause music"}
          className="music-orb-pause"
          onClick={onToggle}
          type="button"
        >
          {paused ? <LuPlay size={11} /> : <LuPause size={11} />}
        </button>
      )}
    </div>
  );
}
