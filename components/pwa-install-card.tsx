"use client";

import { useEffect, useState } from "react";
import { LuDownload, LuSmartphone } from "react-icons/lu";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PWAInstallCard() {
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [installError, setInstallError] = useState("");

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;

    setInstallError("");
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } catch (error) {
      console.error("Studybook installation prompt failed:", error);
      setInstallError(
        "The install prompt could not be opened. Try installing from your browser menu.",
      );
    }
  }

  return (
    <section className="panel settings-wide">
      <div className="panel-heading">
        <h2 className="panel-title">Install Studybook</h2>
      </div>
      <div className="panel-body">
        <div className="pwa-install-content">
          <span aria-hidden="true" className="pwa-install-icon">
            <LuSmartphone size={21} />
          </span>
          <div className="pwa-install-copy">
            <strong>Open Studybook from your home screen</strong>
            <span>
              iPhone or iPad: in Safari, tap Share, then Add to Home Screen.
              Android: tap Install app or choose Add to Home Screen from your
              browser menu.
            </span>
          </div>
          {installPrompt && (
            <button
              className="primary-button"
              onClick={() => void installApp()}
              type="button"
            >
              <LuDownload aria-hidden="true" size={15} />
              Install app
            </button>
          )}
        </div>
        {installError && (
          <p aria-live="polite" className="notice">
            {installError}
          </p>
        )}
      </div>
    </section>
  );
}
