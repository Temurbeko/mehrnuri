"use client";

import { Check, Copy, Send, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/i18n";
import { copyText } from "@/lib/clipboard";

/**
 * Ways to share a link that work on every phone and browser: Telegram and
 * WhatsApp (plain links, the apps most people here use), copying the link,
 * and the phone's own share menu when the browser offers one (it does not on
 * plain-http pages, e.g. iPhone Safari over a local address). Every action
 * gives visible feedback; nothing fails silently.
 */
export function ShareOptions({ url, text, dict }: { url: string; text: string; dict: Dictionary }) {
  const t = dict.shareTo;
  const [toast, setToast] = useState<string | null>(null);
  const [native, setNative] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNative(typeof navigator.share === "function");
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function say(msg: string) {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2400);
  }

  async function copy() {
    say((await copyText(`${text} ${url}`)) ? t.copied : t.copyFailed);
  }

  async function more() {
    try {
      await navigator.share({ text, url });
    } catch (err) {
      // closed by the user: fine; anything else: fall back to copying
      if (!(err instanceof DOMException && err.name === "AbortError")) await copy();
    }
  }

  const enc = encodeURIComponent;
  const tile = "flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-[12.5px] font-bold text-[var(--ink)] active:scale-95 transition";
  const icon = "flex h-12 w-12 items-center justify-center rounded-full";

  return (
    <div>
      <div className={`grid gap-1 ${native ? "grid-cols-4" : "grid-cols-3"}`}>
        <a href={`https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`} target="_blank" rel="noopener noreferrer" className={tile}>
          <span className={`${icon} bg-[#2aabee] text-white`}>
            <Send size={21} aria-hidden="true" className="-ml-0.5" />
          </span>
          <span className="truncate">Telegram</span>
        </a>
        <a href={`https://wa.me/?text=${enc(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer" className={tile}>
          <span className={`${icon} bg-[#25d366] text-white`}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z" />
            </svg>
          </span>
          <span className="truncate">WhatsApp</span>
        </a>
        <button type="button" onClick={copy} className={`${tile} cursor-pointer`}>
          <span className={`${icon} bg-[var(--tone)]`}>
            <Copy size={20} aria-hidden="true" />
          </span>
          <span className="truncate">{t.copy}</span>
        </button>
        {native && (
          <button type="button" onClick={more} className={`${tile} cursor-pointer`}>
            <span className={`${icon} bg-[var(--tone)]`}>
              <Share2 size={20} aria-hidden="true" />
            </span>
            <span className="truncate">{t.more}</span>
          </button>
        )}
      </div>
      {toast && (
        <div role="status" className="toast flex max-w-[90vw] items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 text-center text-sm font-bold text-[var(--paper)] shadow-lg">
          <Check size={18} aria-hidden="true" className="shrink-0 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
