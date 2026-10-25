"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  LuGraduationCap,
  LuPlus,
  LuTrash2,
} from "react-icons/lu";
import {
  useStudybook,
  type Exam,
} from "@/components/studybook-context";

type Countdown = {
  years: number;
  months: number;
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const ZERO: Countdown = {
  years: 0,
  months: 0,
  weeks: 0,
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
};

const UNITS: Array<{ key: keyof Countdown; label: string }> = [
  { key: "years", label: "Years" },
  { key: "months", label: "Months" },
  { key: "weeks", label: "Weeks" },
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
];

function addMonths(date: Date, count: number) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + count);
  const daysInMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(day, daysInMonth));
  return result;
}

function countdownTo(target: Date, now: Date): Countdown {
  if (target.getTime() <= now.getTime()) return ZERO;

  let cursor = new Date(now);
  let years = 0;
  for (let index = 0; index < 300; index += 1) {
    const next = addMonths(cursor, 12);
    if (next.getTime() > target.getTime()) break;
    cursor = next;
    years += 1;
  }

  let months = 0;
  for (let index = 0; index < 12; index += 1) {
    const next = addMonths(cursor, 1);
    if (next.getTime() > target.getTime()) break;
    cursor = next;
    months += 1;
  }

  const totalSeconds = Math.max(
    0,
    Math.floor((target.getTime() - cursor.getTime()) / 1000),
  );
  const totalDays = Math.floor(totalSeconds / 86_400);
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return { years, months, weeks, days, hours, minutes, seconds };
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatExamDate(exam: Exam) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(exam.date));
}

function createExamId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `exam:${crypto.randomUUID()}`
    : `exam:${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ExamReminder() {
  const { exams, isLoaded, setExams } = useStudybook();
  const [now, setNow] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const start = window.setTimeout(() => setNow(new Date()), 0);
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, []);

  const ordered = useMemo(() => {
    const at = now?.getTime() ?? 0;
    const future = exams
      .filter((exam) => new Date(exam.date).getTime() > at)
      .sort(
        (a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
    const past = exams
      .filter((exam) => new Date(exam.date).getTime() <= at)
      .sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    return [...future, ...past];
  }, [exams, now]);

  const selected =
    ordered.find((exam) => exam.id === selectedId) ?? ordered[0] ?? null;
  const selectedTime = selected ? new Date(selected.date).getTime() : 0;
  const isPast = Boolean(now && selected && selectedTime <= now.getTime());
  const parts =
    selected && now ? countdownTo(new Date(selected.date), now) : ZERO;

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!title.trim()) {
      setFormError("Give the exam a name.");
      return;
    }
    if (!date) {
      setFormError("Choose the exam date.");
      return;
    }

    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = (time || "09:00").split(":").map(Number);
    const target = new Date(year, month - 1, day, hour, minute, 0, 0);
    const currentNow = new Date();

    if (
      Number.isNaN(target.getTime()) ||
      target.getTime() <= currentNow.getTime()
    ) {
      setFormError("Choose a future date and time.");
      return;
    }

    const exam: Exam = {
      id: createExamId(),
      title: title.trim(),
      date: target.toISOString(),
      createdAt: currentNow.toISOString(),
    };

    setExams((current) => [...current, exam]);
    setSelectedId(exam.id);
    setTitle("");
    setDate("");
    setTime("09:00");
    setShowForm(false);
  }

  function handleDelete(id: string) {
    setExams((current) => current.filter((exam) => exam.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }

  return (
    <section aria-label="Exam countdown" className="panel exam-panel">
      <div className="panel-heading">
        <h2 className="panel-title">
          <LuGraduationCap aria-hidden="true" size={16} /> Exam countdown
        </h2>
        <div className="exam-heading-actions">
          {ordered.length > 1 && (
            <select
              aria-label="Choose exam"
              className="select exam-select"
              onChange={(event) => setSelectedId(event.target.value)}
              value={selected?.id ?? ""}
            >
              {ordered.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
            </select>
          )}
          <button
            className="secondary-button exam-add-button"
            onClick={() => {
              setFormError("");
              setShowForm((current) => !current);
            }}
            type="button"
          >
            <LuPlus size={14} /> Add exam
          </button>
        </div>
      </div>

      <div className="panel-body">
        {!isLoaded || !now ? (
          <p className="page-subtitle">Loading your countdown…</p>
        ) : selected ? (
          <>
            <div className="exam-hero">
              <div className="exam-hero-copy">
                <p className="eyebrow">
                  {isPast ? "Exam finished" : "Counting down to"}
                </p>
                <h3 className="exam-title">{selected.title}</h3>
                <p className="exam-date">{formatExamDate(selected)}</p>
              </div>
              <div className="exam-hero-actions">
                <span className={`exam-badge${isPast ? " past" : ""}`}>
                  {isPast ? "Finished" : "Upcoming"}
                </span>
                <button
                  aria-label={`Delete ${selected.title}`}
                  className="small-icon-button danger"
                  onClick={() => handleDelete(selected.id)}
                  type="button"
                >
                  <LuTrash2 size={14} />
                </button>
              </div>
            </div>

            <div aria-label="Time until exam" className="countdown-grid" role="timer">
              {UNITS.map((unit) => (
                <div
                  className={`countdown-unit${unit.key === "seconds" ? " seconds" : ""}`}
                  key={unit.key}
                >
                  <span className="countdown-value">
                    {String(parts[unit.key]).padStart(2, "0")}
                  </span>
                  <span className="countdown-label">{unit.label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="exam-empty">
            <span className="exam-empty-icon">
              <LuGraduationCap aria-hidden="true" size={22} />
            </span>
            <p className="empty-state-title">No exams yet</p>
            <p className="empty-state-copy">
              Add your next exam and watch the countdown to the second.
            </p>
            <button
              className="primary-button"
              onClick={() => setShowForm(true)}
              type="button"
            >
              <LuPlus size={14} /> Add your first exam
            </button>
          </div>
        )}

        {showForm && (
          <form className="exam-form" onSubmit={handleAdd}>
            <div className="form-grid">
              <div className="field full-width">
                <label htmlFor="exam-title">Exam name</label>
                <input
                  className="input"
                  id="exam-title"
                  maxLength={80}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Biology midterm"
                  value={title}
                />
              </div>
              <div className="field">
                <label htmlFor="exam-date">Date</label>
                <input
                  className="input"
                  id="exam-date"
                  min={now ? toDateInputValue(now) : undefined}
                  onChange={(event) => setDate(event.target.value)}
                  type="date"
                  value={date}
                />
              </div>
              <div className="field">
                <label htmlFor="exam-time">Time</label>
                <input
                  className="input"
                  id="exam-time"
                  onChange={(event) => setTime(event.target.value)}
                  type="time"
                  value={time}
                />
              </div>
            </div>
            {formError && <p className="notice">{formError}</p>}
            <div className="form-actions">
              <button
                className="secondary-button"
                onClick={() => setShowForm(false)}
                type="button"
              >
                Cancel
              </button>
              <button className="primary-button" type="submit">
                Start countdown
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
