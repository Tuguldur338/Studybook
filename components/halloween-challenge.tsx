"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LuArrowLeft, LuX } from "react-icons/lu";
import { useMusic } from "@/components/music-context";
import { useSupabaseUser } from "@/components/use-supabase-user";
import {
  HALLOWEEN_DIFFICULTY_LABEL,
  HALLOWEEN_POINTS,
  getHalloweenRiddle,
  isHalloween,
  type HalloweenRiddle,
} from "@/lib/halloween";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Stage = "choose" | "riddle" | "result";

type ChallengeResult = {
  title: string;
  body: string;
  points: number;
};

type ClaimOutcome = {
  already?: boolean;
  error?: string;
};

export default function HalloweenChallenge() {
  const { user } = useSupabaseUser();
  const {
    currentTrack: halloweenTrack,
    holiday: musicHoliday,
    isPlaying: musicPlaying,
    toggle: toggleMusic,
  } = useMusic();
  const [now, setNow] = useState<Date | null>(null);
  const [riddle, setRiddle] = useState<HalloweenRiddle | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [claimChecked, setClaimChecked] = useState(false);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("choose");
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const date = new Date();
      setNow(date);
      setRiddle(getHalloweenRiddle(date.getFullYear()));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!now || !isHalloween(now)) return;
    if (!user) {
      const timer = window.setTimeout(() => {
        setClaimed(false);
        setClaimChecked(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let active = true;
    const year = now.getFullYear();

    async function checkClaim() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase
          .from("halloween_claims")
          .select("choice")
          .eq("user_id", user!.id)
          .eq("year", year)
          .maybeSingle();
        if (data) {
          if (active) setClaimed(true);
          return;
        }

        // Move a claim saved by the earlier device-local version onto the
        // account so other devices see it too, without awarding points twice.
        try {
          const raw = window.localStorage.getItem(
            `studybook-halloween-claim-v1:${year}:${user!.id}`,
          );
          if (raw) {
            const legacy = JSON.parse(raw) as {
              choice?: string;
              points?: number;
            };
            const points = Number(legacy.points ?? 0);
            if (
              (legacy.choice === "treat" || legacy.choice === "trick") &&
              [0, 10, 20, 30].includes(points)
            ) {
              const { error: migrateError } = await supabase.rpc(
                "record_halloween_claim",
                {
                  choice: legacy.choice,
                  point_value: points,
                },
              );
              if (!migrateError) {
                if (active) setClaimed(true);
                return;
              }
            }
          }
        } catch {
          // A malformed old local claim should not block the new event.
        }

        if (active) setClaimed(false);
      } catch {
        // The claim table may not be migrated yet; the RPC will report it.
      } finally {
        if (active) setClaimChecked(true);
      }
    }

    void checkClaim();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkClaim();
    }, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkClaim();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [now, user]);

  if (!now || !isHalloween(now) || !claimChecked || (claimed && !open)) {
    return null;
  }

  function openChallenge() {
    setStage("choose");
    setPicked(null);
    setResult(null);
    setError("");
    setOpen(true);
  }

  function closeChallenge() {
    setOpen(false);
    setError("");
  }

  async function claimHalloween(
    choice: "treat" | "trick",
    pointValue: number,
  ): Promise<ClaimOutcome> {
    if (!user) {
      return { error: "Sign in to collect leaderboard points." };
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: claimError } = await supabase.rpc("claim_halloween", {
        choice,
        point_value: pointValue,
      });

      if (claimError) {
        if (/already claimed|duplicate key|23505/i.test(claimError.message)) {
          setClaimed(true);
          setClaimChecked(true);
          return { already: true };
        }
        return { error: claimError.message };
      }

      setClaimed(true);
      setClaimChecked(true);
      return {};
    } catch {
      return { error: "Could not reach the Halloween claim service." };
    }
  }

  async function claimTreat() {
    setBusy(true);
    setError("");
    const outcome = await claimHalloween("treat", 10);
    if (outcome.error) {
      setError(outcome.error);
      setBusy(false);
      return;
    }
    if (outcome.already) {
      setResult({
        title: "Already claimed",
        body: "This account already claimed its Halloween treat on another device.",
        points: 0,
      });
      setStage("result");
      setBusy(false);
      return;
    }
    setResult({
      title: "Treat claimed!",
      body: "A sweet little boost for your leaderboard, locked for this year.",
      points: 10,
    });
    setStage("result");
    setBusy(false);
  }

  async function answerRiddle() {
    if (!riddle || picked === null) return;

    setBusy(true);
    setError("");
    const correct = picked === riddle.answer;
    const points = correct ? HALLOWEEN_POINTS[riddle.difficulty] : 0;
    const outcome = await claimHalloween("trick", points);

    if (outcome.error) {
      setError(outcome.error);
      setBusy(false);
      return;
    }
    if (outcome.already) {
      setResult({
        title: "Already claimed",
        body: "This account already claimed its Halloween riddle on another device.",
        points: 0,
      });
      setStage("result");
      setBusy(false);
      return;
    }

    setResult({
      title: correct ? "Correct!" : "So close!",
      body: correct
        ? `The answer was “${riddle.choices[riddle.answer]}”.`
        : `The answer was “${riddle.choices[riddle.answer]}”. No points this year.`,
      points,
    });
    setStage("result");
    setBusy(false);
  }

  const riddlePoints = riddle ? HALLOWEEN_POINTS[riddle.difficulty] : 0;

  return (
    <>
      {!open && (
        <button
          className="halloween-trigger"
          onClick={openChallenge}
          type="button"
        >
          <span aria-hidden="true" className="halloween-trigger-emoji">
            🎃
          </span>
          <span className="halloween-trigger-copy">
            <strong>Trick or treat?</strong>
            <small>Halloween only · one go</small>
          </span>
        </button>
      )}

      {open && (
        <div
          className="halloween-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              closeChallenge();
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby="halloween-title"
            aria-modal="true"
            className="halloween-modal"
            role="dialog"
          >
            <button
              aria-label="Close trick or treat"
              className="halloween-close"
              onClick={closeChallenge}
              type="button"
            >
              <LuX size={16} />
            </button>

            <div aria-hidden="true" className="halloween-decor">
              <span className="halloween-moon" />
              <span className="halloween-bat bat-one">🦇</span>
              <span className="halloween-bat bat-two">🦇</span>
              <span className="halloween-ghost ghost-one">👻</span>
              <span className="halloween-ghost ghost-two">👻</span>
              <span className="halloween-pumpkin">🎃</span>
              <span className="halloween-candle candle-one">🕯️</span>
              <span className="halloween-candle candle-two">🕯️</span>
              <span className="halloween-spider">🕷️</span>
            </div>

            <p className="eyebrow">October 31 · Halloween</p>
            <h2 className="halloween-title" id="halloween-title">
              {stage === "riddle"
                ? "Answer the riddle"
                : stage === "result"
                  ? "Your Halloween treat"
                  : "Trick or treat?"}
            </h2>

            <div className="halloween-soundtrack">
              <span aria-hidden="true" className="halloween-soundtrack-icon">
                🎵
              </span>
              <span className="halloween-soundtrack-copy">
                <strong>
                  {halloweenTrack?.title ?? "No Halloween track yet"}
                </strong>
                <span>{musicHoliday?.name ?? "Halloween night"}</span>
              </span>
              {halloweenTrack ? (
                <button
                  className="halloween-soundtrack-button"
                  onClick={toggleMusic}
                  type="button"
                >
                  {musicPlaying ? "Pause" : "Play"}
                </button>
              ) : (
                <Link className="halloween-soundtrack-button" href="/music">
                  Add music
                </Link>
              )}
            </div>

            {stage === "choose" && (
              <>
                <p className="halloween-intro">
                  One choice this Halloween. Pick a treat for an instant boost,
                  or a trick for a riddle worth more points.
                </p>
                {!user && (
                  <p className="halloween-note">
                    Sign in to collect leaderboard points.
                  </p>
                )}
                <div className="halloween-choices">
                  <button
                    className="halloween-choice trick"
                    disabled={!user || busy}
                    onClick={() => {
                      setStage("riddle");
                      setPicked(null);
                      setError("");
                    }}
                    type="button"
                  >
                    <span aria-hidden="true" className="halloween-choice-emoji">
                      🕯️
                    </span>
                    <span>
                      <strong>Trick</strong>
                      <small>Answer a riddle · up to 30 pts</small>
                    </span>
                  </button>
                  <button
                    className="halloween-choice treat"
                    disabled={!user || busy}
                    onClick={claimTreat}
                    type="button"
                  >
                    <span aria-hidden="true" className="halloween-choice-emoji">
                      🍬
                    </span>
                    <span>
                      <strong>Treat</strong>
                      <small>Instant +10 leaderboard points</small>
                    </span>
                  </button>
                </div>
                {error && <p className="notice">{error}</p>}
              </>
            )}

            {stage === "riddle" && riddle && (
              <>
                <div className="halloween-riddle-meta">
                  <span
                    className={`halloween-difficulty ${riddle.difficulty}`}
                  >
                    {HALLOWEEN_DIFFICULTY_LABEL[riddle.difficulty]}
                  </span>
                  <span className="halloween-points-badge">
                    +{riddlePoints} pts
                  </span>
                </div>
                <p className="halloween-question">{riddle.question}</p>
                <div className="halloween-answers">
                  {riddle.choices.map((choice, index) => (
                    <button
                      aria-pressed={picked === index}
                      className={`halloween-answer${picked === index ? " picked" : ""}`}
                      key={choice}
                      onClick={() => setPicked(index)}
                      type="button"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
                {error && <p className="notice">{error}</p>}
                <div className="halloween-actions">
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setStage("choose");
                      setError("");
                    }}
                    type="button"
                  >
                    <LuArrowLeft size={14} /> Back
                  </button>
                  <button
                    className="primary-button"
                    disabled={picked === null || busy}
                    onClick={answerRiddle}
                    type="button"
                  >
                    {busy ? "Checking…" : "Answer"}
                  </button>
                </div>
              </>
            )}

            {stage === "result" && result && (
              <div className="halloween-result">
                <span aria-hidden="true" className="halloween-result-emoji">
                  {result.points > 0 ? "🎉" : "🎃"}
                </span>
                <h3>{result.title}</h3>
                <p>{result.body}</p>
                {result.points > 0 && (
                  <span className="halloween-points-badge">
                    +{result.points} leaderboard points
                  </span>
                )}
                <button
                  className="primary-button"
                  onClick={closeChallenge}
                  type="button"
                >
                  See you next Halloween
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
