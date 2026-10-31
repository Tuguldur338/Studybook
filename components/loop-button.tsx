"use client";

import { LuRepeat } from "react-icons/lu";
import { useMusic } from "@/components/music-context";

export default function LoopButton({ className = "" }: { className?: string }) {
  const { cycleLoopMode, loopMode } = useMusic();

  return (
    <button
      aria-label={
        loopMode === 0
          ? "Loop off"
          : loopMode === 1
            ? "Looping all songs"
            : "Looping this song"
      }
      className={`loop-button${loopMode > 0 ? " is-active" : ""}${className ? ` ${className}` : ""}`}
      onClick={cycleLoopMode}
      title={
        loopMode === 0
          ? "Loop off · press once to loop all songs"
          : loopMode === 1
            ? "Looping all songs · press again to loop one song"
            : "Looping this song · press again to turn loop off"
      }
      type="button"
    >
      <LuRepeat aria-hidden="true" size={14} />
      <span className="loop-button-count">{loopMode}</span>
    </button>
  );
}
