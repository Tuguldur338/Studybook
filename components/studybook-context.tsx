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
  tasks: StudyTask[];
  setTasks: Dispatch<SetStateAction<StudyTask[]>>;
  notes: StudyNote[];
  setNotes: Dispatch<SetStateAction<StudyNote[]>>;
  profile: StudentProfile;
  setProfile: Dispatch<SetStateAction<StudentProfile>>;
  theme: "light" | "dark";
  setTheme: Dispatch<SetStateAction<"light" | "dark">>;
  storageError: string;
  toasts: Toast[];
  notify: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
};

const STORAGE_KEY = "studybook-data-v1";

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

function readStudybookData() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error("Saved studybook data has an invalid format.");
  }

  const profile = isRecord(parsed.profile) ? parsed.profile : {};
  const theme: "light" | "dark" = parsed.theme === "dark" ? "dark" : "light";

  return {
    classes: Array.isArray(parsed.classes)
      ? parsed.classes.filter(isClassSession)
      : [],
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks.filter(isStudyTask) : [],
    notes: Array.isArray(parsed.notes) ? parsed.notes.filter(isStudyNote) : [],
    profile: {
      name: typeof profile.name === "string" ? profile.name : "Student",
      email: typeof profile.email === "string" ? profile.email : "",
      avatar: typeof profile.avatar === "string" ? profile.avatar : "",
    },
    theme,
  };
}
export function StudybookProvider({ children }: { children: ReactNode }) {
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [profile, setProfile] = useState(defaultProfile);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [...current.slice(-3), { id, message, type }]);
      const timer = window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
        timers.current.delete(id);
      }, 4500);
      timers.current.set(id, timer);
    },
    [],
  );

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
          setTasks(saved.tasks);
          setNotes(saved.notes);
          setProfile(saved.profile);
          setTheme(saved.theme);
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
    document.documentElement.dataset.theme = theme;
    if (!isLoaded) return;

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ classes, tasks, notes, profile, theme }),
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
  }, [classes, isLoaded, notes, profile, tasks, theme]);

  return (
    <StudybookContext.Provider
      value={{
        classes,
        setClasses,
        tasks,
        setTasks,
        notes,
        setNotes,
        profile,
        setProfile,
        theme,
        setTheme,
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

