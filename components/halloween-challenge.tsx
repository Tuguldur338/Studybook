"use client";

import { useEffect, useState } from "react";
import { LuArrowLeft, LuX } from "react-icons/lu";
import { useSupabaseUser } from "@/components/use-supabase-user";
import {
  HALLOWEEN_DIFFICULTY_LABEL,
  HALLOWEEN_POINTS,
  getHalloweenRiddle,
  isHalloween,
  type HalloweenRiddle,
} from "@/lib/halloween";
import { awardPoints } from "@/lib/leaderboard";

type Stage = "choose" | "riddle" | "result";

type ChallengeResult = {
  title: string;
  body: string;
  points: number;
};

const CLAIM_PREFIX = "studybook-halloween-claim-v1";

export default function HalloweenChallenge() {
  const { user } = useSupabaseUser();
  const [now, setNow] = useState<Date | null>(null);
  const [riddle, setRiddle] = useState<HalloweenRiddle | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("choose");
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const date = new Date();
      const year = date.getFullYear();
      setNow(date);
      setRiddle(getHalloweenRiddle(year));
      try {
        setClaimed(
          Boolean(
            window.localStorage.getItem(
              `${CLAIM_PREFIX}:${year}:${user?.id ?? "guest"}`,
            ),
          ),
        );
      } catch {
        setClaimed(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user?.id]);

  if (!now || !isHalloween(now) || (claimed && !open)) {
    return null;
  }

  const year = now.getFullYear();
  const claimKey = `${CLAIM_PREFIX}:${year}:${user?.id ?? "guest"}`;

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

  function markClaimed(choice: "treat" | "trick", points: number) {
    try {
      window.localStorage.setItem(
        claimKey,
        JSON.stringify({
          choice,
          points,
          at: new Date().toISOString(),
        }),
      );
    } catch {
      // The event still works; only the yearly lock is device-local.
    }
    setClaimed(true);
  }

  async function claimTreat() {
    if (!user) {
      setError("Sign in to collect leaderboard points.");
      return;
    }
    setBusy(true);
    setError("");
    const award = await awardPoints(10);
    if (!award.ok) {
      setError(award.message ?? "Could not claim the treat.");
      setBusy(false);
      return;
    }
    markClaimed("treat", 10);
    setResult({
      title: "Treat claimed!",
      body: "A sweet little boost for your leaderboard.",
      points: 10,
    });
    setStage("result");
    setBusy(false);
  }

  async function answerRiddle() {
    if (!riddle || picked === null) return;
    if (!user) {
      setError("Sign in to collect leaderboard points.");
      return;
    }

    setBusy(true);
    setError("");
    const correct = picked === riddle.answer;
    const points = correct ? HALLOWEEN_POINTS[riddle.difficulty] : 0;

    if (correct) {
      const award = await awardPoints(points);
      if (!award.ok) {
        setError(award.message ?? "Could not add the points.");
        setBusy(false);
        return;
      }
    }

    markClaimed("trick", points);
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

            <p className="eyebrow">October 31 · Halloween</p>
            <h2 className="halloween-title" id="halloween-title">
              {stage === "riddle"
                ? "Answer the riddle"
                : stage === "result"
                  ? "Your Halloween treat"
                  : "Trick or treat?"}
            </h2>

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
