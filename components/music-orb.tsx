"use client";

import { LuMusic } from "react-icons/lu";

export default function MusicOrb({
  cover,
  label,
  loading,
  onClick,
  playing,
  raised = false,
}: {
  cover?: string | null;
  label: string;
  loading?: boolean;
  onClick: () => void;
  playing?: boolean;
  raised?: boolean;
}) {
  return (
    <div className={`music-orb-wrap${raised ? " is-raised" : ""}`}>
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
    </div>
  );
}
