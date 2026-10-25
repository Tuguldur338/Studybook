"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { LuX } from "react-icons/lu";
import { useMusic } from "@/components/music-context";
import { useStudybook } from "@/components/studybook-context";
import { HOLIDAYS, type Holiday } from "@/lib/holidays";

const CELEBRATED_KEY = "studybook-celebrated-v1";
const CELEBRATION_MS = 18_000;

type EffectKind =
  | "snow"
  | "confetti"
  | "bats"
  | "petals"
  | "balloons"
  | "sparkles"
  | "dust";

type HolidayEffect = {
  kind: EffectKind;
  greeting: string;
  tint: string;
};

const EFFECTS: Record<string, HolidayEffect> = {
  christmas: {
    kind: "snow",
    greeting: "Merry Christmas",
    tint:
      "linear-gradient(180deg, rgb(70 130 220 / 22%), rgb(18 36 72 / 18%))",
  },
  halloween: {
    kind: "bats",
    greeting: "Happy Halloween",
    tint:
      "linear-gradient(180deg, rgb(120 60 160 / 20%), rgb(25 12 35 / 24%))",
  },
  newyear: {
    kind: "confetti",
    greeting: "Happy New Year",
    tint:
      "linear-gradient(180deg, rgb(235 185 70 / 16%), rgb(40 30 60 / 12%))",
  },
  newyearseve: {
    kind: "confetti",
    greeting: "Happy New Year's Eve",
    tint:
      "linear-gradient(180deg, rgb(235 185 70 / 18%), rgb(30 22 50 / 16%))",
  },
  tsagaansar: {
    kind: "sparkles",
    greeting: "Tsagaan Sar",
    tint:
      "linear-gradient(180deg, rgb(140 180 235 / 18%), rgb(255 255 255 / 12%))",
  },
  naadam: {
    kind: "confetti",
    greeting: "Happy Naadam",
    tint:
      "linear-gradient(180deg, rgb(220 150 60 / 18%), rgb(60 40 20 / 12%))",
  },
  womensday: {
    kind: "petals",
    greeting: "Happy Women's Day",
    tint:
      "linear-gradient(180deg, rgb(240 150 180 / 16%), rgb(255 255 255 / 10%))",
  },
  childrensday: {
    kind: "balloons",
    greeting: "Happy Children's Day",
    tint:
      "linear-gradient(180deg, rgb(120 190 240 / 16%), rgb(250 230 120 / 12%))",
  },
  genghis: {
    kind: "dust",
    greeting: "Genghis Khan's Birthday",
    tint:
      "linear-gradient(180deg, rgb(220 180 90 / 16%), rgb(60 45 20 / 12%))",
  },
  republic: {
    kind: "confetti",
    greeting: "Happy Republic Day",
    tint:
      "linear-gradient(180deg, rgb(80 130 200 / 14%), rgb(200 70 70 / 12%))",
  },
  independence: {
    kind: "confetti",
    greeting: "Happy Independence Day",
    tint:
      "linear-gradient(180deg, rgb(80 130 200 / 14%), rgb(200 70 70 / 12%))",
  },
  constitution: {
    kind: "sparkles",
    greeting: "Happy Constitution Day",
    tint:
      "linear-gradient(180deg, rgb(220 180 90 / 14%), rgb(40 50 80 / 10%))",
  },
  soldiersday: {
    kind: "dust",
    greeting: "Happy Soldiers' Day",
    tint:
      "linear-gradient(180deg, rgb(120 140 110 / 14%), rgb(40 45 40 / 10%))",
  },
};

const EMOJI: Record<string, string[]> = {
  bats: ["🦇", "🦇", "🦇", "🎃", "👻"],
  petals: ["🌸", "🌷", "🌺"],
  balloons: ["🎈", "🎉", "🎈"],
  sparkles: ["✨", "⭐", "🌟"],
};

const CONFETTI_COLORS = [
  "#e05a6b",
  "#f0b429",
  "#3b82c4",
  "#4f9f75",
  "#7c6fd6",
  "#e8873a",
];

type Particle = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  color: string;
  char: string;
  top: number;
};

