"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="app-error-state">
      <span aria-hidden="true" className="app-error-orb">
        ✦
      </span>
      <p className="eyebrow">A small detour</p>
      <h1>That page hit a snag.</h1>
      <p>
        Your studybook is still safe. Try the page again, or head back to the
        overview and pick up where you left off.
      </p>
      <div className="app-error-actions">
        <button className="primary-button" onClick={() => reset()} type="button">
          Try again
        </button>
        <Link className="secondary-button" href="/">
          Back to overview
        </Link>
      </div>
    </div>
  );
}
