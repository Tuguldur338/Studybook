"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { useEffect, useState, type FormEvent } from "react";
import {
  LuArrowLeft,
  LuCalendarDays,
  LuChevronDown,
  LuClock3,
  LuMapPin,
  LuPencil,
  LuPlus,
  LuTrash2,
} from "react-icons/lu";
import { useSupabaseUser } from "@/components/use-supabase-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Teacher = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

type TeacherScheduleEntry = {
  id: string;
  teacher_id: string;
  class_title: string;
  day: number;
  start_time: string;
  end_time: string;
  location: string;
};

type ScheduleForm = {
  classTitle: string;
  day: string;
  startTime: string;
  endTime: string;
  location: string;
};

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function initialScheduleForm(): ScheduleForm {
  return {
    classTitle: "",
    day: "0",
    startTime: "09:00",
    endTime: "10:00",
    location: "",
  };
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "T"
  );
}

function errorText(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function formatTime(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, Number(hours), Number(minutes)));
}

function PageHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}

function SignInNotice() {
  return (
    <section className="panel teacher-notice">
      <h1 className="panel-title">Sign in to view teachers</h1>
      <p className="field-hint">
        The Teachers directory and teacher schedules are available to signed-in
        Studybook users.
      </p>
    </section>
  );
}

export function TeachersView() {
  const { user, ready } = useSupabaseUser();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const nativeApp = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!ready || !user) return;

    let active = true;
    async function loadTeachers() {
      setLoading(true);
      setError("");
      const { data, error: queryError } = await getSupabaseBrowserClient().rpc(
        "list_teachers",
      );
      if (!active) return;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }
      setTeachers((data ?? []) as Teacher[]);
      setLoading(false);
    }

    void loadTeachers().catch((cause: unknown) => {
      if (!active) return;
      setError(errorText(cause, "Could not load the teacher directory."));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [ready, user]);

  if (!ready) return <p className="field-hint">Checking sign-in...</p>;
  if (!user) return <SignInNotice />;

  if (nativeApp && selectedTeacher) {
    return (
      <TeacherSchedule
        onBack={() => setSelectedTeacher(null)}
        teacher={selectedTeacher}
        viewerId={user.id}
      />
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="Studybook community"
        subtitle="Browse teacher profiles and view their weekly class timetables."
        title="Teachers"
      />
      {error && <p className="notice">{error}</p>}
      <section aria-label="Teacher directory" className="panel teacher-directory">
        <div className="panel-heading">
          <h2 className="panel-title">Teacher directory</h2>
          <span className="panel-link">
            {loading ? "Loading..." : `${teachers.length} teachers`}
          </span>
        </div>
        <div className="panel-body">
          {loading ? (
            <p className="field-hint">Loading teachers...</p>
          ) : teachers.length ? (
            <div className="teacher-directory-list">
              {teachers.map((teacher) => {
                const content = (
                  <>
                    <span
                      aria-hidden="true"
                      className={`teacher-directory-avatar${teacher.avatar_url ? " has-image" : ""}`}
                      style={
                        teacher.avatar_url
                          ? {
                              backgroundImage: `url("${teacher.avatar_url}")`,
                            }
                          : undefined
                      }
                    >
                      {!teacher.avatar_url && initials(teacher.display_name)}
                    </span>
                    <span className="teacher-directory-copy">
                      <strong>{teacher.display_name}</strong>
                      <span>@{teacher.username}</span>
                    </span>
                    <LuCalendarDays aria-hidden="true" size={17} />
                  </>
                );

                return nativeApp ? (
                  <button
                    className="teacher-directory-item"
                    key={teacher.id}
                    onClick={() => setSelectedTeacher(teacher)}
                    type="button"
                  >
                    {content}
                  </button>
                ) : (
                  <Link
                    className="teacher-directory-item"
                    href={`/teacher/${encodeURIComponent(teacher.username)}`}
                    key={teacher.id}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="teacher-empty-state">
              <LuCalendarDays aria-hidden="true" size={24} />
              <strong>No teacher profiles yet</strong>
              <span>Teacher accounts will appear here after they register.</span>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export function TeacherProfileRoute() {
  const searchParams = useSearchParams();
  const username = searchParams.get("username") ?? "";
  return <TeacherProfileView username={username} />;
}

function TeacherProfileView({ username }: { username: string }) {
  const { user, ready } = useSupabaseUser();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready || !user || !username) return;

    let active = true;
    async function loadTeacher() {
      setLoading(true);
      setError("");
      const { data, error: queryError } = await getSupabaseBrowserClient().rpc(
        "list_teachers",
      );
      if (!active) return;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }
      const match = ((data ?? []) as Teacher[]).find(
        (candidate) =>
          candidate.username.toLowerCase() === username.toLowerCase(),
      );
      setTeacher(match ?? null);
      setLoading(false);
    }

    void loadTeacher().catch((cause: unknown) => {
      if (!active) return;
      setError(errorText(cause, "Could not load this teacher profile."));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [ready, user, username]);

  if (!ready) return <p className="field-hint">Checking sign-in...</p>;
  if (!user) return <SignInNotice />;
  if (!username) {
    return (
      <section className="panel teacher-notice">
        <h1 className="panel-title">Teacher not found</h1>
        <p className="field-hint">This teacher link is missing a username.</p>
        <Link className="secondary-button" href="/teachers">
          Back to teachers
        </Link>
      </section>
    );
  }
  if (loading) return <p className="field-hint">Loading teacher profile...</p>;
  if (error) return <p className="notice">{error}</p>;
  if (!teacher) {
    return (
      <section className="panel teacher-notice">
        <h1 className="panel-title">Teacher not found</h1>
        <p className="field-hint">
          This username does not belong to a teacher account.
        </p>
        <Link className="secondary-button" href="/teachers">
          Back to teachers
        </Link>
      </section>
    );
  }

  return <TeacherSchedule teacher={teacher} viewerId={user.id} />;
}

function TeacherSchedule({
  teacher,
  viewerId,
  onBack,
}: {
  teacher: Teacher;
  viewerId: string;
  onBack?: () => void;
}) {
  const [entries, setEntries] = useState<TeacherScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleForm>(initialScheduleForm);
  const [selectedDay, setSelectedDay] = useState(0);
  const [hoveredPreviewId, setHoveredPreviewId] = useState<string | null>(null);
  const [clickedPreviewId, setClickedPreviewId] = useState<string | null>(null);
  const [focusedPreviewId, setFocusedPreviewId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadSchedule() {
      setLoading(true);
      setError("");
      const supabase = getSupabaseBrowserClient();
      const [profileResult, scheduleResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("account_type")
          .eq("id", viewerId)
          .single(),
        supabase
          .from("teacher_schedule_entries")
          .select(
            "id, teacher_id, class_title, day, start_time, end_time, location",
          )
          .eq("teacher_id", teacher.id)
          .order("day")
          .order("start_time"),
      ]);
      if (!active) return;
      if (profileResult.error || scheduleResult.error) {
        setError(
          profileResult.error?.message ??
            scheduleResult.error?.message ??
            "Could not load this teacher schedule.",
        );
        setLoading(false);
        return;
      }
      setCanEdit(
        teacher.id === viewerId &&
          profileResult.data.account_type === "teacher",
      );
      setEntries((scheduleResult.data ?? []) as TeacherScheduleEntry[]);
      setLoading(false);
    }

    void loadSchedule().catch((cause: unknown) => {
      if (!active) return;
      setError(errorText(cause, "Could not load this teacher schedule."));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [teacher.id, viewerId]);

  async function refreshEntries() {
    const { data, error: queryError } = await getSupabaseBrowserClient()
      .from("teacher_schedule_entries")
      .select(
        "id, teacher_id, class_title, day, start_time, end_time, location",
      )
      .eq("teacher_id", teacher.id)
      .order("day")
      .order("start_time");
    if (queryError) throw queryError;
    setEntries((data ?? []) as TeacherScheduleEntry[]);
  }

  function startEditing(entry: TeacherScheduleEntry) {
    setEditingId(entry.id);
    setForm({
      classTitle: entry.class_title,
      day: String(entry.day),
      startTime: entry.start_time.slice(0, 5),
      endTime: entry.end_time.slice(0, 5),
      location: entry.location,
    });
    setFormError("");
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(initialScheduleForm());
    setFormError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (form.endTime <= form.startTime) {
      setFormError("The end time must be later than the start time.");
      return;
    }
    setSaving(true);
    const payload = {
      teacher_id: teacher.id,
      class_title: form.classTitle.trim(),
      day: Number(form.day),
      start_time: form.startTime,
      end_time: form.endTime,
      location: form.location.trim(),
    };

    try {
      const supabase = getSupabaseBrowserClient();
      const result = editingId
        ? await supabase
            .from("teacher_schedule_entries")
            .update(payload)
            .eq("id", editingId)
            .eq("teacher_id", viewerId)
        : await supabase.from("teacher_schedule_entries").insert(payload);
      if (result.error) throw result.error;
      await refreshEntries();
      cancelEditing();
    } catch (cause) {
      setFormError(errorText(cause, "Could not save this class."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entryId: string) {
    setError("");
    const { error: deleteError } = await getSupabaseBrowserClient()
      .from("teacher_schedule_entries")
      .delete()
      .eq("id", entryId)
      .eq("teacher_id", viewerId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    try {
      await refreshEntries();
    } catch (cause) {
      setError(errorText(cause, "Could not refresh the teacher schedule."));
    }
  }

  const selectedDayEntries = entries.filter(
    (entry) => entry.day === selectedDay,
  );

  return (
    <>
      {onBack && (
        <button
          className="text-button teacher-back"
          onClick={onBack}
          type="button"
        >
          <LuArrowLeft aria-hidden="true" size={15} />
          Back to teachers
        </button>
      )}
      <PageHeading
        eyebrow="Teacher weekly schedule"
        subtitle={`@${teacher.username} · Class times are shown in your local time zone.`}
        title={teacher.display_name}
      />
      <section
        aria-label={`${teacher.display_name}'s weekly schedule`}
        className="panel teacher-schedule"
      >
        <div className="panel-heading">
          <h2 className="panel-title">Weekly timetable</h2>
          <span className="panel-link">
            {canEdit ? "Your teacher schedule" : "Teacher schedule"}
          </span>
        </div>
        <div className="panel-body">
          {canEdit && (
            <form className="teacher-schedule-form" onSubmit={handleSubmit}>
              <h3>{editingId ? "Edit class" : "Add a class"}</h3>
              <div className="teacher-form-grid">
                <div className="field">
                  <label htmlFor="teacher-class-title">Class title</label>
                  <input
                    className="input"
                    id="teacher-class-title"
                    maxLength={40}
                    onChange={(event) =>
                      setForm({ ...form, classTitle: event.target.value })
                    }
                    placeholder="e.g. 11A"
                    required
                    value={form.classTitle}
                  />
                </div>
                <div className="field">
                  <label htmlFor="teacher-class-day">Day</label>
                  <select
                    className="select"
                    id="teacher-class-day"
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
                </div>
                <div className="field">
                  <label htmlFor="teacher-class-start">Starts</label>
                  <input
                    className="input"
                    id="teacher-class-start"
                    onChange={(event) =>
                      setForm({ ...form, startTime: event.target.value })
                    }
                    required
                    type="time"
                    value={form.startTime}
                  />
                </div>
                <div className="field">
                  <label htmlFor="teacher-class-end">Ends</label>
                  <input
                    className="input"
                    id="teacher-class-end"
                    onChange={(event) =>
                      setForm({ ...form, endTime: event.target.value })
                    }
                    required
                    type="time"
                    value={form.endTime}
                  />
                </div>
                <div className="field">
                  <label htmlFor="teacher-class-location">Room</label>
                  <input
                    className="input"
                    id="teacher-class-location"
                    maxLength={120}
                    onChange={(event) =>
                      setForm({ ...form, location: event.target.value })
                    }
                    placeholder="Optional"
                    value={form.location}
                  />
                </div>
              </div>
              {formError && (
                <p aria-live="polite" className="notice">
                  {formError}
                </p>
              )}
              <div className="form-actions">
                {editingId && (
                  <button
                    className="secondary-button"
                    onClick={cancelEditing}
                    type="button"
                  >
                    Cancel
                  </button>
                )}
                <button className="primary-button" disabled={saving} type="submit">
                  {editingId ? (
                    <LuPencil aria-hidden="true" size={15} />
                  ) : (
                    <LuPlus aria-hidden="true" size={15} />
                  )}
                  {saving ? "Saving..." : editingId ? "Save class" : "Add class"}
                </button>
              </div>
            </form>
          )}

          {error && <p className="notice">{error}</p>}
          {!loading && (
            <div
              aria-label="Choose a weekday"
              className="teacher-weekday-picker"
              role="group"
            >
              {weekdays.map((day, index) => {
                const classCount = entries.filter(
                  (entry) => entry.day === index,
                ).length;
                const isSelected = selectedDay === index;

                return (
                  <button
                    aria-label={`${day}, ${classCount} ${classCount === 1 ? "class" : "classes"}`}
                    aria-pressed={isSelected}
                    className={`teacher-weekday-button${isSelected ? " is-selected" : ""}`}
                    key={day}
                    onClick={() => setSelectedDay(index)}
                    type="button"
                  >
                    <span className="teacher-weekday-topline">
                      <span className="teacher-weekday-name">{day}</span>
                    </span>
                    <span className="teacher-weekday-count">
                      <strong>{classCount}</strong>
                      <span>{classCount === 1 ? "class" : "classes"}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="teacher-weekday-indicator"
                    />
                  </button>
                );
              })}
            </div>
          )}
          {loading ? (
            <p className="field-hint">Loading schedule...</p>
          ) : entries.length ? (
            selectedDayEntries.length ? (
              <>
                <div className="teacher-selected-day-heading">
                  <div>
                    <p className="eyebrow">Daily classes</p>
                    <h3>{weekdays[selectedDay]}</h3>
                  </div>
                  <span>
                    {selectedDayEntries.length}{" "}
                    {selectedDayEntries.length === 1 ? "class" : "classes"}
                  </span>
                </div>
                <div className="teacher-schedule-list">
                  {selectedDayEntries.map((entry) => {
                    const previewOpen =
                      hoveredPreviewId === entry.id ||
                      clickedPreviewId === entry.id ||
                      focusedPreviewId === entry.id;

                    return (
                      <article
                        className={`teacher-schedule-entry${previewOpen ? " has-preview" : ""}`}
                        key={entry.id}
                      >
                        <div className="teacher-schedule-entry-time">
                          <span>{weekdays[entry.day]}</span>
                          <strong>
                            {formatTime(entry.start_time)} -{" "}
                            {formatTime(entry.end_time)}
                          </strong>
                        </div>
                        <div className="teacher-schedule-entry-main">
                          <div
                            className={`teacher-schedule-subject-preview${previewOpen ? " is-open" : ""}`}
                            onPointerEnter={(event) => {
                              if (event.pointerType === "touch") return;
                              setHoveredPreviewId(entry.id);
                              setClickedPreviewId(null);
                            }}
                            onPointerLeave={(event) => {
                              if (event.pointerType === "touch") return;
                              setHoveredPreviewId((current) =>
                                current === entry.id ? null : current,
                              );
                              setClickedPreviewId((current) =>
                                current === entry.id ? null : current,
                              );
                              setFocusedPreviewId((current) =>
                                current === entry.id ? null : current,
                              );
                            }}
                          >
                            <button
                              aria-controls={`teacher-schedule-details-${entry.id}`}
                              aria-expanded={previewOpen}
                              className="teacher-schedule-subject"
                              onBlur={() => {
                                setFocusedPreviewId((current) =>
                                  current === entry.id ? null : current,
                                );
                                setClickedPreviewId((current) =>
                                  current === entry.id ? null : current,
                                );
                              }}
                              onClick={() =>
                                setClickedPreviewId((current) =>
                                  current === entry.id ? null : entry.id,
                                )
                              }
                              onFocus={(event) => {
                                if (event.currentTarget.matches(":focus-visible")) {
                                  setFocusedPreviewId(entry.id);
                                }
                              }}
                              type="button"
                            >
                              <strong>{entry.class_title}</strong>
                              <LuChevronDown aria-hidden="true" size={14} />
                            </button>
                            <div
                              aria-hidden={!previewOpen}
                              aria-label={`${entry.class_title} class details`}
                              className={`teacher-schedule-details${previewOpen ? " is-open" : ""}`}
                              id={`teacher-schedule-details-${entry.id}`}
                              role="region"
                            >
                              <p className="eyebrow">Class details</p>
                              <strong className="teacher-schedule-details-title">
                                {entry.class_title}
                              </strong>
                              <dl>
                                <div>
                                  <dt>Teacher</dt>
                                  <dd>{teacher.display_name}</dd>
                                </div>
                                <div>
                                  <dt>Day</dt>
                                  <dd>{weekdays[entry.day] ?? "Weekday"}</dd>
                                </div>
                                <div>
                                  <dt>Time</dt>
                                  <dd>
                                    {formatTime(entry.start_time)} -{" "}
                                    {formatTime(entry.end_time)}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Room</dt>
                                  <dd>{entry.location || "Not specified"}</dd>
                                </div>
                              </dl>
                            </div>
                          </div>
                          {entry.location && (
                            <span>
                              <LuMapPin aria-hidden="true" size={13} />
                              {entry.location}
                            </span>
                          )}
                        </div>
                        {canEdit && (
                          <div className="teacher-schedule-entry-actions">
                            <button
                              aria-label={`Edit ${entry.class_title}`}
                              className="icon-button"
                              onClick={() => startEditing(entry)}
                              type="button"
                            >
                              <LuPencil aria-hidden="true" size={15} />
                            </button>
                            <button
                              aria-label={`Delete ${entry.class_title}`}
                              className="icon-button teacher-delete-button"
                              onClick={() => void deleteEntry(entry.id)}
                              type="button"
                            >
                              <LuTrash2 aria-hidden="true" size={15} />
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="teacher-day-empty-state">
                <LuCalendarDays aria-hidden="true" size={22} />
                <strong>No classes on {weekdays[selectedDay]}</strong>
                <span>
                  {canEdit
                    ? "Choose another day or add a class to your timetable."
                    : "Choose another day to see this teacher's classes."}
                </span>
              </div>
            )
          ) : (
            <div className="teacher-empty-state">
              <LuClock3 aria-hidden="true" size={24} />
              <strong>No classes scheduled</strong>
              <span>
                {canEdit
                  ? "Add your weekly classes above."
                  : "This teacher has not added any classes yet."}
              </span>
            </div>
          )}
        </div>
      </section>
      {!canEdit && (
        <p className="field-hint teacher-schedule-note">
          This timetable is shared with signed-in Studybook users.
        </p>
      )}
    </>
  );
}
