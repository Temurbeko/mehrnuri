"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A sheet that slides up from the bottom (centred dialog on wide screens).
 * Closes on the dimmed backdrop, Esc, or the caller's own button; locks page
 * scroll while open and returns focus to whatever opened it.
 */
/**
 * Body scroll lock shared by every open sheet (iOS Safari ignores overflow:hidden
 * on body, so the page is pinned with position:fixed). Applied on the first open
 * sheet, undone on the last; the scroll position is restored only if we are still
 * on the same page (a sheet closed by navigating away must not scroll the new page).
 */
let locks = 0;
let saved: { y: number; path: string; style: Pick<CSSStyleDeclaration, "overflow" | "position" | "top" | "width"> } | null = null;
function lockBody() {
  locks += 1;
  if (locks > 1) return;
  const b = document.body.style;
  saved = { y: window.scrollY, path: window.location.pathname, style: { overflow: b.overflow, position: b.position, top: b.top, width: b.width } };
  b.overflow = "hidden";
  b.position = "fixed";
  b.top = `-${saved.y}px`;
  b.width = "100%";
}
function unlockBody() {
  locks = Math.max(0, locks - 1);
  if (locks > 0 || !saved) return;
  const b = document.body.style;
  b.overflow = saved.style.overflow;
  b.position = saved.style.position;
  b.top = saved.style.top;
  b.width = saved.style.width;
  if (window.location.pathname === saved.path) window.scrollTo({ top: saved.y, behavior: "instant" });
  saved = null;
}

export function BottomSheet({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    lockBody();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      unlockBody();
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <button type="button" aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0 h-full w-full cursor-default touch-none overscroll-none bg-[rgba(10,10,16,0.45)]" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="sheet-in absolute inset-x-0 bottom-0 mx-auto max-h-[88dvh] max-w-[480px] overflow-y-auto overscroll-contain rounded-t-[28px] bg-white px-5 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+22px)] outline-none sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[28px]"
      >
        <div aria-hidden="true" className="mx-auto mb-3.5 h-1.5 w-11 rounded-full bg-[var(--tone)] sm:hidden" />
        {children}
      </div>
    </div>,
    document.body,
  );
}
