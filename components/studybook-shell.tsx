"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  LuBookOpen,
  LuCalendarDays,
  LuCalendarRange,
  LuChevronRight,
  LuCheck,
  LuCircleAlert,
  LuCircleCheck,
  LuCircleHelp,
  LuEye,
  LuEyeOff,
  LuFolderOpen,
  LuHouse,
  LuInfo,
  LuLogIn,
  LuMenu,
  LuMessageCircle,
  LuMoon,
  LuMusic,
  LuNotebookPen,
  LuSettings,
  LuSun,
  LuSunrise,
  LuTrophy,
  LuUserPlus,
  LuX,
} from "react-icons/lu";
import type {
  AuthChangeEvent,
  Session,
  User,
} from "@supabase/supabase-js";
import {
  StudybookProvider,
  useStudybook,
} from "@/components/studybook-context";
import MessagingPanel from "@/components/messaging-panel";
import HolidayEffects from "@/components/holiday-effects";
import HalloweenChallenge from "@/components/halloween-challenge";
import { MusicProvider } from "@/components/music-context";
import MusicPlayer from "@/components/music-player";
import { useMessaging } from "@/components/use-messaging";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

const navigation = [
  { label: "Overview", href: "/", icon: LuHouse },
  { label: "Weekly schedule", href: "/schedule", icon: LuCalendarDays },
  { label: "Calendar", href: "/calendar", icon: LuCalendarRange },
  { label: "To-do list", href: "/to-do-list", icon: LuCheck },
  { label: "Daily routine", href: "/routine", icon: LuSunrise },
  { label: "My notes", href: "/notes", icon: LuNotebookPen },
  { label: "Music", href: "/music", icon: LuMusic },
  { label: "Leaderboard", href: "/leaderboard", icon: LuTrophy },
  { label: "Settings", href: "/settings", icon: LuSettings },
];

const pageNames: Record<string, string> = {
  "/": "Overview",
  "/schedule": "Weekly schedule",
  "/calendar": "Calendar",
  "/to-do-list": "To-do list",
  "/routine": "Daily routine",
  "/notes": "My notes",
  "/music": "Music",
  "/leaderboard": "Leaderboard",
  "/settings": "Settings",
  "/account": "My account",
  "/profile": "Profile",
};

type MessagesWidget = "closed" | "open" | "minimized";

const MESSAGES_WIDGET_KEY = "studybook-messages-widget-v1";

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "S"
  );
}

function ProfileAvatar({
  name,
  image,
  large = false,
}: {
  name: string;
  image: string;
  large?: boolean;
}) {
  return (
    <span
      className={`avatar${image ? " has-image" : ""}${large ? " profile-avatar" : ""}`}
      style={image ? { backgroundImage: `url("${image}")` } : undefined}
      aria-label={`${name}'s profile picture`}
      role="img"
    >
      {!image && initials(name)}
    </span>
  );
}
type AuthMode = "sign-in" | "register";

