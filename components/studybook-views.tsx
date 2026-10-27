"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  LuArrowRight,
  LuCalendarDays,
  LuCalendarPlus,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuCircleAlert,
  LuCircleCheck,
  LuClock,
  LuExternalLink,
  LuFileText,
  LuNotebookPen,
  LuPencil,
  LuPlus,
  LuRefreshCw,
  LuSearch,
  LuSun,
  LuSunrise,
  LuMoon,
  LuMusic,
  LuPause,
  LuPlay,
  LuTrash2,
  LuTrophy,
  LuUpload,
  LuVolume2,
  LuX,
} from "react-icons/lu";
import {
  FONT_OPTIONS,
  NOTE_COLORS,
  useStudybook,
  type ClassSession,
  type FontFamily,
  type NoteColor,
  type RoutineItem,
  type SavedClass,
  type StudyNote,
  type StudyTask,
} from "@/components/studybook-context";
import { ProfileAvatar } from "@/components/studybook-shell";
import ExamReminder from "@/components/exam-reminder";
import { useMusic } from "@/components/music-context";
import { useSupabaseUser } from "@/components/use-supabase-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { HOLIDAYS } from "@/lib/holidays";
import { awardTaskPoints } from "@/lib/leaderboard";
import { isPlayableSource } from "@/lib/music-store";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const shortWeekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const NOTE_SWATCH: Record<NoteColor, string> = {
  default: "#1f7a5c",
  sage: "#4f8f6f",
  sky: "#3b82c4",
  rose: "#d46a7a",
  amber: "#d99a2b",
  violet: "#7c6fd6",
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type NotifyFn = (message: string, type?: "success" | "error" | "info") => void;

function notifyPointsResult(
  result: Awaited<ReturnType<typeof awardTaskPoints>>,
  notify: NotifyFn,
) {
  if (!result.ok) {
    if (result.message) notify(result.message, "error");
    return;
  }

  notify(`${result.delta > 0 ? "+" : ""}${result.delta} leaderboard points.`);
}

function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isOverdue(task: StudyTask, todayStr: string) {
  return !task.completed && !!task.dueDate && task.dueDate < todayStr;
}

function getGreeting(hour: number) {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date(2020, 0, 1, hours, minutes);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value: string) {
  if (!value) return "No due date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function hasOverlap(list: ClassSession[]) {
  const sorted = [...list].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startTime < sorted[i - 1].endTime) return true;
  }
  return false;
}

const HOUR_HEIGHT = 64;

