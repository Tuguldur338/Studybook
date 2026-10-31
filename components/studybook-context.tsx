"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useSupabaseUser } from "@/components/use-supabase-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type ClassSession = {
  id: string;
  subject: string;
  day: number;
  startTime: string;
  endTime: string;
  location: string;
  instructor: string;
};

export type StudyTask = {
  id: string;
  title: string;
  course: string;
  dueDate: string;
  priority: "low" | "medium" | "high";
  completed: boolean;
  /** ISO timestamp of the last local change, used to merge devices. */
  updatedAt?: string;
};

export type Exam = {
  id: string;
  title: string;
  /** ISO timestamp of the exam start. */
  date: string;
  createdAt: string;
};

export type RoutineItem = {
  id: string;
  title: string;
  /** "HH:MM" local time, or an empty string for "anytime". */
  time: string;
  note: string;
  createdAt: string;
};

/** Keyed by `${YYYY-MM-DD}|${routineItemId}` so checks reset each day. */
export type RoutineChecks = Record<string, boolean>;

/**
 * The part of the studybook that follows the account across devices. Theme,
 * fonts, music, and other device preferences deliberately stay local.
 */
type StudybookSnapshot = {
  classes: ClassSession[];
  classChecks: ClassChecks;
  savedClasses: SavedClass[];
  tasks: StudyTask[];
  notes: StudyNote[];
  exams: Exam[];
  routine: RoutineItem[];
  routineChecks: RoutineChecks;
  profileAvatar: string;
  /** Tombstones for tasks deleted here, so a cloud merge cannot resurrect them. */
  deletedTasks: Record<string, string>;
  /** Tombstones for exams deleted here. */
  deletedExams: Record<string, string>;
};

export const NOTE_COLORS = [
  "default",
  "sage",
  "sky",
  "rose",
  "amber",
  "violet",
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

export type StudyNote = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  color?: NoteColor;
};

export type ClassCheckKind = "classwork" | "homework";

export type ClassCheck = Record<ClassCheckKind, boolean>;

/**
 * Keyed by `${mondayOfWeek}|${classId}`, so a new week starts with empty
 * checks while previous weeks keep their history.
 */
export type ClassChecks = Record<string, ClassCheck>;

/**
 * A class the student has entered before, kept so it can be filled back into
 * the schedule form with one click (even after it was deleted).
 */
export type SavedClass = ClassSession & { savedAt: string };

export const FONT_OPTIONS = [
  "geist",
  "system",
  "serif",
  "mono",
  "great-vibes",
  "playfair",
  "caveat",
  "cinzel",
] as const;

export type FontFamily = (typeof FONT_OPTIONS)[number];

export type StudentProfile = {
  name: string;
  email: string;
  avatar: string;
};

export type ToastType = "success" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type StudybookContextValue = {
  classes: ClassSession[];
  setClasses: Dispatch<SetStateAction<ClassSession[]>>;
  classChecks: ClassChecks;
  setClassChecks: Dispatch<SetStateAction<ClassChecks>>;
  savedClasses: SavedClass[];
  setSavedClasses: Dispatch<SetStateAction<SavedClass[]>>;
  tasks: StudyTask[];
  setTasks: Dispatch<SetStateAction<StudyTask[]>>;
  deleteTasks: (ids: string[]) => void;
  exams: Exam[];
  setExams: Dispatch<SetStateAction<Exam[]>>;
  deleteExam: (id: string) => void;
  routine: RoutineItem[];
  setRoutine: Dispatch<SetStateAction<RoutineItem[]>>;
  routineChecks: RoutineChecks;
  setRoutineChecks: Dispatch<SetStateAction<RoutineChecks>>;
  notes: StudyNote[];
  setNotes: Dispatch<SetStateAction<StudyNote[]>>;
  profile: StudentProfile;
  setProfile: Dispatch<SetStateAction<StudentProfile>>;
  theme: "light" | "dark";
  setTheme: Dispatch<SetStateAction<"light" | "dark">>;
  font: FontFamily;
  setFont: Dispatch<SetStateAction<FontFamily>>;
  holidayEffects: boolean;
  setHolidayEffects: Dispatch<SetStateAction<boolean>>;
  syncStatus: "local" | "syncing" | "synced" | "error";
  isLoaded: boolean;
  storageError: string;
  toasts: Toast[];
  notify: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
};

const STORAGE_KEY = "studybook-data-v1";