function makeParticles(kind: EffectKind): Particle[] {
  const count =
    kind === "snow"
      ? 70
      : kind === "confetti"
        ? 55
        : kind === "bats"
          ? 16
          : kind === "petals"
            ? 28
            : kind === "balloons"
              ? 18
              : kind === "sparkles"
                ? 34
                : 40;

  const chars = EMOJI[kind] ?? [];

  return Array.from({ length: count }, (_, index) => ({
    id: index,
    left: Math.random() * 100,
    delay: -Math.random() * 14,
    duration:
      kind === "sparkles"
        ? 2 + Math.random() * 3
        : kind === "balloons"
          ? 12 + Math.random() * 8
          : kind === "dust"
            ? 12 + Math.random() * 8
            : 6 + Math.random() * 9,
    size:
      kind === "snow"
        ? 2 + Math.random() * 4
        : kind === "dust"
          ? 2 + Math.random() * 3
          : kind === "confetti"
            ? 6 + Math.random() * 6
            : 14 + Math.random() * 16,
    drift: (Math.random() - 0.5) * 170,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    char: chars.length ? chars[index % chars.length] : "",
    top: Math.random() * 90,
  }));
}

export default function HolidayEffects() {
  const { holiday, currentTrack, isPlaying, play } = useMusic();
  const { holidayEffects } = useStudybook();
  const [preview, setPreview] = useState<Holiday | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const hideTimer = useRef(0);

  useEffect(() => {
    if (!holiday || !holidayEffects || preview) return;

    const startTimer = window.setTimeout(() => {
      const celebrationKey = `${holiday.key}-${new Date().getFullYear()}`;
      let lastCelebrated = "";
      try {
        lastCelebrated =
          window.localStorage.getItem(CELEBRATED_KEY) ?? "";
      } catch {
        // Storage can be unavailable in private mode.
      }

      if (lastCelebrated === celebrationKey) return;

      try {
        window.localStorage.setItem(CELEBRATED_KEY, celebrationKey);
      } catch {
        // Without storage the celebration still plays this visit.
      }

      setCelebrating(true);
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(
        () => setCelebrating(false),
        CELEBRATION_MS,
      );
    }, 0);

    return () => window.clearTimeout(startTimer);
  }, [holiday, holidayEffects, preview]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  useEffect(() => {
    let timer = 0;

    function handlePreview(event: Event) {
      const key = (event as CustomEvent<string>).detail;
      const found = HOLIDAYS[key];
      if (!found) return;
      window.clearTimeout(timer);
      setPreview(found);
      timer = window.setTimeout(() => setPreview(null), 8000);
    }

    window.addEventListener("studybook-preview-holiday", handlePreview);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("studybook-preview-holiday", handlePreview);
    };
  }, []);

  const activeHoliday = preview ?? holiday;
  const config = activeHoliday ? EFFECTS[activeHoliday.key] : undefined;
  const kind = config?.kind;

  const particles = useMemo(
    () => (kind ? makeParticles(kind) : []),
    [kind],
  );

  if (!holidayEffects || !activeHoliday || !config) return null;
  if (!preview && !celebrating) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="holiday-layer"
        style={{ background: config.tint }}
      >
        <div className="holiday-particles">
          {particles.map((particle) => {
            const style = {
              left: `${particle.left}%`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
              "--drift": `${particle.drift}px`,
              top:
                config.kind === "sparkles"
                  ? `${particle.top}%`
                  : undefined,
            } as CSSProperties;

            if (config.kind === "snow" || config.kind === "dust") {
              return (
                <span
                  className={`holiday-particle dot ${config.kind}`}
                  key={particle.id}
                  style={{
                    ...style,
                    width: particle.size,
                    height: particle.size,
                  }}
                />
              );
            }

            if (config.kind === "confetti") {
              return (
                <span
                  className="holiday-particle confetti"
                  key={particle.id}
                  style={{
                    ...style,
                    width: particle.size,
                    height: particle.size * 1.7,
                    background: particle.color,
                  }}
                />
              );
            }

            return (
              <span
                className={`holiday-particle emoji${
                  config.kind === "balloons" ? " rise" : ""
                }${config.kind === "sparkles" ? " sparkle" : ""}`}
                key={particle.id}
                style={{ ...style, fontSize: particle.size }}
              >
                {particle.char}
              </span>
            );
          })}
        </div>
      </div>

      <div className="holiday-banner" role="status">
        <span aria-hidden="true" className="holiday-banner-emoji">
          {activeHoliday.emoji}
        </span>
        <div className="holiday-banner-copy">
          <strong>{config.greeting}</strong>
          <span>{activeHoliday.name} effects are on.</span>
        </div>
        {currentTrack && !isPlaying && (
          <button
            className="text-button"
            onClick={() => void play()}
            type="button"
          >
            Play theme
          </button>
        )}
        <button
          aria-label="Dismiss celebration"
          className="holiday-banner-close"
          onClick={() => {
            if (preview) setPreview(null);
            else setCelebrating(false);
          }}
          type="button"
        >
          <LuX size={14} />
        </button>
      </div>
    </>
  );
}