function startOfWeek(date: Date) {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function minutesSinceMidnight(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function classSignature(
  value: Pick<
    ClassSession,
    "subject" | "day" | "startTime" | "endTime" | "location" | "instructor"
  >,
) {
  return [
    value.subject.trim().toLowerCase(),
    value.day,
    value.startTime,
    value.endTime,
    value.location.trim().toLowerCase(),
    value.instructor.trim().toLowerCase(),
  ].join("|");
}

function formatWeekRange(start: Date) {
  const format = (date: Date) =>
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(date);
  return `${format(start)} – ${format(addDays(start, 4))}`;
}

function formatHour(hour: number) {
  const suffix = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  copy,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <div className="empty-state">
      <div>
        <span className="empty-state-icon">{icon}</span>
        <p className="empty-state-title">{title}</p>
        <p className="empty-state-copy">{copy}</p>
      </div>
    </div>
  );
}

function ClassRow({ session }: { session: ClassSession }) {
  return (
    <div className="class-row">
      <div className="class-time">
        {formatTime(session.startTime)}
        <br />
        {formatTime(session.endTime)}
      </div>
      <span className="class-color" />
      <div>
        <div className="class-name">{session.subject}</div>
        <div className="class-location">
          {[session.location, session.instructor].filter(Boolean).join(" · ") ||
            "Class details not added"}
        </div>
      </div>
      <div className="class-day">{shortWeekdays[session.day]}</div>
    </div>
  );
}

function ConfirmDialog({
  title,
  copy,
  confirmLabel = "Delete",
  onCancel,
  onConfirm,
}: {
  title: string;
  copy: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <section
        aria-modal="true"
        className="modal confirm-dialog"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
      >
        <span className="confirm-icon">
          <LuTrash2 size={22} />
        </span>
        <h2 className="confirm-title">{title}</h2>
        <p className="confirm-copy">{copy}</p>
        <div className="confirm-actions">
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="primary-button danger-button"
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
export default function DashboardView() {
  const { classes, notes, notify, profile, setTasks, tasks } = useStudybook();
  const [today, setToday] = useState<{ day: number; label: string } | null>(
    null,
  );
  const [greeting, setGreeting] = useState("Welcome");
  const [todayStr, setTodayStr] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const now = new Date();
      setToday({
        day: (now.getDay() + 6) % 7,
        label: new Intl.DateTimeFormat(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        }).format(now),
      });
      setGreeting(getGreeting(now.getHours()));
      setTodayStr(toISODate(now));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const todaysClasses =
    today && today.day < 5
      ? classes
          .filter((session) => session.day === today.day)
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
      : [];

  const pendingTasks = tasks.filter((task) => !task.completed);
  const completedCount = tasks.length - pendingTasks.length;
  const progress =
    tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);
  const overdueCount = pendingTasks.filter((task) =>
    isOverdue(task, todayStr),
  ).length;

  const nextTasks = [...pendingTasks]
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, 3);

  const firstName = profile.name.trim().split(/\s+/)[0] || "student";

  function completeTask(task: StudyTask) {
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, completed: true } : item,
      ),
    );
    void awardTaskPoints(task.priority, 1).then((result) =>
      notifyPointsResult(result, notify),
    );
  }

  return (
    <>
      <section className="welcome-card">
        <div className="welcome-decor" aria-hidden="true" />
        <div className="welcome-content">
          <p className="welcome-kicker">
            {greeting} · {today?.label ?? "Your study week"}
          </p>
          <h1 className="welcome-title">Hey, {firstName}.</h1>
          <p className="welcome-copy">
            A fresh page, a clear plan, and a little progress at a time. Your
            study week starts here.
          </p>
          <Link className="primary-button" href="/schedule">
            View my schedule{" "}
            <span className="arrow-icon">
              <LuArrowRight aria-hidden="true" size={14} />
            </span>
          </Link>
        </div>
      </section>

      <section aria-label="Studybook summary" className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">
            <LuCalendarDays aria-hidden="true" size={20} />
          </span>
          <div>
            <div className="stat-label">Classes this week</div>
            <div className="stat-value">{classes.length}</div>
            <div className="stat-note">Your weekly rhythm</div>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <LuCircleCheck aria-hidden="true" size={20} />
          </span>
          <div>
            <div className="stat-label">To-dos to finish</div>
            <div className="stat-value">{pendingTasks.length}</div>
            <div className="stat-note">
              {overdueCount > 0
                ? `${overdueCount} overdue`
                : pendingTasks.length === 1
                  ? "One step at a time"
                  : "Keep it up"}
            </div>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <LuNotebookPen aria-hidden="true" size={20} />
          </span>
          <div>
            <div className="stat-label">Study notes</div>
            <div className="stat-value">{notes.length}</div>
            <div className="stat-note">Ideas worth keeping</div>
          </div>
        </div>
      </section>
      <section
        className="panel"
        style={{ marginBottom: 16, padding: "20px 22px" }}
      >
        <div className="panel-heading" style={{ padding: 0 }}>
          <h2 className="panel-title">Your progress</h2>
          <span className="panel-link">
            {completedCount} of {tasks.length} tasks done
          </span>
        </div>
        <div className="progress-wrap">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <ExamReminder />

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2 className="panel-title">Today&apos;s classes</h2>
            <Link className="panel-link" href="/schedule">
              Full schedule{" "}
              <span className="arrow-icon">
                <LuArrowRight aria-hidden="true" size={13} />
              </span>
            </Link>
          </div>
          <div className="panel-body">
            {todaysClasses.length ? (
              <div className="schedule-list">
                {todaysClasses.map((session) => (
                  <ClassRow key={session.id} session={session} />
                ))}
              </div>
            ) : (
              <EmptyState
                copy={
                  classes.length
                    ? "There are no classes on your schedule today."
                    : "Add your classes to see your day at a glance."
                }
                icon={<LuCalendarPlus aria-hidden="true" size={22} />}
                title={
                  classes.length
                    ? "No classes today"
                    : "Your schedule starts here"
                }
              />
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2 className="panel-title">Next up</h2>
            <Link className="panel-link" href="/to-do-list">
              All tasks{" "}
              <span className="arrow-icon">
                <LuArrowRight aria-hidden="true" size={13} />
              </span>
            </Link>
          </div>
          <div className="panel-body">
            {nextTasks.length ? (
              <div className="task-list">
                {nextTasks.map((task) => (
                  <div
                    className={`task-row${isOverdue(task, todayStr) ? " overdue" : ""}`}
                    key={task.id}
                  >
                    <button
                      aria-label={`Complete ${task.title}`}
                      className="task-check dashboard-task-check"
                      onClick={() => completeTask(task)}
                      type="button"
                    />
                    <div className="task-main">
                      <div className="task-title">{task.title}</div>
                      <div className="task-meta">
                        {task.course || "Personal"}
                        <span>
                          {isOverdue(task, todayStr) ? (
                            <span className="overdue-label">
                              <LuClock size={12} /> Overdue ·{" "}
                              {formatDate(task.dueDate)}
                            </span>
                          ) : (
                            formatDate(task.dueDate)
                          )}
                        </span>
                      </div>
                    </div>
                    <span className={`priority-badge ${task.priority}`}>
                      {task.priority}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                copy="When you add a task, your next steps will show up here."
                icon={<LuCircleCheck aria-hidden="true" size={22} />}
                title="All caught up"
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}
const emptyClassForm = {
  subject: "",
  day: "0",
  startTime: "09:00",
  endTime: "10:00",
  location: "",
  instructor: "",
};

const SAVED_CLASSES_SEEDED_KEY = "studybook-saved-classes-seeded-v1";

export function ScheduleView() {
  const {
    classChecks,
    classes,
    isLoaded,
    notify,
    savedClasses,
    setClassChecks,
    setClasses,
    setSavedClasses,
  } = useStudybook();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyClassForm);
  const [formError, setFormError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [todayDay, setTodayDay] = useState<number | null>(null);
  const [weekAnchor, setWeekAnchor] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const weekOffsetRef = useRef(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const now = new Date();
      setTodayDay((now.getDay() + 6) % 7);
      setWeekAnchor(toISODate(startOfWeek(now)));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    weekOffsetRef.current = weekOffset;
  }, [weekOffset]);

  // Roll onto the new week at midnight while the page stays open.
  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = new Date();
      setTodayDay((now.getDay() + 6) % 7);
      if (weekOffsetRef.current !== 0) return;
      setWeekAnchor((current) => {
        const monday = toISODate(startOfWeek(now));
        return current === monday ? current : monday;
      });
    }, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  // Seed the saved list once from classes that already exist, so a schedule
  // created before this feature still offers reusable entries. A stored marker
  // keeps the list from coming back after the user removes every saved class.
  useEffect(() => {
    if (!isLoaded) return;

    let alreadySeeded = false;
    try {
      alreadySeeded =
        window.localStorage.getItem(SAVED_CLASSES_SEEDED_KEY) === "1";
    } catch {
      // Private mode/storage errors should not block the schedule.
    }
    if (alreadySeeded) return;

    try {
      window.localStorage.setItem(SAVED_CLASSES_SEEDED_KEY, "1");
    } catch {
      // The seed is a convenience; ignore storage failures.
    }

    if (savedClasses.length > 0 || classes.length === 0) return;

    setSavedClasses(
      classes.slice(0, 12).map((item) => ({
        ...item,
        id: createId(),
        savedAt: new Date().toISOString(),
      })),
    );
  }, [classes, isLoaded, savedClasses.length, setSavedClasses]);

  function startEditing(session: ClassSession) {
    setEditingId(session.id);
    setForm({
      subject: session.subject,
      day: String(session.day),
      startTime: session.startTime,
      endTime: session.endTime,
      location: session.location,
      instructor: session.instructor,
    });
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyClassForm);
    setFormError("");
  }

  function applySavedClass(saved: SavedClass) {
    setForm({
      subject: saved.subject,
      day: String(saved.day),
      startTime: saved.startTime,
      endTime: saved.endTime,
      location: saved.location,
      instructor: saved.instructor,
    });
    setFormError("");
  }

  function removeSavedClass(id: string) {
    setSavedClasses((current) => current.filter((item) => item.id !== id));
    notify("Removed from saved classes.");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.endTime <= form.startTime) {
      setFormError("The end time must be later than the start time.");
      return;
    }

    const session: ClassSession = {
      id: editingId ?? createId(),
      subject: form.subject.trim(),
      day: Number(form.day),
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location.trim(),
      instructor: form.instructor.trim(),
    };

    setClasses((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? session : item))
        : [...current, session],
    );

    const signature = classSignature(session);
    setSavedClasses((current) =>
      [
        { ...session, id: createId(), savedAt: new Date().toISOString() },
        ...current.filter((item) => classSignature(item) !== signature),
      ].slice(0, 12),
    );
    notify(editingId ? "Class updated." : "Class added.");
    closeForm();
  }

  const sortedClasses = [...classes].sort(
    (a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime),
  );
  const classesByDay = weekdays.map((_, index) =>
    sortedClasses.filter((session) => session.day === index),
  );

  const currentWeekStart = weekAnchor
    ? new Date(`${weekAnchor}T00:00:00`)
    : null;
  const viewedWeekStart = currentWeekStart
    ? addDays(currentWeekStart, weekOffset * 7)
    : null;
  const weekKey = viewedWeekStart ? toISODate(viewedWeekStart) : "";
  const dayDates = viewedWeekStart
    ? weekdays.map((_, index) => addDays(viewedWeekStart, index))
    : [];

  const subjectOptions = useMemo(() => {
    const values = new Set<string>();
    [...savedClasses, ...classes].forEach((item) => {
      const subject = item.subject.trim();
      if (subject) values.add(subject);
    });
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [classes, savedClasses]);

  const locationOptions = useMemo(() => {
    const values = new Set<string>();
    [...savedClasses, ...classes].forEach((item) => {
      const location = item.location.trim();
      if (location) values.add(location);
    });
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [classes, savedClasses]);

  const instructorOptions = useMemo(() => {
    const values = new Set<string>();
    [...savedClasses, ...classes].forEach((item) => {
      const instructor = item.instructor.trim();
      if (instructor) values.add(instructor);
    });
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [classes, savedClasses]);

  const existingSignatures = useMemo(
    () => new Set(classes.map((item) => classSignature(item))),
    [classes],
  );

  function checkState(id: string) {
    return (
      classChecks[`${weekKey}:${id}`] ?? { classwork: false, homework: false }
    );
  }

  function toggleCheck(id: string, kind: "classwork" | "homework") {
    if (!weekKey) return;
    const key = `${weekKey}:${id}`;
    setClassChecks((current) => {
      const entry = current[key] ?? { classwork: false, homework: false };
      return { ...current, [key]: { ...entry, [kind]: !entry[kind] } };
    });
  }

  function renderChecks(session: ClassSession) {
    const state = checkState(session.id);
    return (
      <div className="class-checks">
        <label className="check-chip">
          <input
            aria-label={`Classwork done for ${session.subject}`}
            checked={state.classwork}
            disabled={!weekKey}
            onChange={() => toggleCheck(session.id, "classwork")}
            type="checkbox"
          />
          <span>Classwork</span>
        </label>
        <label className="check-chip">
          <input
            aria-label={`Homework done for ${session.subject}`}
            checked={state.homework}
            disabled={!weekKey}
            onChange={() => toggleCheck(session.id, "homework")}
            type="checkbox"
          />
          <span>Homework</span>
        </label>
      </div>
    );
  }

  const startHour = classes.length
    ? Math.max(
        0,
        Math.min(
          8,
          Math.floor(
            Math.min(
              ...classes.map((session) =>
                minutesSinceMidnight(session.startTime),
              ),
            ) / 60,
          ),
        ),
      )
    : 8;
  const endHour = classes.length
    ? Math.min(
        24,
        Math.max(
          18,
          Math.ceil(
            Math.max(
              ...classes.map((session) =>
                minutesSinceMidnight(session.endTime),
              ),
            ) / 60,
          ),
        ),
      )
    : 18;
  const hours = Array.from(
    { length: endHour - startHour },
    (_, index) => startHour + index,
  );

  const weekOffsetLabel =
    weekOffset === 0
      ? "This week"
      : weekOffset === -1
        ? "Last week"
        : weekOffset === 1
          ? "Next week"
          : weekOffset < 0
            ? `${Math.abs(weekOffset)} weeks ago`
            : `In ${weekOffset} weeks`;

  return (
    <>
      <PageHeading
        action={
          <button
            className="primary-button"
            onClick={() => {
              setEditingId(null);
              setForm(emptyClassForm);
              setFormError("");
              setFormOpen((open) => !open);
            }}
            type="button"
          >
            <LuPlus size={16} /> Add a class
          </button>
        }
        eyebrow="Make room for learning"
        subtitle="Add each class with its day and times, then tick off classwork and homework as you finish them. Checks start fresh every Monday."
        title="Weekly schedule"
      />
      {formOpen && (
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <h2 className="panel-title" style={{ marginBottom: 16 }}>
            {editingId ? "Update class" : "Add a class"}
          </h2>
          {!editingId && savedClasses.length > 0 && (
            <div className="saved-classes">
              <p className="saved-classes-label">
                Saved classes — tap one to fill the form, or × to remove the
                shortcut
              </p>
              <div className="saved-classes-list">
                {savedClasses.map((saved) => {
                  const added = existingSignatures.has(classSignature(saved));
                  return (
                    <div className="saved-class-item" key={saved.id}>
                      <button
                        className={`saved-class-chip${added ? " added" : ""}`}
                        onClick={() => applySavedClass(saved)}
                        type="button"
                      >
                        <strong>{saved.subject}</strong>
                        <span>
                          {added
                            ? "In schedule"
                            : `${shortWeekdays[saved.day]} · ${formatTime(saved.startTime)}`}
                        </span>
                      </button>
                      <button
                        aria-label={`Remove ${saved.subject} from saved classes`}
                        className="saved-class-remove"
                        onClick={() => removeSavedClass(saved.id)}
                        type="button"
                      >
                        <LuX size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="class-subject">Class name</label>
              <input
                autoFocus
                className="input"
                id="class-subject"
                list="class-subject-options"
                onChange={(event) =>
                  setForm({ ...form, subject: event.target.value })
                }
                placeholder="e.g. Biology"
                required
                value={form.subject}
              />
            </div>
            <div className="field">
              <label htmlFor="class-day">Day</label>
              <div className="select-wrap">
                <select
                  className="select"
                  id="class-day"
                  onChange={(event) =>
                    setForm({ ...form, day: event.target.value })
                  }
                  value={form.day}
                >
                  {weekdays.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
                <span aria-hidden="true" className="select-chevron">
                  <LuChevronDown size={15} strokeWidth={2.5} />
                </span>
              </div>
            </div>
            <div className="field">
              <label htmlFor="class-start">Starts</label>
              <input
                className="input"
                id="class-start"
                onChange={(event) =>
                  setForm({ ...form, startTime: event.target.value })
                }
                required
                type="time"
                value={form.startTime}
              />
            </div>
            <div className="field">
              <label htmlFor="class-end">Ends</label>
              <input
                className="input"
                id="class-end"
                onChange={(event) =>
                  setForm({ ...form, endTime: event.target.value })
                }
                required
                type="time"
                value={form.endTime}
              />
            </div>
            <div className="field">
              <label htmlFor="class-location">Room or location</label>
              <input
                className="input"
                id="class-location"
                list="class-location-options"
                onChange={(event) =>
                  setForm({ ...form, location: event.target.value })
                }
                placeholder="e.g. Room 204"
                value={form.location}
              />
            </div>
            <div className="field">
              <label htmlFor="class-instructor">Teacher</label>
              <input
                className="input"
                id="class-instructor"
                list="class-instructor-options"
                onChange={(event) =>
                  setForm({ ...form, instructor: event.target.value })
                }
                placeholder="Optional"
                value={form.instructor}
              />
            </div>
          </div>
          <datalist id="class-subject-options">
            {subjectOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <datalist id="class-location-options">
            {locationOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <datalist id="class-instructor-options">
            {instructorOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          {formError && (
            <p aria-live="polite" className="notice" style={{ marginTop: 13 }}>
              {formError}
            </p>
          )}
          <div className="form-actions">
            <button
              className="secondary-button"
              onClick={closeForm}
              type="button"
            >
              Cancel
            </button>
            <button className="primary-button" type="submit">
              {editingId ? "Save changes" : "Add class"}
            </button>
          </div>
        </form>
      )}

      <section aria-label="Weekly schedule" className="panel schedule-panel">
        <div className="week-toolbar">
          <button
            aria-label="Previous week"
            className="week-arrow"
            onClick={() => setWeekOffset((offset) => offset - 1)}
            type="button"
          >
            <LuChevronLeft size={18} />
          </button>
          <div className="week-caption">
            <strong>
              {viewedWeekStart ? formatWeekRange(viewedWeekStart) : "This week"}
            </strong>
            <span>{weekOffsetLabel}</span>
          </div>
          <button
            aria-label="Next week"
            className="week-arrow"
            onClick={() => setWeekOffset((offset) => offset + 1)}
            type="button"
          >
            <LuChevronRight size={18} />
          </button>
          {weekOffset !== 0 && (
            <button
              aria-label="Back to this week"
              className="text-button"
              onClick={() => {
                setWeekAnchor(toISODate(startOfWeek(new Date())));
                setWeekOffset(0);
              }}
              type="button"
            >
              This week
            </button>
          )}
        </div>

        {classes.length > 0 && (
          <div className="week-checklist">
            <div className="week-checklist-inner">
              <div className="checklist-head">
                <h2>Classwork &amp; homework</h2>
                <span>Ticks reset every Monday</span>
              </div>
              <div className="checklist-grid">
                {weekdays.map((day, index) => (
                  <div className="checklist-day" key={day}>
                    <h3>{day}</h3>
                    {classesByDay[index].length ? (
                      classesByDay[index].map((session) => (
                        <div className="checklist-row" key={session.id}>
                          <div className="checklist-class">
                            <span>{session.subject}</span>
                            <small>{formatTime(session.startTime)}</small>
                          </div>
                          {renderChecks(session)}
                        </div>
                      ))
                    ) : (
                      <p className="checklist-empty">No classes</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div
          className="timetable"
          style={
            {
              "--hour-height": `${HOUR_HEIGHT}px`,
              "--hour-count": endHour - startHour,
            } as CSSProperties
          }
        >
          <div className="timetable-head">
            <div aria-hidden="true" className="timetable-corner" />
            {weekdays.map((day, index) => (
              <div
                className={`timetable-day${weekOffset === 0 && todayDay === index ? " today" : ""}`}
                key={day}
              >
                <span>{shortWeekdays[index]}</span>
                <small>
                  {dayDates[index]
                    ? new Intl.DateTimeFormat(undefined, {
                        month: "short",
                        day: "numeric",
                      }).format(dayDates[index])
                    : ""}
                </small>
              </div>
            ))}
          </div>
          <div className="timetable-body">
            <div aria-hidden="true" className="time-scale">
              {hours.map((hour) => (
                <div className="time-slot" key={hour}>
                  {formatHour(hour)}
                </div>
              ))}
            </div>
            {weekdays.map((day, index) => (
              <div
                aria-label={day}
                className={`day-lane${weekOffset === 0 && todayDay === index ? " today" : ""}`}
                key={day}
                role="group"
              >
                {classesByDay[index].map((session) => {
                  const state = checkState(session.id);
                  const complete = state.classwork && state.homework;
                  const start = minutesSinceMidnight(session.startTime);
                  const end = minutesSinceMidnight(session.endTime);
                  const top = ((start - startHour * 60) / 60) * HOUR_HEIGHT;
                  const height = Math.max(
                    ((end - start) / 60) * HOUR_HEIGHT - 4,
                    62,
                  );
                  return (
                    <article
                      className={`time-block${complete ? " complete" : ""}`}
                      key={session.id}
                      style={{ height: `${height}px`, top: `${top}px` }}
                    >
                      <div className="time-block-head">
                        <span className="time-block-title">
                          {session.subject}
                        </span>
                        <span className="time-block-actions">
                          <button
                            aria-label={`Edit ${session.subject}`}
                            className="block-action"
                            onClick={() => startEditing(session)}
                            type="button"
                          >
                            <LuPencil size={12} />
                          </button>
                          <button
                            aria-label={`Delete ${session.subject}`}
                            className="block-action danger"
                            onClick={() => setDeleteId(session.id)}
                            type="button"
                          >
                            <LuTrash2 size={12} />
                          </button>
                        </span>
                      </div>
                      <span className="time-block-time">
                        {formatTime(session.startTime)} –{" "}
                        {formatTime(session.endTime)}
                        {session.location ? ` · ${session.location}` : ""}
                      </span>
                    </article>
                  );
                })}
                {hasOverlap(classesByDay[index]) && (
                  <span className="overlap-badge lane-overlap">
                    <LuCircleAlert size={12} /> Overlap
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="week-grid">
          {weekdays.map((day, index) => {
            const dayClasses = classesByDay[index];
            const overlap = hasOverlap(dayClasses);
            return (
              <div
                className={`day-column${todayDay === index && weekOffset === 0 ? " today" : ""}`}
                key={day}
              >
                <div className="day-heading">
                  {day}
                  <span className="day-count">{dayClasses.length}</span>
                </div>
                {dayClasses.length ? (
                  dayClasses.map((session) => (
                    <article className="day-class" key={session.id}>
                      <div className="day-class-title">{session.subject}</div>
                      <div className="day-class-time">
                        {formatTime(session.startTime)} –{" "}
                        {formatTime(session.endTime)}
                      </div>
                      {session.location && (
                        <div className="day-class-location">
                          {session.location}
                        </div>
                      )}
                      {renderChecks(session)}
                      <div className="inline-actions" style={{ marginTop: 8 }}>
                        <button
                          aria-label={`Edit ${session.subject}`}
                          className="small-icon-button"
                          onClick={() => startEditing(session)}
                          type="button"
                        >
                          <LuPencil size={13} />
                        </button>
                        <button
                          aria-label={`Delete ${session.subject}`}
                          className="small-icon-button danger"
                          onClick={() => setDeleteId(session.id)}
                          type="button"
                        >
                          <LuTrash2 size={13} />
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="day-empty">Nothing planned</div>
                )}
                {overlap && (
                  <span className="overlap-badge">
                    <LuCircleAlert size={12} /> Overlapping times
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <p className="page-subtitle" style={{ marginTop: 14 }}>
        {classes.length
          ? `${classes.length} ${classes.length === 1 ? "class" : "classes"} planned each week. Classwork and homework checks reset every Monday.`
          : "Your schedule is saved on this device, so you can come back and update it anytime."}
      </p>

      {deleteId && (
        <ConfirmDialog
          copy="This class will be removed from your weekly schedule."
          onCancel={() => setDeleteId(null)}
          onConfirm={() => {
            setClasses((current) =>
              current.filter((item) => item.id !== deleteId),
            );
            setDeleteId(null);
            notify("Class removed.");
          }}
          title="Delete this class?"
        />
      )}
    </>
  );
}
const emptyTaskForm = {
  title: "",
  course: "",
  dueDate: "",
  priority: "medium" as StudyTask["priority"],
};

type TaskFilter = "all" | "active" | "done";
type TaskSort = "due" | "priority" | "newest";

export function ToDoListView() {
  const { notify, setTasks, tasks } = useStudybook();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyTaskForm);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("active");
  const [sort, setSort] = useState<TaskSort>("due");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [todayStr, setTodayStr] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTodayStr(toISODate(new Date()));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function startEditing(task: StudyTask) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      course: task.course,
      dueDate: task.dueDate,
      priority: task.priority,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyTaskForm);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const existing = editingId
      ? tasks.find((task) => task.id === editingId)
      : undefined;
    const task: StudyTask = {
      title: form.title.trim(),
      course: form.course.trim(),
      dueDate: form.dueDate,
      priority: form.priority,
      id: editingId ?? createId(),
      completed: existing?.completed ?? false,
    };
    setTasks((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? task : item))
        : [task, ...current],
    );
    notify(editingId ? "Task updated." : "Task added.");
    closeForm();
  }

  const completedCount = tasks.filter((task) => task.completed).length;
  const progress =
    tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  const filtered = useMemo(() => {
    let list = [...tasks];
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (task) =>
          task.title.toLowerCase().includes(q) ||
          task.course.toLowerCase().includes(q),
      );
    }
    if (filter === "active") list = list.filter((task) => !task.completed);
    else if (filter === "done") list = list.filter((task) => task.completed);

    const rank = { high: 0, medium: 1, low: 2 } as const;
    list.sort((a, b) => {
      if (sort === "due") {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (sort === "priority") {
        return (
          rank[a.priority] - rank[b.priority] ||
          (a.dueDate && b.dueDate ? a.dueDate.localeCompare(b.dueDate) : 0)
        );
      }
      return 0;
    });
    return list;
  }, [tasks, query, filter, sort]);

  function clearCompleted() {
    setTasks((current) => current.filter((task) => !task.completed));
    notify(
      `Cleared ${completedCount} completed ${completedCount === 1 ? "task" : "tasks"}.`,
    );
  }

  function handleToggleTask(task: StudyTask) {
    const nextCompleted = !task.completed;
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, completed: nextCompleted } : item,
      ),
    );
    void awardTaskPoints(task.priority, nextCompleted ? 1 : -1).then(
      (result) => notifyPointsResult(result, notify),
    );
  }

  function renderTask(task: StudyTask) {
    const overdue = isOverdue(task, todayStr);
    return (
      <div className={`task-row${overdue ? " overdue" : ""}`} key={task.id}>
        <input
          aria-label={`${task.completed ? "Reopen" : "Complete"} ${task.title}`}
          checked={task.completed}
          className="task-check"
          onChange={() => handleToggleTask(task)}
          type="checkbox"
        />
        <div className="task-main">
          <div className={`task-title${task.completed ? " completed" : ""}`}>
            {task.title}
          </div>
          <div className="task-meta">
            <span>{task.course || "Personal"}</span>
            {task.dueDate && (
              <span>
                {overdue ? (
                  <span className="overdue-label">
                    <LuClock size={12} /> Overdue · {formatDate(task.dueDate)}
                  </span>
                ) : (
                  formatDate(task.dueDate)
                )}
              </span>
            )}
          </div>
        </div>
        <span className={`priority-badge ${task.priority}`}>
          {task.priority}
        </span>
        <div className="inline-actions">
          <button
            aria-label={`Edit ${task.title}`}
            className="small-icon-button"
            onClick={() => startEditing(task)}
            type="button"
          >
            <LuPencil size={13} />
          </button>
          <button
            aria-label={`Delete ${task.title}`}
            className="small-icon-button danger"
            onClick={() => setDeleteId(task.id)}
            type="button"
          >
            <LuTrash2 size={13} />
          </button>
        </div>
      </div>
    );
  }

  const heading =
    filter === "all" ? "All tasks" : filter === "active" ? "To do" : "Done";

  return (
    <>
      <PageHeading
        action={
          <button
            className="primary-button"
            onClick={() => setFormOpen((open) => !open)}
            type="button"
          >
            <LuPlus size={16} /> Add a task
          </button>
        }
        eyebrow="One thing at a time"
        subtitle="Keep track of homework, projects, and the little things you don't want to forget."
        title="To-do list"
      />
      {formOpen && (
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <h2 className="panel-title" style={{ marginBottom: 16 }}>
            {editingId ? "Edit task" : "Add a task"}
          </h2>
          <div className="form-grid">
            <div className="field full-width">
              <label htmlFor="task-title">What do you need to do?</label>
              <input
                autoFocus
                className="input"
                id="task-title"
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                placeholder="e.g. Finish chapter 4 questions"
                required
                value={form.title}
              />
            </div>
            <div className="field">
              <label htmlFor="task-course">Class or subject</label>
              <input
                className="input"
                id="task-course"
                onChange={(event) =>
                  setForm({ ...form, course: event.target.value })
                }
                placeholder="Optional"
                value={form.course}
              />
            </div>
            <div className="field">
              <label htmlFor="task-due">Due date</label>
              <input
                className="input"
                id="task-due"
                onChange={(event) =>
                  setForm({ ...form, dueDate: event.target.value })
                }
                type="date"
                value={form.dueDate}
              />
            </div>
            <div className="field">
              <label htmlFor="task-priority">Priority</label>
              <div className="select-wrap">
                <select
                  className="select"
                  id="task-priority"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      priority: event.target.value as StudyTask["priority"],
                    })
                  }
                  value={form.priority}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <span aria-hidden="true" className="select-chevron">
                  <LuChevronDown size={15} strokeWidth={2.5} />
                </span>
              </div>
            </div>
          </div>
          <div className="form-actions">
            <button
              className="secondary-button"
              onClick={closeForm}
              type="button"
            >
              Cancel
            </button>
            <button className="primary-button" type="submit">
              {editingId ? "Save changes" : "Add task"}
            </button>
          </div>
        </form>
      )}

      <section
        className="panel"
        style={{ marginBottom: 16, padding: "20px 22px" }}
      >
        <div className="panel-heading" style={{ padding: 0 }}>
          <h2 className="panel-title">Your progress</h2>
          <span className="panel-link">
            {completedCount} of {tasks.length} done · {progress}%
          </span>
        </div>
        <div className="progress-wrap">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <div className="toolbar">
        <div className="search-box">
          <LuSearch size={16} />
          <input
            aria-label="Search tasks"
            className="search-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks..."
            value={query}
          />
        </div>
        <div className="chip-group">
          {(["all", "active", "done"] as const).map((value) => (
            <button
              className={`chip${filter === value ? " active" : ""}`}
              key={value}
              onClick={() => setFilter(value)}
              type="button"
            >
              {value === "all" ? "All" : value === "active" ? "To do" : "Done"}
            </button>
          ))}
        </div>
        <select
          aria-label="Sort tasks"
          className="sort-select"
          onChange={(event) => setSort(event.target.value as TaskSort)}
          value={sort}
        >
          <option value="due">Due date</option>
          <option value="priority">Priority</option>
          <option value="newest">Newest first</option>
        </select>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2 className="panel-title">
            {heading} · {filtered.length}
          </h2>
          {completedCount > 0 && (
            <button
              className="text-button"
              onClick={clearCompleted}
              type="button"
            >
              Clear completed ({completedCount})
            </button>
          )}
        </div>
        <div className="panel-body">
          {filtered.length ? (
            <div className="task-list">{filtered.map(renderTask)}</div>
          ) : (
            <EmptyState
              copy={
                filter === "done"
                  ? "Finished tasks will be collected here. Take a moment to feel proud."
                  : filter === "active"
                    ? "Nothing to do right now — enjoy the calm."
                    : "Add a homework assignment or a small study goal to get started."
              }
              icon={<LuCircleCheck aria-hidden="true" size={22} />}
              title={
                filter === "done"
                  ? "A space for your wins"
                  : filter === "active"
                    ? "All clear"
                    : "Nothing on your list"
              }
            />
          )}
        </div>
      </section>

      {deleteId && (
        <ConfirmDialog
          copy="This task will be permanently removed from your list."
          onCancel={() => setDeleteId(null)}
          onConfirm={() => {
            setTasks((current) =>
              current.filter((item) => item.id !== deleteId),
            );
            setDeleteId(null);
            notify("Task removed.");
          }}
          title="Delete this task?"
        />
      )}
    </>
  );
}
export function NotesView() {
  const { notes, notify, setNotes } = useStudybook();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState<NoteColor>("default");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "az">("newest");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setTitle("");
    setContent("");
    setColor("default");
  }

  function startEditing(note: StudyNote) {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setColor(note.color ?? "default");
    setFormOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note: StudyNote = {
      id: editingId ?? createId(),
      title: title.trim(),
      content: content.trim(),
      updatedAt: new Date().toISOString(),
      color,
    };
    setNotes((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? note : item))
        : [note, ...current],
    );
    notify(editingId ? "Note saved." : "Note added.");
    closeForm();
  }

  const filtered = useMemo(() => {
    let list = [...notes];
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (note) =>
          note.title.toLowerCase().includes(q) ||
          note.content.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      if (sort === "az") return a.title.localeCompare(b.title);
      if (sort === "oldest") return a.updatedAt.localeCompare(b.updatedAt);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return list;
  }, [notes, query, sort]);
  return (
    <>
      <PageHeading
        action={
          <button
            className="primary-button"
            onClick={() => {
              setEditingId(null);
              setTitle("");
              setContent("");
              setColor("default");
              setFormOpen((open) => !open);
            }}
            type="button"
          >
            <LuPlus size={16} /> New note
          </button>
        }
        eyebrow="Keep the good ideas"
        subtitle="Save class notes, reminders, and the questions you want to come back to."
        title="My notes"
      />
      {formOpen && (
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <h2 className="panel-title" style={{ marginBottom: 16 }}>
            {editingId ? "Edit note" : "New note"}
          </h2>
          <div className="field">
            <label htmlFor="note-title">Title</label>
            <input
              autoFocus
              className="input"
              id="note-title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What is this note about?"
              required
              value={title}
            />
          </div>
          <div className="field" style={{ marginTop: 13 }}>
            <label htmlFor="note-content">Your notes</label>
            <textarea
              className="textarea"
              id="note-content"
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write something you want to remember..."
              value={content}
            />
            <p className="char-count">{content.length} characters</p>
          </div>
          <div className="field" style={{ marginTop: 13 }}>
            <label>Color</label>
            <div className="color-swatches">
              {NOTE_COLORS.map((option) => (
                <button
                  aria-label={`${option} note color`}
                  aria-pressed={color === option}
                  className={`color-swatch${color === option ? " active" : ""}`}
                  key={option}
                  onClick={() => setColor(option)}
                  style={{ background: NOTE_SWATCH[option] }}
                  type="button"
                />
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button
              className="secondary-button"
              onClick={closeForm}
              type="button"
            >
              Cancel
            </button>
            <button className="primary-button" type="submit">
              {editingId ? "Save note" : "Add note"}
            </button>
          </div>
        </form>
      )}

      <div className="toolbar">
        <div className="search-box">
          <LuSearch size={16} />
          <input
            aria-label="Search notes"
            className="search-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes..."
            value={query}
          />
        </div>
        <select
          aria-label="Sort notes"
          className="sort-select"
          onChange={(event) =>
            setSort(event.target.value as "newest" | "oldest" | "az")
          }
          value={sort}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="az">Title A–Z</option>
        </select>
      </div>
      {filtered.length ? (
        <div className="note-grid">
          {filtered.map((note) => (
            <article
              className="note-card"
              data-color={note.color ?? "default"}
              key={note.id}
            >
              <h2 className="note-title">{note.title}</h2>
              <p className="note-content">
                {note.content || "No note text yet."}
              </p>
              <div className="note-footer">
                <span>
                  {new Intl.DateTimeFormat(undefined, {
                    month: "short",
                    day: "numeric",
                  }).format(new Date(note.updatedAt))}
                </span>
                <div className="inline-actions">
                  <button
                    aria-label={`Edit ${note.title}`}
                    className="small-icon-button"
                    onClick={() => startEditing(note)}
                    type="button"
                  >
                    <LuPencil size={13} />
                  </button>
                  <button
                    aria-label={`Delete ${note.title}`}
                    className="small-icon-button danger"
                    onClick={() => setDeleteId(note.id)}
                    type="button"
                  >
                    <LuTrash2 size={13} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel">
          <EmptyState
            copy={
              notes.length
                ? "No notes match your search."
                : "Save a class summary, a study idea, or anything you want to remember."
            }
            icon={<LuFileText aria-hidden="true" size={23} />}
            title={
              notes.length ? "No matching notes" : "Your notes will live here"
            }
          />
        </section>
      )}

      {deleteId && (
        <ConfirmDialog
          copy="This note will be permanently removed."
          onCancel={() => setDeleteId(null)}
          onConfirm={() => {
            setNotes((current) =>
              current.filter((item) => item.id !== deleteId),
            );
            setDeleteId(null);
            notify("Note deleted.");
          }}
          title="Delete this note?"
        />
      )}
    </>
  );
}
export function AccountView() {
  const { notify, profile, setProfile, syncStatus } = useStudybook();
  const { user, ready: accountReady } = useSupabaseUser();
  const [draft, setDraft] = useState<typeof profile | null>(null);
  const [photoError, setPhotoError] = useState("");
  const currentProfile = draft ?? profile;

  const [currentUsername, setCurrentUsername] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameStatus, setUsernameStatus] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;

    let active = true;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single()
      .then(({ data }: { data: { username: string | null } | null }) => {
        if (!active) return;
        const saved = typeof data?.username === "string" ? data.username : "";
        setCurrentUsername(saved);
        setUsername(saved);
      });

    return () => {
      active = false;
    };
  }, [user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = currentProfile.name.trim() || "Student";

    setProfile({
      name: nextName,
      email: currentProfile.email.trim(),
      avatar: currentProfile.avatar,
    });
    setDraft(null);
    setProfileError("");
    notify("Your profile has been saved.");

    if (!user) return;

    setSavingProfile(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: nextName })
        .eq("id", user.id);
      if (error) throw error;

      const { error: metaError } = await supabase.auth.updateUser({
        data: { display_name: nextName },
      });
      if (metaError) throw metaError;
    } catch (cause) {
      setProfileError(
        cause instanceof Error
          ? `Saved on this device, but could not sync your name: ${cause.message}`
          : "Saved on this device, but could not sync your name.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  function updateDraft(changes: Partial<typeof profile>) {
    setDraft((current) => ({ ...(current ?? profile), ...changes }));
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose an image file for your profile picture.");
      event.target.value = "";
      return;
    }
    if (file.size > 1024 * 1024) {
      setPhotoError("Choose an image smaller than 1 MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setPhotoError("The image could not be read. Try choosing it again.");
    };
    reader.onload = () => {
      const avatar = reader.result;
      if (typeof avatar === "string") {
        updateDraft({ avatar });
        setPhotoError("");
      } else {
        setPhotoError("The image could not be read. Try choosing it again.");
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleUsernameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    setUsernameError("");
    setUsernameStatus("");
    const value = username.trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(value)) {
      setUsernameError(
        "Usernames are 3–30 characters: lowercase letters, numbers, _ or -.",
      );
      return;
    }
    if (value === currentUsername) {
      setUsernameStatus("That is already your username.");
      return;
    }

    setSavingUsername(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: available, error: checkError } = await supabase.rpc(
        "is_username_available",
        { candidate: value },
      );
      if (checkError) throw checkError;
      if (!available) throw new Error("That username is already taken.");

      const { error } = await supabase
        .from("profiles")
        .update({ username: value })
        .eq("id", user.id);
      if (error) {
        if (error.code === "23505") {
          throw new Error("That username is already taken.");
        }
        throw error;
      }

      const { error: metaError } = await supabase.auth.updateUser({
        data: { username: value },
      });

      setCurrentUsername(value);
      setUsername(value);
      setUsernameStatus(
        metaError
          ? "Username updated. Reload if it does not show right away."
          : "Username updated.",
      );
      notify("Username updated.");
    } catch (cause) {
      setUsernameError(
        cause instanceof Error
          ? cause.message
          : "Could not update your username.",
      );
    } finally {
      setSavingUsername(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    setPasswordError("");
    setPasswordStatus("");

    if (!currentPassword) {
      setPasswordError("Enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Your new password needs at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    if (!user.email) {
      setPasswordError("This account does not use an email and password.");
      return;
    }

    setSavingPassword(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        throw new Error("Your current password is incorrect.");
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus("Password updated.");
      notify("Password updated.");
    } catch (cause) {
      setPasswordError(
        cause instanceof Error
          ? cause.message
          : "Could not update your password.",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Make it yours"
        subtitle="Your name, picture, username and password."
        title="My account"
      />
      <p className="field-hint" style={{ marginBottom: 14, marginTop: -8 }}>
        <strong>Cloud sync:</strong>{" "}
        {syncStatus === "synced"
          ? "Synced to your account."
          : syncStatus === "syncing"
            ? "Syncing…"
            : syncStatus === "error"
              ? "Local only — run supabase/migrations/sync.sql in Supabase, then reload."
              : "Sign in to sync."}{" "}
        Your schedule, to-dos, notes, exams, routine, and profile picture follow
        your account; theme and music stay on this device.
      </p>
      <div className="profile-layout">
        <section className="panel profile-card">
          <ProfileAvatar
            image={currentProfile.avatar}
            large
            name={currentProfile.name}
          />
          <h2 className="profile-name">{currentProfile.name || "Student"}</h2>
          {currentUsername && (
            <p className="profile-username">@{currentUsername}</p>
          )}
          <p className="profile-email">
            {currentProfile.email || "Your student space"}
          </p>
          <label className="avatar-upload">
            <LuUpload
              aria-hidden="true"
              size={14}
              style={{
                display: "inline",
                marginRight: 5,
                verticalAlign: "-3px",
              }}
            />
            Change profile picture
            <input accept="image/*" onChange={handlePhotoChange} type="file" />
          </label>
          {currentProfile.avatar && (
            <button
              className="text-button"
              onClick={() => updateDraft({ avatar: "" })}
              type="button"
            >
              Remove picture
            </button>
          )}
          {photoError && (
            <p aria-live="polite" className="notice" style={{ marginTop: 12 }}>
              {photoError}
            </p>
          )}
        </section>
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <h2 className="panel-title" style={{ marginBottom: 17 }}>
            Profile details
          </h2>
          <div className="field">
            <label htmlFor="profile-name">Your name</label>
            <input
              autoComplete="name"
              className="input"
              id="profile-name"
              maxLength={60}
              onChange={(event) => updateDraft({ name: event.target.value })}
              placeholder="What should we call you?"
              value={currentProfile.name}
            />
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="profile-email">Email address</label>
            <input
              autoComplete="email"
              className="input"
              id="profile-email"
              onChange={(event) => updateDraft({ email: event.target.value })}
              placeholder="you@example.com"
              type="email"
              value={currentProfile.email}
            />
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="profile-username">Username</label>
            <input
              className="input profile-username-input"
              id="profile-username"
              placeholder="No username yet"
              readOnly
              value={currentUsername ? `@${currentUsername}` : ""}
            />
            <p className="field-hint">
              Your @handle is managed under Sign-in details.
            </p>
          </div>
          <div className="notice" style={{ marginTop: 17 }}>
            Your schedule, tasks, notes, and profile picture are stored in this
            browser. Username and password are managed by your Studybook
            account.
          </div>
          {profileError && (
            <p aria-live="polite" className="notice">
              {profileError}
            </p>
          )}
          <div className="form-actions">
            <button
              className="primary-button"
              disabled={savingProfile}
              type="submit"
            >
              Save profile
            </button>
          </div>
        </form>
      </div>

      <section className="panel form-panel account-security">
        <h2 className="panel-title">Sign-in details</h2>

        {!accountReady ? (
          <p className="notice" style={{ marginTop: 14 }}>
            Checking your account…
          </p>
        ) : !user ? (
          <p className="notice" style={{ marginTop: 14 }}>
            Sign in to change your username or password. Profile pictures and
            the rest of your studybook stay on this device.
          </p>
        ) : (
          <>
            <form className="account-form" onSubmit={handleUsernameSubmit}>
              <div className="field">
                <label htmlFor="account-username">Username</label>
                <input
                  autoCapitalize="none"
                  autoComplete="username"
                  className="input"
                  id="account-username"
                  maxLength={30}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="e.g. alex_student"
                  spellCheck={false}
                  value={username}
                />
                <p className="field-hint">
                  Friends can send requests to @{username.trim() || "username"}.
                  Your username is your @handle — changing it does not change
                  the name shown under Profile details. Edit that name
                  separately.
                </p>
              </div>
              {usernameError && (
                <p aria-live="polite" className="notice">
                  {usernameError}
                </p>
              )}
              {usernameStatus && (
                <p aria-live="polite" className="notice success-notice">
                  {usernameStatus}
                </p>
              )}
              <div className="form-actions">
                <button
                  className="primary-button"
                  disabled={savingUsername}
                  type="submit"
                >
                  Save username
                </button>
              </div>
            </form>

            <hr className="form-divider" />

            <form className="account-form" onSubmit={handlePasswordSubmit}>
              <h3 className="account-subtitle">Change password</h3>
              <div className="field">
                <label htmlFor="current-password">Current password</label>
                <input
                  autoComplete="current-password"
                  className="input"
                  id="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Your current password"
                  required
                  type="password"
                  value={currentPassword}
                />
              </div>
              <div className="form-grid" style={{ marginTop: 14 }}>
                <div className="field">
                  <label htmlFor="new-password">New password</label>
                  <input
                    autoComplete="new-password"
                    className="input"
                    id="new-password"
                    minLength={8}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    required
                    type="password"
                    value={newPassword}
                  />
                </div>
                <div className="field">
                  <label htmlFor="confirm-new-password">
                    Confirm new password
                  </label>
                  <input
                    autoComplete="new-password"
                    className="input"
                    id="confirm-new-password"
                    minLength={8}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Enter it again"
                    required
                    type="password"
                    value={confirmPassword}
                  />
                </div>
              </div>
              {passwordError && (
                <p aria-live="polite" className="notice">
                  {passwordError}
                </p>
              )}
              {passwordStatus && (
                <p aria-live="polite" className="notice success-notice">
                  {passwordStatus}
                </p>
              )}
              <div className="form-actions">
                <button
                  className="primary-button"
                  disabled={savingPassword}
                  type="submit"
                >
                  Update password
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </>
  );
}

export function ProfileView() {
  const { classes, profile, tasks } = useStudybook();
  const { user, ready } = useSupabaseUser();
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (!ready || !user) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      if (active) {
        setUsername(typeof data?.username === "string" ? data.username : "");
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [ready, user]);

  const completed = tasks
    .filter((task) => task.completed)
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return b.dueDate.localeCompare(a.dueDate);
    });

  return (
    <>
      <PageHeading
        action={
          <Link className="secondary-button" href="/account">
            <LuPencil size={15} /> Edit profile
          </Link>
        }
        eyebrow="Your space"
        subtitle="Your details, plus everything you have already finished."
        title="Profile"
      />
      <div className="profile-layout">
        <section className="panel profile-card">
          <ProfileAvatar image={profile.avatar} large name={profile.name} />
          <h2 className="profile-name">{profile.name}</h2>
          {user && username && (
            <p className="profile-username">@{username}</p>
          )}
          <p className="profile-email">
            {profile.email || "Your student space"}
          </p>
          <div className="profile-stats">
            <div>
              <strong>{completed.length}</strong>
              <span>tasks done</span>
            </div>
            <div>
              <strong>{classes.length}</strong>
              <span>weekly classes</span>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2 className="panel-title">Completed tasks</h2>
            <span className="panel-link">{completed.length} finished</span>
          </div>
          <div className="panel-body">
            {completed.length ? (
              <div className="task-list">
                {completed.map((task) => (
                  <div className="task-row" key={task.id}>
                    <span className="task-done-icon">
                      <LuCircleCheck aria-hidden="true" size={16} />
                    </span>
                    <div className="task-main">
                      <div className="task-title completed">{task.title}</div>
                      <div className="task-meta">
                        <span>{task.course || "Personal"}</span>
                        <span>{formatDate(task.dueDate)}</span>
                      </div>
                    </div>
                    <span className={`priority-badge ${task.priority}`}>
                      {task.priority}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                copy="Tick something off your to-do list and it will be collected here."
                icon={<LuCircleCheck aria-hidden="true" size={22} />}
                title="No finished tasks yet"
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

const FONT_META: Record<
  FontFamily,
  { label: string; description: string; stack: string }
> = {
  geist: {
    label: "Geist",
    description: "The default Studybook typeface",
    stack: "var(--font-geist-sans), Arial, sans-serif",
  },
  system: {
    label: "System",
    description: "Matches your device",
    stack: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  serif: {
    label: "Serif",
    description: "Classic and bookish",
    stack: 'Georgia, "Times New Roman", serif',
  },
  mono: {
    label: "Mono",
    description: "Fixed-width and code-friendly",
    stack: "ui-monospace, Consolas, monospace",
  },
};

export function SettingsView() {
  const {
    font,
    holidayEffects,
    setFont,
    setHolidayEffects,
    setTheme,
    theme,
  } = useStudybook();
  const { upcoming } = useMusic();

  return (
    <>
      <PageHeading
        eyebrow="Make yourself comfortable"
        subtitle="Choose a theme and a font family. Changes apply across Studybook and are saved on this device."
        title="Settings"
      />

      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2 className="panel-title">Theme</h2>
          </div>
          <div className="panel-body">
            <div className="theme-choices">
              <button
                aria-pressed={theme === "light"}
                className={`theme-choice${theme === "light" ? " selected" : ""}`}
                onClick={() => setTheme("light")}
                type="button"
              >
                <span aria-hidden="true" className="theme-swatch light" />
                <span className="theme-choice-copy">
                  <strong>
                    <LuSun aria-hidden="true" size={14} /> Light
                  </strong>
                  <span>Bright background, dark text</span>
                </span>
              </button>
              <button
                aria-pressed={theme === "dark"}
                className={`theme-choice${theme === "dark" ? " selected" : ""}`}
                onClick={() => setTheme("dark")}
                type="button"
              >
                <span aria-hidden="true" className="theme-swatch dark" />
                <span className="theme-choice-copy">
                  <strong>
                    <LuMoon aria-hidden="true" size={14} /> Dark
                  </strong>
                  <span>Dim background, light text</span>
                </span>
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2 className="panel-title">Font family</h2>
          </div>
          <div className="panel-body">
            <div className="font-choices">
              {FONT_OPTIONS.map((option) => {
                const meta = FONT_META[option];
                return (
                  <button
                    aria-pressed={font === option}
                    className={`font-choice${font === option ? " selected" : ""}`}
                    key={option}
                    onClick={() => setFont(option)}
                    style={{ fontFamily: meta.stack }}
                    type="button"
                  >
                    <span className="font-sample">Aa</span>
                    <span className="font-choice-copy">
                      <strong>{meta.label}</strong>
                      <span>{meta.description}</span>
                    </span>
                    <span className="font-preview">
                      The quick brown fox jumps over the lazy dog.
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="panel settings-wide">
          <div className="panel-heading">
            <h2 className="panel-title">Holiday effects</h2>
          </div>
          <div className="panel-body">
            <label className="setting-toggle">
              <input
                checked={holidayEffects}
                onChange={(event) =>
                  setHolidayEffects(event.target.checked)
                }
                type="checkbox"
              />
              <span aria-hidden="true" className="setting-toggle-track" />
              <span className="setting-toggle-copy">
                <strong>Celebration animations</strong>
                <span>
                  A short, one-time celebration on each special day — snow on
                  Christmas, bats on Halloween, confetti on Naadam. It fades
                  after a few seconds and never repeats that holiday.
                </span>
              </span>
            </label>
            <div className="settings-actions">
              <button
                className="secondary-button"
                disabled={!holidayEffects}
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("studybook-preview-holiday", {
                      detail: upcoming?.holiday.key ?? "christmas",
                    }),
                  );
                }}
                type="button"
              >
                {upcoming
                  ? `Preview ${upcoming.holiday.emoji} ${upcoming.holiday.name}`
                  : "Preview effects"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  file: "Audio file",
  url: "Audio link",
  youtube: "YouTube",
  spotify: "Spotify",
  link: "Link",
  builtin: "Built-in theme",
};

export function MusicView() {
  const {
    addFileTrack,
    addUrlTrack,
    blocked,
    currentTrack,
    error,
    holiday,
    isPlaying,
    playTrack,
    removeTrack,
    setVolume,
    settings,
    toggle,
    upcoming,
  } = useMusic();

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dayChoice, setDayChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedDay =
    dayChoice ??
    holiday?.key ??
    upcoming?.holiday.key ??
    Object.keys(HOLIDAYS)[0];

  const dayLabel = (key: string) =>
    key === "any" ? "Any day" : (HOLIDAYS[key]?.name ?? key);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setNotice("");

    if (!file && !url.trim()) {
      setFormError("Paste a link or choose an audio file first.");
      return;
    }

    setBusy(true);
    try {
      const track = file
        ? await addFileTrack(file, selectedDay, title)
        : await addUrlTrack(url, selectedDay, title);
      setNotice(`Added “${track.title}”.`);
      setTitle("");
      setUrl("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : "Could not add that track.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    if (next && next.size > 30 * 1024 * 1024) {
      setFormError("Audio files must be smaller than 30 MB.");
      event.target.value = "";
      return;
    }
    setFile(next);
    setFormError("");
  }

  return (
    <>
      <PageHeading
        eyebrow="Set the mood"
        subtitle="A quiet soundtrack for celebrations, chosen by you."
        title="Music"
      />

      <section className="panel music-hero">
        <div className="music-hero-main">
          <span aria-hidden="true" className="music-hero-emoji">
            {holiday?.emoji ?? "🎵"}
          </span>
          <div>
            <p className="eyebrow">
              {holiday ? "Today's celebration" : "Background music"}
            </p>
            <h2 className="music-hero-title">
              {holiday ? holiday.name : "No special day today"}
            </h2>
            <p className="page-subtitle">
              {currentTrack
                ? `Now: ${currentTrack.title}`
                : holiday
                  ? "The built-in theme will play once you press Play."
                  : "Add a track for an upcoming celebration, or wait for the next special day."}
            </p>
          </div>
        </div>
        <div className="music-hero-actions">
          <button
            className="primary-button"
            disabled={!currentTrack}
            onClick={toggle}
            type="button"
          >
            {isPlaying ? <LuPause size={15} /> : <LuPlay size={15} />}
            {isPlaying ? "Pause" : "Play"}
          </button>
          <label className="music-volume" title="Music volume">
            <LuVolume2 aria-hidden="true" size={15} />
            <input
              aria-label="Music volume"
              max={1}
              min={0}
              onChange={(event) => setVolume(Number(event.target.value))}
              step={0.05}
              type="range"
              value={settings.volume}
            />
          </label>
        </div>
      </section>

      {upcoming && (
        <p className="page-subtitle music-upcoming">
          {upcoming.days === 0
            ? `${upcoming.holiday.emoji} Today is ${upcoming.holiday.name}.`
            : `${upcoming.holiday.emoji} Next up: ${upcoming.holiday.name} in ${upcoming.days} day${upcoming.days === 1 ? "" : "s"}.`}
        </p>
      )}

      {error && <p className="notice">{error}</p>}
      {blocked && (
        <p className="notice">
          Your browser needs one tap before it can play audio. Press Play.
        </p>
      )}

      <form className="panel form-panel" onSubmit={handleAdd}>
        <h2 className="panel-title">Add a song</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="music-title">Title (optional)</label>
            <input
              className="input"
              id="music-title"
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Spooky strings"
              value={title}
            />
          </div>
          <div className="field">
            <label htmlFor="music-day">Plays on</label>
            <div className="select-wrap">
              <select
                className="select"
                id="music-day"
                onChange={(event) => setDayChoice(event.target.value)}
                value={selectedDay}
              >
                {Object.values(HOLIDAYS).map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.emoji} {item.name}
                  </option>
                ))}
              </select>
              <span aria-hidden="true" className="select-chevron">
                <LuChevronDown size={15} strokeWidth={2.5} />
              </span>
            </div>
          </div>
          <div className="field full-width">
            <label htmlFor="music-url">Link</label>
            <input
              className="input"
              id="music-url"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="YouTube, Spotify, or a direct audio URL"
              value={url}
            />
          </div>
          <div className="field full-width">
            <label htmlFor="music-file">…or upload an audio file</label>
            <input
              accept="audio/*,video/mp4,video/webm"
              className="input music-file-input"
              id="music-file"
              onChange={handleFile}
              ref={fileRef}
              type="file"
            />
          </div>
        </div>
        <p className="field-hint">
          Audio files and direct audio links can play in the background.
          YouTube and Spotify links are saved to your list and open in their own
          apps.
        </p>
        {formError && <p className="notice">{formError}</p>}
        {notice && <p className="notice success-notice">{notice}</p>}
        <div className="form-actions">
          <button className="primary-button" disabled={busy} type="submit">
            <LuPlus size={15} /> Add track
          </button>
        </div>
      </form>

      <section className="panel">
        <div className="panel-heading">
          <h2 className="panel-title">Your music</h2>
          <span className="panel-link">
            {settings.tracks.length} track
            {settings.tracks.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="panel-body">
          {settings.tracks.length ? (
            <div className="music-list">
              {settings.tracks.map((track) => {
                const current = currentTrack?.id === track.id;
                const playable = isPlayableSource(track.source);
                return (
                  <div
                    className={`music-row${current ? " current" : ""}`}
                    key={track.id}
                  >
                    <span aria-hidden="true" className="music-row-icon">
                      {current && isPlaying ? (
                        <LuVolume2 size={15} />
                      ) : (
                        <LuMusic size={15} />
                      )}
                    </span>
                    <div className="music-row-main">
                      <strong>{track.title}</strong>
                      <span>
                        {dayLabel(track.day)} ·{" "}
                        {SOURCE_LABELS[track.source] ?? track.source}
                      </span>
                    </div>
                    {current && <span className="music-tag">Now playing</span>}
                    {playable ? (
                      <button
                        aria-label={`Play ${track.title}`}
                        className="small-icon-button"
                        onClick={() => void playTrack(track)}
                        type="button"
                      >
                        <LuPlay size={13} />
                      </button>
                    ) : (
                      <a
                        aria-label={`Open ${track.title}`}
                        className="small-icon-button"
                        href={track.url}
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        <LuExternalLink size={13} />
                      </a>
                    )}
                    <button
                      aria-label={`Remove ${track.title}`}
                      className="small-icon-button danger"
                      onClick={() => removeTrack(track.id)}
                      type="button"
                    >
                      <LuTrash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              copy="Add a song above and choose which celebration it belongs to."
              icon={<LuMusic aria-hidden="true" size={22} />}
              title="No tracks yet"
            />
          )}
        </div>
      </section>
    </>
  );
}

function formatRoutineDay(isoDate: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${isoDate}T12:00:00`));
}

export function RoutineView() {
  const {
    notify,
    routine,
    routineChecks,
    setRoutine,
    setRoutineChecks,
  } = useStudybook();
  const [today, setToday] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const update = () => setToday(toISODate(new Date()));
    const start = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 60_000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, []);

  const ordered = useMemo(
    () =>
      [...routine].sort((a, b) => {
        if (!a.time && !b.time) return a.createdAt.localeCompare(b.createdAt);
        if (!a.time) return 1;
        if (!b.time) return -1;
        return (
          a.time.localeCompare(b.time) ||
          a.createdAt.localeCompare(b.createdAt)
        );
      }),
    [routine],
  );

  const doneCount = today
    ? ordered.filter((item) => Boolean(routineChecks[`${today}|${item.id}`]))
        .length
    : 0;
  const progress = ordered.length
    ? Math.round((doneCount / ordered.length) * 100)
    : 0;

  const groups = [
    {
      key: "morning",
      label: "Morning",
      icon: <LuSunrise aria-hidden="true" size={14} />,
      items: ordered.filter((item) => item.time && item.time < "12:00"),
    },
    {
      key: "afternoon",
      label: "Afternoon",
      icon: <LuSun aria-hidden="true" size={14} />,
      items: ordered.filter(
        (item) => item.time >= "12:00" && item.time < "17:00",
      ),
    },
    {
      key: "evening",
      label: "Evening",
      icon: <LuMoon aria-hidden="true" size={14} />,
      items: ordered.filter((item) => item.time >= "17:00"),
    },
    {
      key: "anytime",
      label: "Anytime",
      icon: <LuClock aria-hidden="true" size={14} />,
      items: ordered.filter((item) => !item.time),
    },
  ].filter((group) => group.items.length > 0);

  function toggleItem(id: string) {
    if (!today) return;
    const key = `${today}|${id}`;
    setRoutineChecks((current) => {
      const next = { ...current };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  }

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Give the routine step a name.");
      return;
    }

    const item: RoutineItem = {
      id: createId(),
      title: title.trim(),
      time,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    };
    setRoutine((current) => [...current, item]);
    setTitle("");
    setTime("");
    setNote("");
    notify("Added to your daily routine.");
  }

  function handleDelete(id: string) {
    setRoutine((current) => current.filter((item) => item.id !== id));
    setRoutineChecks((current) => {
      const next = { ...current };
      for (const key of Object.keys(next)) {
        if (key.endsWith(`|${id}`)) delete next[key];
      }
      return next;
    });
    notify("Routine step removed.");
  }

  return (
    <>
      <PageHeading
        eyebrow="Own your day"
        subtitle="A repeatable plan for the day. Checks reset every morning; the steps stay saved."
        title="Daily routine"
      />

      <section className="panel routine-hero">
        <div className="routine-hero-main">
          <span aria-hidden="true" className="routine-hero-icon">
            <LuSunrise size={24} />
          </span>
          <div>
            <p className="eyebrow">Today</p>
            <h2 className="routine-hero-title">
              {today ? formatRoutineDay(today) : "Your daily routine"}
            </h2>
            <p className="page-subtitle">
              {doneCount} of {ordered.length} step
              {ordered.length === 1 ? "" : "s"} done
              {today ? " today" : ""}.
            </p>
          </div>
        </div>
        <div className="routine-progress">
          <span className="routine-progress-value">{progress}%</span>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <div className="routine-layout">
        <section className="panel">
          <div className="panel-heading">
            <h2 className="panel-title">Today&apos;s steps</h2>
            <span className="panel-link">
              {ordered.length} step{ordered.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="panel-body">
            {ordered.length ? (
              groups.map((group) => (
                <div className="routine-group" key={group.key}>
                  <div className="routine-group-label">
                    {group.icon}
                    <span>{group.label}</span>
                  </div>
                  <div className="routine-list">
                    {group.items.map((item) => {
                      const done = today
                        ? Boolean(routineChecks[`${today}|${item.id}`])
                        : false;
                      return (
                        <div
                          className={`routine-row${done ? " done" : ""}`}
                          key={item.id}
                        >
                          <button
                            aria-label={`${done ? "Uncheck" : "Check"} ${item.title}`}
                            aria-pressed={done}
                            className="routine-check"
                            disabled={!today}
                            onClick={() => toggleItem(item.id)}
                            type="button"
                          >
                            {done ? (
                              <LuCircleCheck aria-hidden="true" size={20} />
                            ) : (
                              <span className="routine-check-dot" />
                            )}
                          </button>
                          <div className="routine-row-main">
                            <div className="routine-row-title">{item.title}</div>
                            {item.note && (
                              <p className="routine-row-note">{item.note}</p>
                            )}
                          </div>
                          {item.time && (
                            <span className="routine-time">{item.time}</span>
                          )}
                          <button
                            aria-label={`Delete ${item.title}`}
                            className="small-icon-button danger"
                            onClick={() => handleDelete(item.id)}
                            type="button"
                          >
                            <LuTrash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                copy="Add reading, workouts, revision, or anything else you want to repeat."
                icon={<LuSunrise aria-hidden="true" size={22} />}
                title="No routine yet"
              />
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2 className="panel-title">Add a step</h2>
          </div>
          <div className="panel-body">
            <form className="routine-form" onSubmit={handleAdd}>
              <div className="field">
                <label htmlFor="routine-title">What do you want to do?</label>
                <input
                  className="input"
                  id="routine-title"
                  maxLength={100}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Read 20 pages"
                  value={title}
                />
              </div>
              <div className="field">
                <label htmlFor="routine-time">Time (optional)</label>
                <input
                  className="input"
                  id="routine-time"
                  onChange={(event) => setTime(event.target.value)}
                  type="time"
                  value={time}
                />
              </div>
              <div className="field">
                <label htmlFor="routine-note">Note (optional)</label>
                <textarea
                  className="input textarea"
                  id="routine-note"
                  maxLength={240}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="A small detail or reminder"
                  rows={3}
                  value={note}
                />
              </div>
              {error && <p className="notice">{error}</p>}
              <button className="primary-button" type="submit">
                <LuPlus size={15} /> Add to routine
              </button>
            </form>
            <p className="field-hint">
              Leave the time empty for an anytime step. Everything is saved in
              this browser.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

type LeaderboardRow = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  points: number;
};

export function LeaderboardView() {
  const { user, ready } = useSupabaseUser();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [ownPoints, setOwnPoints] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: boardError } = await supabase.rpc(
        "get_leaderboard",
        { max_rows: 25 },
      );
      if (boardError) throw boardError;

      setRows((data as LeaderboardRow[] | null) ?? []);

      const { data: own } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", user.id)
        .maybeSingle();
      if (own) setOwnPoints((own as { points: number }).points);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load the leaderboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!ready || !user) return;
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, ready, user]);

  const missingSetup =
    /get_leaderboard|award_points|schema cache|profiles\.points/i.test(error);
  const top = rows.slice(0, 3);
  const places = [
    { row: top[1], rank: 2 },
    { row: top[0], rank: 1 },
    { row: top[2], rank: 3 },
  ];
  const isRanked = Boolean(user && rows.some((row) => row.id === user.id));

  const heading = (
    <PageHeading
      action={
        user ? (
          <button
            className="secondary-button"
            disabled={loading}
            onClick={() => void load()}
            type="button"
          >
            <LuRefreshCw size={14} /> {loading ? "Refreshing…" : "Refresh"}
          </button>
        ) : null
      }
      eyebrow="Friends only"
      subtitle="Points for finishing to-dos — only you and your accepted friends appear here. High +30, medium +20, low +10."
      title="Leaderboard"
    />
  );

  if (!ready) {
    return (
      <>
        {heading}
        <p className="page-subtitle">Checking your account…</p>
      </>
    );
  }

  if (!user) {
    return (
      <>
        {heading}
        <section className="panel leaderboard-empty">
          <span aria-hidden="true" className="leaderboard-empty-icon">
            <LuTrophy size={26} />
          </span>
          <h2 className="leaderboard-empty-title">Sign in to see your circle</h2>
          <p className="page-subtitle">
            Points are saved to your Studybook account. Sign in, add friends in
            Messages, and complete a to-do to compare.
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      {heading}

      {error && (
        <p className="notice">
          {missingSetup
            ? "The leaderboard is not set up yet. Run supabase/migrations/leaderboard.sql in the Supabase SQL editor, then refresh."
            : error}
        </p>
      )}

      {loading && !rows.length ? (
        <p className="page-subtitle">Loading the leaderboard…</p>
      ) : error && !rows.length ? null : (
        <>
          <section className="panel leaderboard-board">
            <div className="panel-heading">
              <h2 className="panel-title">
                <LuTrophy aria-hidden="true" size={16} /> You &amp; your friends
              </h2>
              <span className="panel-link">{rows.length} ranked</span>
            </div>
            <div className="panel-body">
              {rows.length ? (
                <>
                  <div className="leaderboard-podium">
                    {places.map(({ rank, row }) => (
                      <div
                        className={`podium-place place-${rank}${row?.id === user.id ? " me" : ""}`}
                        key={rank}
                      >
                        <div className="podium-person">
                          {row ? (
                            <>
                              <ProfileAvatar
                                image={row.avatar_url ?? ""}
                                name={
                                  row.display_name ||
                                  row.username ||
                                  "Student"
                                }
                              />
                              <strong>
                                {row.display_name ||
                                  (row.username
                                    ? `@${row.username}`
                                    : "Student")}
                              </strong>
                              <span className="podium-points">
                                {row.points} pts
                              </span>
                            </>
                          ) : (
                            <span className="podium-waiting">
                              Waiting for a friend
                            </span>
                          )}
                        </div>
                        <div className="podium-block">
                          <span aria-hidden="true">
                            {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {rows.length > 3 && (
                    <div className="leaderboard-list">
                      {rows.slice(3).map((row, index) => (
                        <div
                          className={`leaderboard-row${row.id === user.id ? " me" : ""}`}
                          key={row.id}
                        >
                          <span className="leaderboard-rank">
                            {index + 4}
                          </span>
                          <ProfileAvatar
                            image={row.avatar_url ?? ""}
                            name={
                              row.display_name || row.username || "Student"
                            }
                          />
                          <div className="leaderboard-person">
                            <strong>
                              {row.display_name ||
                                (row.username
                                  ? `@${row.username}`
                                  : "Student")}
                            </strong>
                          </div>
                          <span className="leaderboard-points">
                            {row.points} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="leaderboard-own">
                    <span>
                      {ownPoints !== null
                        ? `You have ${ownPoints} point${ownPoints === 1 ? "" : "s"}.`
                        : "Complete a to-do to earn points."}
                    </span>
                    {!isRanked && ownPoints !== null && ownPoints > 0 && (
                      <span> Keep going to climb the board.</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="leaderboard-empty">
                  <span aria-hidden="true" className="leaderboard-empty-icon">
                    <LuTrophy size={26} />
                  </span>
                  <h2 className="leaderboard-empty-title">
                    No points in your circle yet
                  </h2>
                  <p className="page-subtitle">
                    Complete a to-do to start — add friends in Messages to make
                    it a friendly competition.
                  </p>
                </div>
              )}

              <div className="leaderboard-legend">
                <span><strong>High</strong> +30</span>
                <span><strong>Medium</strong> +20</span>
                <span><strong>Low</strong> +10</span>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
