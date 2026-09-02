"use client";
import { useEffect, useState } from "react";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (localStorage.getItem("fcc_install_dismissed")) return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      setIosHint(true);
      setHidden(false);
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    localStorage.setItem("fcc_install_dismissed", "1");
    setHidden(true);
  };

  return (
    <div className="install-banner" role="dialog" aria-label="Install app">
      <span style={{ flex: 1 }}>
        {iosHint
          ? "Add to Home Screen: tap Share, then “Add to Home Screen”."
          : "Install Freedom CC for a full-screen, app-like experience."}
      </span>
      {!iosHint && deferred && (
        <button
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            dismiss();
          }}
        >
          Install
        </button>
      )}
      <button className="x" aria-label="Dismiss" onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}