function userStorageKey(userId: string) {
  return `${STORAGE_KEY}:${userId}`;
}

const defaultProfile: StudentProfile = {
  name: "Student",
  email: "",
  avatar: "",
};

const StudybookContext = createContext<StudybookContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isClassSession(value: unknown): value is ClassSession {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.subject === "string" &&
    typeof value.day === "number" &&
    Number.isInteger(value.day) &&
    value.day >= 0 &&
    value.day < 5 &&
    typeof value.startTime === "string" &&
    typeof value.endTime === "string" &&
    typeof value.location === "string" &&
    typeof value.instructor === "string"
  );
}

function isStudyTask(value: unknown): value is StudyTask {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.course === "string" &&
    typeof value.dueDate === "string" &&
    (value.priority === "low" ||
      value.priority === "medium" ||
      value.priority === "high") &&
    typeof value.completed === "boolean" &&
    (value.updatedAt === undefined || typeof value.updatedAt === "string")
  );
}

function isExam(value: unknown): value is Exam {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.date === "string" &&
    typeof value.createdAt === "string" &&
    !Number.isNaN(new Date(value.date).getTime())
  );
}

function isRoutineItem(value: unknown): value is RoutineItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.time === "string" &&
    typeof value.note === "string" &&
    typeof value.createdAt === "string"
  );
}

function isRoutineChecks(value: unknown): value is RoutineChecks {
  return (
    isRecord(value) &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "boolean")
  );
}

function isDeletedTasks(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

function snapshotHasContent(data: unknown): boolean {
  if (!isRecord(data)) return false;

  for (const key of [
    "classes",
    "savedClasses",
    "tasks",
    "notes",
    "exams",
    "routine",
  ]) {
    const value = data[key];
    if (Array.isArray(value) && value.length > 0) return true;
  }

  if (
    isClassChecks(data.classChecks) &&
    Object.keys(data.classChecks).length > 0
  ) {
    return true;
  }
  if (
    isRoutineChecks(data.routineChecks) &&
    Object.keys(data.routineChecks).length > 0
  ) {
    return true;
  }

  return typeof data.profileAvatar === "string" && data.profileAvatar.length > 0;
}

function savedClassKey(item: SavedClass) {
  return `${item.subject}|${item.day}|${item.startTime}|${item.endTime}|${item.location}|${item.instructor}`;
}

function mergeById<T extends { id: string }>(cloud: T[], local: T[]): T[] {
  const items = new Map<string, T>();
  for (const item of cloud) items.set(item.id, item);
  // Local entries win on the same id; new cloud entries are still kept.
  for (const item of local) items.set(item.id, item);
  return [...items.values()];
}

function taskTimestamp(task: StudyTask) {
  if (!task.updatedAt) return 0;
  const time = Date.parse(task.updatedAt);
  return Number.isNaN(time) ? 0 : time;
}

function mergeTasks(cloud: StudyTask[], local: StudyTask[]): StudyTask[] {
  const items = new Map<string, StudyTask>();
  for (const task of cloud) items.set(task.id, task);
  for (const task of local) {
    const existing = items.get(task.id);
    if (!existing) {
      items.set(task.id, task);
      continue;
    }

    const localTime = taskTimestamp(task);
    const existingTime = taskTimestamp(existing);
    if (localTime > existingTime) {
      items.set(task.id, task);
    } else if (localTime === existingTime && localTime === 0) {
      // Older snapshots have no timestamps. Prefer a completed task so an
      // older device's unchecked copy does not undo it.
      if (task.completed && !existing.completed) items.set(task.id, task);
    } else if (localTime === existingTime) {
      // Same timestamp: local still wins for normal edits.
      items.set(task.id, task);
    }
  }
  return [...items.values()];
}

function mergeDeletedTasks(
  cloud: unknown,
  local: Record<string, string>,
): Record<string, string> {
  const merged: Record<string, string> = isDeletedTasks(cloud)
    ? { ...cloud }
    : {};

  for (const [id, deletedAt] of Object.entries(local)) {
    if (!merged[id] || deletedAt > merged[id]) merged[id] = deletedAt;
  }

  return merged;
}

function mergeSnapshots(
  cloud: unknown,
  local: StudybookSnapshot,
): StudybookSnapshot {
  const source = isRecord(cloud) ? cloud : {};

  const cloudClasses = Array.isArray(source.classes)
    ? source.classes.filter(isClassSession)
    : [];
  const cloudSavedClasses = Array.isArray(source.savedClasses)
    ? source.savedClasses.filter(isSavedClass)
    : [];
  const cloudTasks = Array.isArray(source.tasks)
    ? source.tasks.filter(isStudyTask)
    : [];
  const cloudNotes = Array.isArray(source.notes)
    ? source.notes.filter(isStudyNote)
    : [];
  const cloudExams = Array.isArray(source.exams)
    ? source.exams.filter(isExam)
    : [];
  const cloudRoutine = Array.isArray(source.routine)
    ? source.routine.filter(isRoutineItem)
    : [];
  const deletedTasks = mergeDeletedTasks(source.deletedTasks, local.deletedTasks);
  const deletedExams = mergeDeletedTasks(source.deletedExams, local.deletedExams);

  const notes = new Map<string, StudyNote>();
  for (const note of cloudNotes) notes.set(note.id, note);
  for (const note of local.notes) {
    const existing = notes.get(note.id);
    if (!existing || note.updatedAt >= existing.updatedAt) {
      notes.set(note.id, note);
    }
  }

  const saved = new Map<string, SavedClass>();
  for (const item of cloudSavedClasses) saved.set(savedClassKey(item), item);
  for (const item of local.savedClasses) saved.set(savedClassKey(item), item);

  return {
    classes: mergeById(cloudClasses, local.classes),
    classChecks: {
      ...(isClassChecks(source.classChecks) ? source.classChecks : {}),
      ...local.classChecks,
    },
    savedClasses: [...saved.values()],
    tasks: mergeTasks(cloudTasks, local.tasks).filter(
      (task) => !deletedTasks[task.id],
    ),
    notes: [...notes.values()],
    exams: mergeById(cloudExams, local.exams).filter(
      (exam) => !deletedExams[exam.id],
    ),
    routine: mergeById(cloudRoutine, local.routine),
    routineChecks: {
      ...(isRoutineChecks(source.routineChecks) ? source.routineChecks : {}),
      ...local.routineChecks,
    },
    profileAvatar:
      local.profileAvatar ||
      (typeof source.profileAvatar === "string" ? source.profileAvatar : ""),
    deletedTasks,
    deletedExams,
  };
}

function isStudyNote(value: unknown): value is StudyNote {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.content === "string" &&
    typeof value.updatedAt === "string" &&
    (value.color === undefined || typeof value.color === "string")
  );
}