function AuthModal({
  initialMode,
  onClose,
}: {
  initialMode: AuthMode;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const supabase = getSupabaseBrowserClient();

      if (mode === "register") {
        const displayName = String(formData.get("displayName") ?? "").trim();
        const username = String(formData.get("username") ?? "")
          .trim()
          .toLowerCase();
        const confirmation = String(formData.get("confirmPassword") ?? "");
        if (password !== confirmation) {
          setMessageType("error");
          setMessage("Your passwords do not match.");
          return;
        }
        if (!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(username)) {
          setMessageType("error");
          setMessage(
            "Usernames are 3–30 characters: lowercase letters, numbers, _ or -.",
          );
          return;
        }

        const { data: available, error: availabilityError } = await supabase.rpc(
          "is_username_available",
          { candidate: username },
        );
        if (availabilityError) throw availabilityError;
        if (!available) {
          setMessageType("error");
          setMessage("That username is already taken. Try another one.");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName, username },
          },
        });

        if (error) {
          if (/username|duplicate|already|database/i.test(error.message)) {
            throw new Error("That username is already taken. Try another one.");
          }
          throw error;
        }

        if (data.session) {
          onClose();
          return;
        }

        form.reset();
        setMessageType("success");
        setMessage(
          "Your account was created. Check your email for a confirmation link before signing in.",
        );
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      onClose();
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isRegistering = mode === "register";
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="auth-title"
        aria-modal="true"
        className="modal"
        role="dialog"
      >
        <div className="modal-heading">
          <div>
            <h2 className="modal-title" id="auth-title">
              {isRegistering ? "Create your account" : "Welcome back"}
            </h2>
            <p className="modal-copy">
              {isRegistering
                ? "Start your personal study space."
                : "Sign in to keep your study life in sync."}
            </p>
          </div>
          <button
            aria-label="Close sign-in window"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <LuX size={17} />
          </button>
        </div>
        <form key={mode} onSubmit={handleSubmit}>
          {isRegistering && (
            <div className="field">
              <label htmlFor="register-name">Your name</label>
              <input
                autoComplete="name"
                className="input"
                id="register-name"
                maxLength={80}
                name="displayName"
                placeholder="e.g. Alex Student"
                required
              />
            </div>
          )}
          {isRegistering && (
            <div className="field" style={{ marginTop: 13 }}>
              <label htmlFor="register-username">Username</label>
              <input
                autoCapitalize="none"
                autoComplete="username"
                className="input"
                id="register-username"
                maxLength={30}
                minLength={3}
                name="username"
                pattern="[a-z0-9][a-z0-9_-]{2,29}"
                placeholder="e.g. alex_student"
                required
                spellCheck={false}
              />
              <p className="field-hint">
                Your friends can add you with this. 3–30 characters: lowercase
                letters, numbers, _ or -.
              </p>
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Email address</label>
            <input
              autoComplete="email"
              className="input"
              id="auth-email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </div>
          <div className="field" style={{ marginTop: 13 }}>
            <label htmlFor="auth-password">Password</label>
            <div className="password-wrap">
              <input
                autoComplete={isRegistering ? "new-password" : "current-password"}
                className="input"
                id="auth-password"
                minLength={isRegistering ? 8 : undefined}
                name="password"
                placeholder="At least 8 characters"
                required
                type={showPassword ? "text" : "password"}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                {showPassword ? <LuEyeOff size={16} /> : <LuEye size={16} />}
              </button>
            </div>
          </div>
          {isRegistering && (
            <div className="field" style={{ marginTop: 13 }}>
              <label htmlFor="confirm-password">Confirm password</label>
              <div className="password-wrap">
                <input
                  autoComplete="new-password"
                  className="input"
                  id="confirm-password"
                  minLength={8}
                  name="confirmPassword"
                  placeholder="Enter your password again"
                  required
                  type={showConfirmation ? "text" : "password"}
                />
                <button
                  aria-label={
                    showConfirmation
                      ? "Hide confirmation password"
                      : "Show confirmation password"
                  }
                  aria-pressed={showConfirmation}
                  className="password-toggle"
                  onClick={() => setShowConfirmation((visible) => !visible)}
                  type="button"
                >
                  {showConfirmation ? (
                    <LuEyeOff size={16} />
                  ) : (
                    <LuEye size={16} />
                  )}
                </button>
              </div>
            </div>
          )}
          {message && (
            <p
              aria-live="polite"
              className={`notice${messageType === "success" ? " success-notice" : ""}`}
              style={{ marginTop: 14 }}
            >
              {message}
            </p>
          )}
          <button
            className="primary-button"
            disabled={isSubmitting}
            type="submit"
          >
            {isRegistering ? <LuUserPlus size={15} /> : <LuLogIn size={15} />}
            {isSubmitting
              ? "Please wait..."
              : isRegistering
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
        <p className="auth-switch">
          {isRegistering ? "Already have an account?" : "New to Studybook?"}{" "}
          <button
            className="text-button"
            onClick={() => {
              setMode(isRegistering ? "sign-in" : "register");
              setMessage("");
            }}
            type="button"
          >
            {isRegistering ? "Sign in" : "Create an account"}
          </button>
        </p>
      </section>
    </div>
  );
}
function StudybookFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const {
    profile,
    setProfile,
    setTheme,
    theme,
    isLoaded,
    storageError,
    tasks,
    toasts,
    dismissToast,
  } = useStudybook();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [messagesWidget, setMessagesWidget] =
    useState<MessagesWidget>("closed");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState("");
  const [username, setUsername] = useState("");

  const messaging = useMessaging(authUser);
  const messagesBadge = authUser
    ? messaging.totalUnread + messaging.incomingRequests.length
    : 0;

  const pendingCount = tasks.filter((task) => !task.completed).length;

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setAuthUser(session?.user ?? null);
        setAuthError("");
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser || !isLoaded) return;

    const metadata = authUser.user_metadata ?? {};
    const rawName =
      typeof metadata.display_name === "string"
        ? metadata.display_name
        : typeof metadata.full_name === "string"
          ? metadata.full_name
          : typeof metadata.name === "string"
            ? metadata.name
            : "";
    const metadataName = rawName.trim();
    const fallbackName = authUser.email ? authUser.email.split("@")[0] : "";
    const metadataAvatar =
      typeof metadata.avatar_url === "string"
        ? metadata.avatar_url
        : typeof metadata.picture === "string"
          ? metadata.picture
          : "";

    let active = true;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", authUser.id)
      .single()
      .then(
        ({
          data,
        }: {
          data: { display_name: string | null; avatar_url: string | null } | null;
        }) => {
          if (!active) return;
          const profileName = data?.display_name?.trim() ?? "";
          const profileAvatar = data?.avatar_url ?? "";

          setProfile((current) => ({
            ...current,
            name: profileName || metadataName || fallbackName || current.name,
            email: authUser.email ?? current.email,
            avatar: current.avatar || profileAvatar || metadataAvatar,
          }));
        },
      );

    return () => {
      active = false;
    };
  }, [authUser, isLoaded, setProfile]);

  useEffect(() => {
    if (!authUser) return;

    let active = true;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("profiles")
      .select("username")
      .eq("id", authUser.id)
      .single()
      .then(({ data }: { data: { username: string | null } | null }) => {
        if (active) setUsername(data?.username ?? "");
      });

    return () => {
      active = false;
    };
  }, [authUser, pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 901px)");
    function closeOnDesktop() {
      if (desktop.matches) setMobileMenuOpen(false);
    }
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(MESSAGES_WIDGET_KEY);
      if (saved === "open" || saved === "minimized" || saved === "closed") {
        setMessagesWidget(saved);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function updateMessagesWidget(next: MessagesWidget) {
    setMessagesWidget(next);
    try {
      window.localStorage.setItem(MESSAGES_WIDGET_KEY, next);
    } catch {
      // If storage is unavailable the widget still works for this visit.
    }
  }

  function toggleTheme() {    const nextTheme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }

  async function handleSignOut() {
    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut();
      if (error) throw error;
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Could not sign out.",
      );
    }
  }

  return (
    <>
      <div className="app-shell">
        {mobileMenuOpen && (
          <button
            aria-label="Close navigation menu"
            className="mobile-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            type="button"
          />
        )}
        <aside
          aria-label="Main navigation"
          className={`sidebar${mobileMenuOpen ? " mobile-open" : ""}`}
          id="primary-sidebar"
        >
          <Link
            aria-label="Studybook home"
            className="brand"
            href="/"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="brand-mark">
              <LuBookOpen size={19} />
            </span>
            <span className="brand-text">
              <span className="brand-name">studybook</span>
              <span className="brand-caption">your student space</span>
            </span>
          </Link>
          <p className="nav-label">Your workspace</p>
          <nav>
            {navigation.map(({ href, icon: Icon, label }) => (
              <Link
                aria-current={pathname === href ? "page" : undefined}
                aria-label={label}
                className={`nav-link${pathname === href ? " active" : ""}`}
                href={href}
                key={href}
                onClick={() => setMobileMenuOpen(false)}
                title={label}
              >
                <Icon size={18} />
                <span className="nav-text">{label}</span>
                {href === "/to-do-list" && pendingCount > 0 && (
                  <span className="nav-badge">{pendingCount}</span>
                )}
              </Link>
            ))}
            <button
              className="nav-link nav-button"
              onClick={() => {
                updateMessagesWidget("open");
                setMobileMenuOpen(false);
                void messaging.refresh();
              }}
              title="Messages"
              type="button"
            >
              <LuMessageCircle size={18} />
              <span className="nav-text">Messages</span>
              {messagesBadge > 0 && (
                <span className="nav-badge">{messagesBadge}</span>
              )}
            </button>
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-tip">
              <strong>
                <LuCircleHelp
                  aria-hidden="true"
                  size={14}
                  style={{
                    display: "inline",
                    marginRight: 6,
                    verticalAlign: "-2px",
                  }}
                />
                A little reminder
              </strong>
              Small steps add up. You&apos;re doing great.
            </div>
            <Link
              aria-current={pathname === "/profile" ? "page" : undefined}
              aria-label="Account"
              className={`nav-link sidebar-account${pathname === "/profile" ? " active" : ""}`}
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              title="Account"
            >
              <LuFolderOpen size={18} />
              <span className="nav-text">Account</span>
              <LuChevronRight
                aria-hidden="true"
                className="nav-arrow"
                size={14}
              />
            </Link>
            <Link
              aria-label={`${profile.name || "Student"}'s profile`}
              className="sidebar-profile"
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              title="View profile"
            >
              <ProfileAvatar image={profile.avatar} name={profile.name} />
              <span className="sidebar-profile-copy">
                <span className="sidebar-profile-name">{profile.name}</span>
                <span
                  className="sidebar-profile-caption"
                  title={username ? `@${username}` : undefined}
                >
                  {authUser
                    ? profile.email || (username ? `@${username}` : "View profile")
                    : "View profile"}
                </span>
              </span>
            </Link>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                aria-controls="primary-sidebar"
                aria-expanded={mobileMenuOpen}
                aria-label="Open navigation menu"
                className="icon-button mobile-menu-button"
                onClick={() => setMobileMenuOpen(true)}
                type="button"
              >
                <LuMenu size={19} />
              </button>
              <span className="topbar-location">
                Workspace <span aria-hidden="true">/</span>{" "}
                {pageNames[pathname] ?? "Studybook"}
              </span>
            </div>
            <div className="topbar-actions">
              <button
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                className="icon-button"
                onClick={toggleTheme}
                title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                type="button"
              >
                {theme === "light" ? <LuMoon size={17} /> : <LuSun size={17} />}
              </button>
              {authUser ? (
                <button
                  className="sign-in-button"
                  onClick={handleSignOut}
                  type="button"
                >
                  <LuLogIn size={15} />
                  Sign out
                </button>
              ) : (
                <>
                  <button
                    className="register-button"
                    onClick={() => setAuthMode("register")}
                    type="button"
                  >
                    <LuUserPlus size={15} />
                    Register
                  </button>
                  <button
                    className="sign-in-button"
                    onClick={() => setAuthMode("sign-in")}
                    type="button"
                  >
                    <LuLogIn size={15} />
                    Sign in
                  </button>
                </>
              )}
            </div>
          </header>
          <main className="page-content">
            {storageError && (
              <p aria-live="polite" className="notice">
                {storageError}
              </p>
            )}
            {authError && (
              <p aria-live="polite" className="notice">
                {authError}
              </p>
            )}
            {children}
          </main>
        </div>
        {authMode && (
          <AuthModal
            initialMode={authMode}
            onClose={() => setAuthMode(null)}
          />
        )}
        {messagesWidget !== "closed" && (
          <MessagingPanel
            api={messaging}
            minimized={messagesWidget === "minimized"}
            onClose={() => updateMessagesWidget("closed")}
            onMinimize={() => updateMessagesWidget("minimized")}
            user={authUser}
          />
        )}
        {messagesWidget === "minimized" && (
          <div className="messenger-bubble-wrap">
            <button
              aria-label={
                messagesBadge > 0
                  ? `Open messages, ${messagesBadge} unread`
                  : "Open messages"
              }
              className="messenger-bubble"
              onClick={() => updateMessagesWidget("open")}
              type="button"
            >
              <LuMessageCircle size={22} />
              {messagesBadge > 0 && (
                <span className="messenger-bubble-badge">{messagesBadge}</span>
              )}
            </button>
            <button
              aria-label="Close messages"
              className="messenger-bubble-close"
              onClick={() => updateMessagesWidget("closed")}
              type="button"
            >
              <LuX size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div className={`toast toast-${toast.type}`} key={toast.id} role="status">
            <span className="toast-icon">
              {toast.type === "success" ? (
                <LuCircleCheck size={16} />
              ) : toast.type === "error" ? (
                <LuCircleAlert size={16} />
              ) : (
                <LuInfo size={16} />
              )}
            </span>
            <span className="toast-copy">{toast.message}</span>
            <button
              aria-label="Dismiss notification"
              className="toast-close"
              onClick={() => dismissToast(toast.id)}
              type="button"
            >
              <LuX size={14} />
            </button>
          </div>
        ))}
      </div>
      <HalloweenChallenge />
      <HolidayEffects />
      <MusicPlayer />
    </>
  );
}

export default function StudybookShell({ children }: { children: ReactNode }) {
  return (
    <StudybookProvider>
      <MusicProvider>
        <StudybookFrame>{children}</StudybookFrame>
      </MusicProvider>
    </StudybookProvider>
  );
}

export { ProfileAvatar };




