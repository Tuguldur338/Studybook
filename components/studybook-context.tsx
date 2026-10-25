"use client";

import {
  createContext,
  useContext,
  useEffect,
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

export type StudyNote = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

export type StudentProfile = {
  name: string;
  email: string;
  avatar: string;
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
    typeof value.updatedAt === "string"
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
