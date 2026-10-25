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
  LuMoon,
  LuNotebookPen,
  LuSun,
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
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

const navigation = [
  { label: "Overview", href: "/", icon: LuHouse },
  { label: "Weekly schedule", href: "/schedule", icon: LuCalendarDays },
  { label: "To-do list", href: "/to-do-list", icon: LuCheck },
  { label: "My notes", href: "/notes", icon: LuNotebookPen },
];

const pageNames: Record<string, string> = {
  "/": "Overview",
  "/schedule": "Weekly schedule",
  "/to-do-list": "To-do list",
  "/notes": "My notes",
  "/account": "My account",
  "/profile": "Profile",
};

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
        const confirmation = String(formData.get("confirmPassword") ?? "");
        if (password !== confirmation) {
          setMessageType("error");
          setMessage("Your passwords do not match.");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
          },
        });

        if (error) throw error;

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
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-labelledby="auth-title"
        aria-modal="true"
        className="modal"
        onClick={(event) => event.stopPropagation()}
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
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState("");

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
    const displayName = rawName.trim();
    const fallbackName = authUser.email ? authUser.email.split("@")[0] : "";
    const avatar =
      typeof metadata.avatar_url === "string"
        ? metadata.avatar_url
        : typeof metadata.picture === "string"
          ? metadata.picture
          : "";

    setProfile((current) => ({
      ...current,
      name: displayName || fallbackName || current.name,
      email: authUser.email ?? current.email,
      avatar: current.avatar || avatar,
    }));
  }, [authUser, isLoaded, setProfile]);

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

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
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
                <span className="sidebar-profile-caption">View profile</span>
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
    </>
  );
}

export default function StudybookShell({ children }: { children: ReactNode }) {
  return (
    <StudybookProvider>
      <StudybookFrame>{children}</StudybookFrame>
    </StudybookProvider>
  );
}

export { ProfileAvatar };




