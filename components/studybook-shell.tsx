"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  LuBookOpen,
  LuCalendarDays,
  LuCheck,
  LuCircleHelp,
  LuEye,
  LuEyeOff,
  LuHouse,
  LuLogIn,
  LuMenu,
  LuMoon,
  LuNotebookPen,
  LuSun,
  LuX,
} from "react-icons/lu";
import {
  StudybookProvider,
  useStudybook,
} from "@/components/studybook-context";

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

function SignInModal({ onClose }: { onClose: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(
      "Sign-in is not connected yet. Your account will be secured with Supabase once authentication is configured.",
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-labelledby="sign-in-title"
        aria-modal="true"
        className="modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-heading">
          <div>
            <h2 className="modal-title" id="sign-in-title">
              Welcome back
            </h2>
            <p className="modal-copy">
              Sign in to keep your study life in sync.
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
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="signin-email">Email address</label>
            <input
              autoComplete="email"
              className="input"
              id="signin-email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </div>
          <div className="field" style={{ marginTop: 13 }}>
            <label htmlFor="signin-password">Password</label>
            <div className="password-wrap">
              <input
                autoComplete="current-password"
                className="input"
                id="signin-password"
                minLength={8}
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
          {message && (
            <p aria-live="polite" className="notice" style={{ marginTop: 14 }}>
              {message}
            </p>
          )}
          <button className="primary-button" type="submit">
            <LuLogIn size={15} />
            Sign in
          </button>
        </form>
        <p
          className="modal-copy"
          style={{ marginTop: 14, textAlign: "center" }}
        >
          Authentication is not active yet. This form does not transmit or save
          your password.
        </p>
      </section>
    </div>
  );
}

function StudybookFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { profile, setTheme, theme, storageError } = useStudybook();
  const [showSignIn, setShowSignIn] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
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
          <span>
            <span className="brand-name">studybook</span>
            <span className="brand-caption">your student space</span>
          </span>
        </Link>
        <p className="nav-label">Your workspace</p>
        <nav>
          {navigation.map(({ href, icon: Icon, label }) => (
            <Link
              aria-current={pathname === href ? "page" : undefined}
              className={`nav-link${pathname === href ? " active" : ""}`}
              href={href}
              key={href}
              onClick={() => setMobileMenuOpen(false)}
              title={label}
            >
              <Icon size={18} />
              <span>{label}</span>
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
            aria-label={`${profile.name || "Student"}'s profile, my account`}
            className={`sidebar-profile${pathname === "/account" ? " active" : ""}`}
            href="/account"
            onClick={() => setMobileMenuOpen(false)}
            title="My account"
          >
            <ProfileAvatar image={profile.avatar} name={profile.name} />
            <span className="sidebar-profile-copy">
              <span className="sidebar-profile-name">{profile.name}</span>
              <span className="sidebar-profile-caption">My account</span>
            </span>
          </Link>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
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
              onClick={() =>
                setTheme((current) => (current === "light" ? "dark" : "light"))
              }
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              type="button"
            >
              {theme === "light" ? <LuMoon size={17} /> : <LuSun size={17} />}
            </button>
            <button
              className="sign-in-button"
              onClick={() => setShowSignIn(true)}
              type="button"
            >
              <LuLogIn size={15} />
              Sign in
            </button>
          </div>
        </header>
        <main className="page-content">
          {storageError && (
            <p aria-live="polite" className="notice">
              {storageError}
            </p>
          )}
          {children}
        </main>
      </div>
      {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
    </div>
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
