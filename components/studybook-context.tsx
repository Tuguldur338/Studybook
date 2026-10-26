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

export const FONT_OPTIONS = ["geist", "system", "serif", "mono"] as const;

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
  exams: Exam[];
  setExams: Dispatch<SetStateAction<Exam[]>>;
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
const SYNC_USER_KEY = "studybook-sync-user";

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
    typeof value.completed === "boolean"
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

function readStudybookData() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
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
    exams: Array.isArray(parsed.exams) ? parsed.exams.filter(isExam) : [],
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

  const applyEmptySnapshot = useCallback(() => {
    setClasses([]);
    setClassChecks({});
    setSavedClasses([]);
    setTasks([]);
    setNotes([]);
    setExams([]);
    setRoutine([]);
    setRoutineChecks({});
    setProfile((current) => ({ ...current, avatar: "" }));
  }, []);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => window.clearTimeout(timer));
      map.clear();
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = readStudybookData();
        if (saved) {
          setClasses(saved.classes);
          setClassChecks(saved.classChecks);
          setSavedClasses(saved.savedClasses);
          setTasks(saved.tasks);
          setExams(saved.exams);
          setRoutine(saved.routine);
          setRoutineChecks(saved.routineChecks);
          setNotes(saved.notes);
          setProfile(saved.profile);
          setTheme(saved.theme);
          setFont(saved.font);
          setHolidayEffects(saved.holidayEffects);
        } else {
          const prefersDark = window.matchMedia?.(
            "(prefers-color-scheme: dark)",
          ).matches;
          setTheme(prefersDark ? "dark" : "light");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown storage error.";
        setStorageError(`Your saved studybook could not be loaded: ${message}`);
      } finally {
        setIsLoaded(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
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
    };

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          classes,
          classChecks,
          savedClasses,
          tasks,
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
    exams,
    routine,
    routineChecks,
    font,
    holidayEffects,
    isLoaded,
    notes,
    profile,
    savedClasses,
    tasks,
    theme,
  ]);

  useEffect(() => {
    if (authUser) return;
    const timer = window.setTimeout(() => {
      setSyncedUserId(null);
      setSyncStatus("local");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authUser]);

  useEffect(() => {
    if (!isLoaded || !authReady || !authUser) return;
    if (syncedUserId === authUser.id) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      setSyncStatus("syncing");
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("studybook_snapshots")
          .select("data")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.warn("Studybook cloud sync is unavailable:", error.message);
          setSyncStatus("error");
          setSyncedUserId(authUser.id);
          return;
        }

        const cloudData = data?.data as unknown;
        const localData = snapshotRef.current;
        const previousUserId = window.localStorage.getItem(SYNC_USER_KEY);
        const differentUser = Boolean(
          previousUserId && previousUserId !== authUser.id,
        );

        if (snapshotHasContent(cloudData)) {
          applyCloudSnapshot(cloudData);
        } else if (snapshotHasContent(localData) && !differentUser) {
          const { error: uploadError } = await supabase
            .from("studybook_snapshots")
            .upsert(
              { user_id: authUser.id, data: localData },
              { onConflict: "user_id" },
            );
          if (uploadError) {
            console.warn(
              "Studybook cloud upload failed:",
              uploadError.message,
            );
          }
        } else if (differentUser) {
          applyEmptySnapshot();
        }

        window.localStorage.setItem(SYNC_USER_KEY, authUser.id);
        if (active) {
          setSyncStatus("synced");
          setSyncedUserId(authUser.id);
        }
      } catch (cause) {
        console.warn("Studybook cloud sync failed:", cause);
        if (active) {
          setSyncStatus("error");
          setSyncedUserId(authUser.id);
        }
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    applyCloudSnapshot,
    applyEmptySnapshot,
    authReady,
    authUser,
    isLoaded,
    syncedUserId,
  ]);

  useEffect(() => {
    if (!isLoaded || !authUser || syncedUserId !== authUser.id) return;

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
    };

    const timer = window.setTimeout(async () => {
      setSyncStatus("syncing");
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase
          .from("studybook_snapshots")
          .upsert(
            { user_id: authUser.id, data: snapshot },
            { onConflict: "user_id" },
          );
        if (error) {
          console.warn("Studybook cloud save failed:", error.message);
          setSyncStatus("error");
        } else {
          setSyncStatus("synced");
        }
      } catch (cause) {
        console.warn("Studybook cloud save failed:", cause);
        setSyncStatus("error");
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    authUser,
    classChecks,
    classes,
    exams,
    isLoaded,
    notes,
    profile.avatar,
    routine,
    routineChecks,
    savedClasses,
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
        exams,
        setExams,
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
