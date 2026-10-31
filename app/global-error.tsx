"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const router = useRouter();

  return (
    <html lang="en">
      <body>
        <div className="app-error-state app-error-global">
          <span aria-hidden="true" className="app-error-orb">
            ✦
          </span>
          <p className="eyebrow">A small detour</p>
          <h1>Studybook needs a refresh.</h1>
          <p>
            Something unexpected happened while loading the app. Your saved
            studybook is still safe on this device and your account.
          </p>
          <div className="app-error-actions">
            <button
              className="primary-button"
              onClick={() => reset()}
              type="button"
            >
              Try again
            </button>
            <button
              className="secondary-button"
              onClick={() => router.push("/")}
              type="button"
            >
              Back to overview
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
