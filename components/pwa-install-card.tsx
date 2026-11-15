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
  const [isInstalledApp, setIsInstalledApp] = useState(false);
  const [supportsAppBadge, setSupportsAppBadge] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [badgePermissionMessage, setBadgePermissionMessage] = useState("");

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }

    const timer = window.setTimeout(() => {
      setIsInstalledApp(
        window.matchMedia("(display-mode: standalone)").matches ||
          ("standalone" in navigator && navigator.standalone === true),
      );
      setSupportsAppBadge(typeof navigator.setAppBadge === "function");
      setNotificationPermission(
        "Notification" in window ? Notification.permission : "unsupported",
      );
    }, 0);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.clearTimeout(timer);
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

  async function enableAppBadge() {
    if (!("Notification" in window)) return;

    setBadgePermissionMessage("");
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        window.dispatchEvent(new Event("studybook:app-badge-permission-changed"));
        setBadgePermissionMessage("Unread message badges are enabled.");
      } else {
        setBadgePermissionMessage(
          "Allow notifications for Studybook in your phone settings to enable the badge.",
        );
      }
    } catch (error) {
      console.error("Could not request badge permission:", error);
      setBadgePermissionMessage(
        "Could not request permission. Check your phone settings and try again.",
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
          {isInstalledApp &&
            supportsAppBadge &&
            notificationPermission === "default" && (
              <button
                className="secondary-button"
                onClick={() => void enableAppBadge()}
                type="button"
              >
                Enable unread message badge
              </button>
            )}
        </div>
        {isInstalledApp &&
          supportsAppBadge &&
          notificationPermission === "granted" && (
            <p className="field-hint">
              Unread message badge permission is enabled.
            </p>
          )}
        {badgePermissionMessage && (
          <p aria-live="polite" className="notice">
            {badgePermissionMessage}
          </p>
        )}
        {installError && (
          <p aria-live="polite" className="notice">
            {installError}
          </p>
        )}
      </div>
    </section>
  );
}
