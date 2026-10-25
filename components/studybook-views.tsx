"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  LuArrowRight,
  LuCalendarPlus,
  LuCheck,
  LuChevronDown,
  LuCircleCheck,
  LuFileText,
  LuPencil,
  LuPlus,
  LuTrash2,
  LuUpload,
} from "react-icons/lu";
import {
  useStudybook,
  type ClassSession,
  type StudyNote,
  type StudyTask,
} from "@/components/studybook-context";
import { ProfileAvatar } from "@/components/studybook-shell";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const shortWeekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
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
        {icon}
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

export default function DashboardView() {
  const { classes, notes, profile, tasks } = useStudybook();
  const [today, setToday] = useState<{ day: number; label: string } | null>(
    null,
  );

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
  const nextTasks = [...pendingTasks]
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, 3);
  return (
    <>
      <section className="welcome-card">
        <div className="welcome-content">
          <p className="welcome-kicker">{today?.label ?? "Your study week"}</p>
          <h1 className="welcome-title">
            Hey, {profile.name.trim().split(/\s+/)[0] || "student"}.
          </h1>
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
          <div className="stat-label">Classes this week</div>
          <div className="stat-value">{classes.length}</div>
          <div className="stat-note">Your weekly rhythm</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">To-dos to finish</div>
          <div className="stat-value">{pendingTasks.length}</div>
          <div className="stat-note">
            {pendingTasks.length === 1 ? "One step at a time" : "Keep it up"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Study notes</div>
          <div className="stat-value">{notes.length}</div>
          <div className="stat-note">Ideas worth keeping</div>
        </div>
      </section>

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
                  <div className="task-row" key={task.id}>
                    <span
                      aria-hidden="true"
                      className="task-check"
                      style={{
                        display: "grid",
                        placeItems: "center",
                        border: "1px solid var(--border)",
                        borderRadius: "50%",
                      }}
                    />
                    <div className="task-main">
                      <div className="task-title">{task.title}</div>
                      <div className="task-meta">
                        {task.course || "Personal"}
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

export function ScheduleView() {
  const { classes, setClasses } = useStudybook();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyClassForm);
  const [formError, setFormError] = useState("");

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
    closeForm();
  }

  const sortedClasses = [...classes].sort(
    (a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime),
  );

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
        subtitle="Your classes for the week, all in one place. Add or update them whenever your timetable changes."
        title="Weekly schedule"
      />

      {formOpen && (
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <h2 className="panel-title" style={{ marginBottom: 16 }}>
            {editingId ? "Update class" : "Add a class"}
          </h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="class-subject">Class name</label>
              <input
                autoFocus
                className="input"
                id="class-subject"
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
                onChange={(event) =>
                  setForm({ ...form, instructor: event.target.value })
                }
                placeholder="Optional"
                value={form.instructor}
              />
            </div>
          </div>
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

      <section aria-label="Classes by weekday" className="panel">
        <div className="week-grid">
          {weekdays.map((day, index) => {
            const dayClasses = sortedClasses.filter(
              (session) => session.day === index,
            );
            return (
              <div className="day-column" key={day}>
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
                          className="small-icon-button"
                          onClick={() =>
                            setClasses((current) =>
                              current.filter((item) => item.id !== session.id),
                            )
                          }
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
              </div>
            );
          })}
        </div>
      </section>
      <p className="page-subtitle" style={{ marginTop: 14 }}>
        {classes.length
          ? `${classes.length} ${classes.length === 1 ? "class" : "classes"} planned this week.`
          : "Your schedule is saved on this device, so you can come back and update it anytime."}
      </p>
    </>
  );
}

const emptyTaskForm = {
  title: "",
  course: "",
  dueDate: "",
  priority: "medium" as StudyTask["priority"],
};

export function ToDoListView() {
  const { setTasks, tasks } = useStudybook();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyTaskForm);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const task: StudyTask = {
      ...form,
      title: form.title.trim(),
      course: form.course.trim(),
      id: createId(),
      completed: false,
    };
    setTasks((current) => [task, ...current]);
    setForm(emptyTaskForm);
    setFormOpen(false);
  }

  const pending = tasks.filter((task) => !task.completed);
  const completed = tasks.filter((task) => task.completed);

  function renderTask(task: StudyTask) {
    return (
      <div className="task-row" key={task.id}>
        <input
          aria-label={`${task.completed ? "Reopen" : "Complete"} ${task.title}`}
          checked={task.completed}
          className="task-check"
          onChange={() =>
            setTasks((current) =>
              current.map((item) =>
                item.id === task.id
                  ? { ...item, completed: !item.completed }
                  : item,
              ),
            )
          }
          type="checkbox"
        />
        <div className="task-main">
          <div className={`task-title${task.completed ? " completed" : ""}`}>
            {task.title}
          </div>
          <div className="task-meta">
            <span>{task.course || "Personal"}</span>
            <span>{formatDate(task.dueDate)}</span>
          </div>
        </div>
        <span className={`priority-badge ${task.priority}`}>
          {task.priority}
        </span>
        <button
          aria-label={`Delete ${task.title}`}
          className="small-icon-button"
          onClick={() =>
            setTasks((current) => current.filter((item) => item.id !== task.id))
          }
          type="button"
        >
          <LuTrash2 size={14} />
        </button>
      </div>
    );
  }

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
            Add a task
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
              onClick={() => {
                setFormOpen(false);
                setForm(emptyTaskForm);
              }}
              type="button"
            >
              Cancel
            </button>
            <button className="primary-button" type="submit">
              Add task
            </button>
          </div>
        </form>
      )}
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2 className="panel-title">To do · {pending.length}</h2>
          </div>
          <div className="panel-body">
            {pending.length ? (
              <div className="task-list">{pending.map(renderTask)}</div>
            ) : (
              <EmptyState
                copy="Add a homework assignment or a small study goal to get started."
                icon={<LuCircleCheck aria-hidden="true" size={22} />}
                title="Nothing on your list"
              />
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2 className="panel-title">Done · {completed.length}</h2>
          </div>
          <div className="panel-body">
            {completed.length ? (
              <div className="task-list">{completed.map(renderTask)}</div>
            ) : (
              <EmptyState
                copy="Finished tasks will be collected here. Take a moment to feel proud."
                icon={<LuCheck aria-hidden="true" size={22} />}
                title="A space for your wins"
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

export function NotesView() {
  const { notes, setNotes } = useStudybook();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setTitle("");
    setContent("");
  }

  function startEditing(note: StudyNote) {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setFormOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note: StudyNote = {
      id: editingId ?? createId(),
      title: title.trim(),
      content: content.trim(),
      updatedAt: new Date().toISOString(),
    };
    setNotes((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? note : item))
        : [note, ...current],
    );
    closeForm();
  }

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
      {notes.length ? (
        <div className="note-grid">
          {notes.map((note) => (
            <article className="note-card" key={note.id}>
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
                    className="small-icon-button"
                    onClick={() =>
                      setNotes((current) =>
                        current.filter((item) => item.id !== note.id),
                      )
                    }
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
            copy="Save a class summary, a study idea, or anything you want to remember."
            icon={<LuFileText aria-hidden="true" size={23} />}
            title="Your notes will live here"
          />
        </section>
      )}
    </>
  );
}

export function AccountView() {
  const { profile, setProfile } = useStudybook();
  const [draft, setDraft] = useState<typeof profile | null>(null);
  const [saved, setSaved] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const currentProfile = draft ?? profile;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfile({
      name: currentProfile.name.trim() || "Student",
      email: currentProfile.email.trim(),
      avatar: currentProfile.avatar,
    });
    setDraft(null);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
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

  return (
    <>
      <PageHeading
        eyebrow="Make it yours"
        subtitle="Update your name and profile picture. Your preferences stay on this device."
        title="My account"
      />
      <div className="profile-layout">
        <section className="panel profile-card">
          <ProfileAvatar
            image={currentProfile.avatar}
            large
            name={currentProfile.name}
          />
          <h2 className="profile-name">{currentProfile.name || "Student"}</h2>
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
          <div className="notice" style={{ marginTop: 17 }}>
            Your schedule, tasks, notes, and profile are currently stored only
            in this browser. Sign-in and secure account syncing need a Supabase
            project and credentials before they can be enabled.
          </div>
          {saved && (
            <p aria-live="polite" className="page-subtitle">
              Your profile has been saved.
            </p>
          )}
          <div className="form-actions">
            <button className="primary-button" type="submit">
              Save profile
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