function isClassChecks(value: unknown): value is ClassChecks {
  return (
    isRecord(value) &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.classwork === "boolean" &&
        typeof entry.homework === "boolean",
    )
  );
}

function isSavedClass(value: unknown): value is SavedClass {
  return (
    isRecord(value) &&
    typeof value.savedAt === "string" &&
    isClassSession(value)
  );
}

function readStudybookData(key = STORAGE_KEY) {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error("Saved studybook data has an invalid format.");
  }

  const profile = isRecord(parsed.profile) ? parsed.profile : {};
  const theme: "light" | "dark" = parsed.theme === "dark" ? "dark" : "light";
  const font: FontFamily = FONT_OPTIONS.includes(parsed.font as FontFamily)
    ? (parsed.font as FontFamily)
    : "geist";
  const holidayEffects = parsed.holidayEffects !== false;

  return {
    classes: Array.isArray(parsed.classes)
      ? parsed.classes.filter(isClassSession)
      : [],
    classChecks: isClassChecks(parsed.classChecks) ? parsed.classChecks : {},
    savedClasses: Array.isArray(parsed.savedClasses)
      ? parsed.savedClasses.filter(isSavedClass)
      : [],
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks.filter(isStudyTask) : [],
    deletedTasks: isDeletedTasks(parsed.deletedTasks)
      ? parsed.deletedTasks
      : {},
    exams: Array.isArray(parsed.exams) ? parsed.exams.filter(isExam) : [],
    deletedExams: isDeletedTasks(parsed.deletedExams)
      ? parsed.deletedExams
      : {},
    routine: Array.isArray(parsed.routine)
      ? parsed.routine.filter(isRoutineItem)
      : [],
    routineChecks: isRoutineChecks(parsed.routineChecks)
      ? parsed.routineChecks
      : {},
    notes: Array.isArray(parsed.notes) ? parsed.notes.filter(isStudyNote) : [],
    profile: {
      name: typeof profile.name === "string" ? profile.name : "Student",
      email: typeof profile.email === "string" ? profile.email : "",
      avatar: typeof profile.avatar === "string" ? profile.avatar : "",
    },
    theme,
    font,
    holidayEffects,
  };
}
export function StudybookProvider({ children }: { children: ReactNode }) {
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [classChecks, setClassChecks] = useState<ClassChecks>({});
  const [savedClasses, setSavedClasses] = useState<SavedClass[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [deletedTasks, setDeletedTasks] = useState<Record<string, string>>({});
  const [deletedExams, setDeletedExams] = useState<Record<string, string>>({});
  const [exams, setExams] = useState<Exam[]>([]);
  const [routine, setRoutine] = useState<RoutineItem[]>([]);
  const [routineChecks, setRoutineChecks] = useState<RoutineChecks>({});
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [profile, setProfile] = useState(defaultProfile);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [font, setFont] = useState<FontFamily>("geist");
  const [holidayEffects, setHolidayEffects] = useState(true);
  const [syncStatus, setSyncStatus] = useState<
    "local" | "syncing" | "synced" | "error"
  >("local");
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());
  const { user: authUser, ready: authReady } = useSupabaseUser();
  const authUserId = authUser?.id ?? null;
  const authUserEmail = authUser?.email ?? "";
  const storageKey = authUserId ? userStorageKey(authUserId) : STORAGE_KEY;
  const [loadedKey, setLoadedKey] = useState("");
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null);
  const snapshotRef = useRef<StudybookSnapshot>({
    classes: [],
    classChecks: {},
    savedClasses: [],
    tasks: [],
    notes: [],
    exams: [],
    routine: [],
    routineChecks: {},
    profileAvatar: "",
    deletedTasks: {},
    deletedExams: {},
  });

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback((message: string, type: ToastType = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current.slice(-3), { id, message, type }]);
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      timers.current.delete(id);
    }, 4500);
    timers.current.set(id, timer);
  }, []);

  const applyCloudSnapshot = useCallback((raw: unknown) => {
    if (!isRecord(raw)) return;

    setClasses(
      Array.isArray(raw.classes) ? raw.classes.filter(isClassSession) : [],
    );
    setClassChecks(isClassChecks(raw.classChecks) ? raw.classChecks : {});
    setSavedClasses(
      Array.isArray(raw.savedClasses)
        ? raw.savedClasses.filter(isSavedClass)
        : [],
    );
    setTasks(Array.isArray(raw.tasks) ? raw.tasks.filter(isStudyTask) : []);
    setDeletedTasks(isDeletedTasks(raw.deletedTasks) ? raw.deletedTasks : {});
    setDeletedExams(isDeletedTasks(raw.deletedExams) ? raw.deletedExams : {});
    setNotes(Array.isArray(raw.notes) ? raw.notes.filter(isStudyNote) : []);
    setExams(Array.isArray(raw.exams) ? raw.exams.filter(isExam) : []);
    setRoutine(
      Array.isArray(raw.routine) ? raw.routine.filter(isRoutineItem) : [],
    );
    setRoutineChecks(
      isRoutineChecks(raw.routineChecks) ? raw.routineChecks : {},
    );

    const avatar = raw.profileAvatar;
    if (typeof avatar === "string" && avatar) {
      setProfile((current) => ({ ...current, avatar }));
    }
  }, []);

  const deleteTasks = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const deletedAt = new Date().toISOString();
    const idSet = new Set(ids);
    setTasks((current) => current.filter((task) => !idSet.has(task.id)));
    setDeletedTasks((current) => {
      const next = { ...current };
      for (const id of ids) next[id] = deletedAt;
      return next;
    });
  }, []);

  const deleteExam = useCallback((id: string) => {
    const deletedAt = new Date().toISOString();
    setExams((current) => current.filter((exam) => exam.id !== id));
    setDeletedExams((current) => ({ ...current, [id]: deletedAt }));
  }, []);

  const resetLocalSnapshot = useCallback(() => {
    setClasses([]);
    setClassChecks({});
    setSavedClasses([]);
    setTasks([]);
    setDeletedTasks({});
    setDeletedExams({});
    setNotes([]);
    setExams([]);
    setRoutine([]);
    setRoutineChecks({});
    setProfile(defaultProfile);
    setTheme(
      window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light",
    );
    setFont("geist");
    setHolidayEffects(true);
  }, []);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => window.clearTimeout(timer));
      map.clear();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;

    const key = authUserId ? userStorageKey(authUserId) : STORAGE_KEY;
    const frame = window.requestAnimationFrame(() => {
      try {
        let saved = readStudybookData(key);

        // The pre-sync app used one shared key. Claim that data for the account
        // it belongs to, so two accounts on one browser never mix.
        if (!saved && authUserId) {
          const guest = readStudybookData(STORAGE_KEY);
          if (guest) {
            const guestEmail = guest.profile.email.trim().toLowerCase();
            const currentEmail = authUserEmail.trim().toLowerCase();
            const belongsToAccount =
              !guestEmail || !currentEmail || guestEmail === currentEmail;

            if (belongsToAccount) {
              saved = guest;
              try {
                const raw = window.localStorage.getItem(STORAGE_KEY);
                if (raw) window.localStorage.setItem(key, raw);
                window.localStorage.removeItem(STORAGE_KEY);
              } catch {
                // Use the data for this visit even if the copy fails.
              }
            }
          }
        }

        if (saved) {
          setClasses(saved.classes);
          setClassChecks(saved.classChecks);
          setSavedClasses(saved.savedClasses);
          setTasks(saved.tasks);
          setDeletedTasks(saved.deletedTasks);
          setDeletedExams(saved.deletedExams);
          setExams(saved.exams);
          setRoutine(saved.routine);
          setRoutineChecks(saved.routineChecks);
          setNotes(saved.notes);
          setProfile(saved.profile);
          setTheme(saved.theme);
          setFont(saved.font);
          setHolidayEffects(saved.holidayEffects);
        } else {
          resetLocalSnapshot();
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown storage error.";
        setStorageError(`Your saved studybook could not be loaded: ${message}`);
      } finally {
        setLoadedKey(key);
        setIsLoaded(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [authReady, authUserEmail, authUserId, resetLocalSnapshot]);

  useEffect(() => {
    if (!isLoaded || loadedKey !== storageKey) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.font = font;

    snapshotRef.current = {
      classes,
      classChecks,
      savedClasses,
      tasks,
      notes,
      exams,
      routine,
      routineChecks,
      profileAvatar: profile.avatar,
      deletedTasks,
      deletedExams,
    };

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          classes,
          classChecks,
          savedClasses,
          tasks,
          deletedTasks,
          deletedExams,
          exams,
          routine,
          routineChecks,
          notes,
          profile,
          theme,
          font,
          holidayEffects,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown storage error.";
      window.setTimeout(() => {
        setStorageError(
          `Your changes could not be saved in this browser: ${message}`,
        );
      }, 0);
    }
  }, [
    classChecks,
    classes,
    deletedExams,
    deletedTasks,
    exams,
    routine,
    routineChecks,
    font,
    holidayEffects,
    isLoaded,
    loadedKey,
    notes,
    profile,
    savedClasses,
    storageKey,
    tasks,
    theme,
  ]);

  useEffect(() => {
    if (authUserId) return;
    const timer = window.setTimeout(() => {
      setSyncedUserId(null);
      setSyncStatus("local");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authUserId]);

  useEffect(() => {
    if (
      !isLoaded ||
      !authReady ||
      !authUserId ||
      loadedKey !== storageKey
    ) {
      return;
    }
    if (syncedUserId === authUserId) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      setSyncStatus("syncing");
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("studybook_snapshots")
          .select("data")
          .eq("user_id", authUserId)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.warn("Studybook cloud sync is unavailable:", error.message);
          setSyncStatus("error");
          setSyncedUserId(authUserId);
          return;
        }

        const cloudData = data?.data as unknown;
        const localData = snapshotRef.current;
        const cloudHasContent = snapshotHasContent(cloudData);
        const localHasContent = snapshotHasContent(localData);

        if (cloudHasContent && localHasContent) {
          // Keep items added on this device (for example a to-do entered before
          // the first sync) while also loading the account's other data.
          applyCloudSnapshot(mergeSnapshots(cloudData, localData));
        } else if (cloudHasContent) {
          applyCloudSnapshot(cloudData);
        } else if (localHasContent) {
          const { error: uploadError } = await supabase
            .from("studybook_snapshots")
            .upsert(
              { user_id: authUserId, data: localData },
              { onConflict: "user_id" },
            );
          if (uploadError) {
            console.warn(
              "Studybook cloud upload failed:",
              uploadError.message,
            );
            if (active) {
              setSyncStatus("error");
              setSyncedUserId(authUserId);
            }
            return;
          }
        }

        if (active) {
          setSyncStatus("synced");
          setSyncedUserId(authUserId);
        }
      } catch (cause) {
        console.warn("Studybook cloud sync failed:", cause);
        if (active) {
          setSyncStatus("error");
          setSyncedUserId(authUserId);
        }
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    applyCloudSnapshot,
    authReady,
    authUserId,
    isLoaded,
    loadedKey,
    storageKey,
    syncedUserId,
  ]);

  useEffect(() => {
    if (
      !isLoaded ||
      !authUserId ||
      loadedKey !== storageKey ||
      syncedUserId !== authUserId
    ) {
      return;
    }

    let active = true;
    let syncing = false;

    async function pullCloudChanges() {
      if (!active || syncing || document.visibilityState === "hidden") return;
      syncing = true;
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase
          .from("studybook_snapshots")
          .select("data")
          .eq("user_id", authUserId)
          .maybeSingle();
        if (!active || !data?.data) return;

        const merged = mergeSnapshots(data.data, snapshotRef.current);
        if (JSON.stringify(merged) !== JSON.stringify(snapshotRef.current)) {
          applyCloudSnapshot(merged);
        }
      } catch (cause) {
        console.warn("Studybook cloud refresh failed:", cause);
      } finally {
        syncing = false;
      }
    }

    const interval = window.setInterval(() => {
      void pullCloudChanges();
    }, 15_000);

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") void pullCloudChanges();
    }
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [
    applyCloudSnapshot,
    authUserId,
    isLoaded,
    loadedKey,
    storageKey,
    syncedUserId,
  ]);

  useEffect(() => {
    if (
      !isLoaded ||
      !authUserId ||
      loadedKey !== storageKey ||
      syncedUserId !== authUserId
    ) {
      return;
    }

    const snapshot: StudybookSnapshot = {
      classes,
      classChecks,
      savedClasses,
      tasks,
      notes,
      exams,
      routine,
      routineChecks,
      profileAvatar: profile.avatar,
      deletedTasks,
      deletedExams,
    };

    const timer = window.setTimeout(async () => {
      setSyncStatus("syncing");
      try {
        const supabase = getSupabaseBrowserClient();
        // Merge the latest cloud copy before writing so a stale device cannot
        // overwrite a newer task completion that arrived from another device.
        const { data: cloudRow } = await supabase
          .from("studybook_snapshots")
          .select("data")
          .eq("user_id", authUserId)
          .maybeSingle();
        const merged = cloudRow?.data
          ? mergeSnapshots(cloudRow.data, snapshot)
          : snapshot;

        const { error } = await supabase
          .from("studybook_snapshots")
          .upsert(
            { user_id: authUserId, data: merged },
            { onConflict: "user_id" },
          );
        if (error) {
          console.warn("Studybook cloud save failed:", error.message);
          setSyncStatus("error");
        } else {
          setSyncStatus("synced");
          if (JSON.stringify(merged) !== JSON.stringify(snapshot)) {
            applyCloudSnapshot(merged);
          }
        }
      } catch (cause) {
        console.warn("Studybook cloud save failed:", cause);
        setSyncStatus("error");
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    applyCloudSnapshot,
    authUserId,
    classChecks,
    classes,
    deletedExams,
    deletedTasks,
    exams,
    isLoaded,
    loadedKey,
    notes,
    profile.avatar,
    routine,
    routineChecks,
    savedClasses,
    storageKey,
    syncedUserId,
    tasks,
  ]);

  return (
    <StudybookContext.Provider
      value={{
        classes,
        setClasses,
        classChecks,
        setClassChecks,
        savedClasses,
        setSavedClasses,
        tasks,
        setTasks,
        deleteTasks,
        exams,
        setExams,
        deleteExam,
        routine,
        setRoutine,
        routineChecks,
        setRoutineChecks,
        notes,
        setNotes,
        profile,
        setProfile,
        theme,
        setTheme,
        font,
        setFont,
        holidayEffects,
        setHolidayEffects,
        syncStatus,
        isLoaded,
        storageError,
        toasts,
        notify,
        dismissToast,
      }}
    >
      {children}
    </StudybookContext.Provider>
  );
}

export function useStudybook() {
  const context = useContext(StudybookContext);
  if (!context) {
    throw new Error("useStudybook must be used inside StudybookProvider.");
  }
  return context;
}
