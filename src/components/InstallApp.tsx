"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import type { Dictionary } from "@/i18n";

type InstallEvent = Event & { prompt: () => Promise<void> };

/** A settings row to add the app to the home screen. Renders nothing when already installed. */
export function InstallApp({ dict }: { dict: Dictionary }) {
  const [standalone, setStandalone] = useState(true);
  const [ios, setIos] = useState(false);
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setStandalone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const t = setTimeout(() => {
      setStandalone(isStandalone);
      setIos(isIos);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone || (!event && !ios)) return null;

  const icon = (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--tone)] text-[var(--ink)]">
      <Download size={18} aria-hidden="true" />
    </span>
  );

  if (event) {
    return (
      <li>
        <button
          type="button"
          onClick={async () => {
            await event.prompt();
            setEvent(null);
          }}
          className="list-row-tap flex w-full min-w-0 cursor-pointer items-center gap-3 text-left"
        >
          {icon}
          <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-[var(--ink)]">{dict.install.button}</span>
        </button>
      </li>
    );
  }

  return (
    <li className="list-row flex min-w-0 items-center gap-3">
      {icon}
      <span className="min-w-0 flex-1 text-[14px] leading-snug font-semibold text-[var(--ink-soft)]">{dict.install.iosHint}</span>
    </li>
  );
}
