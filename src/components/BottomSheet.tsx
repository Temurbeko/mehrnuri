"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A sheet that slides up from the bottom (centred dialog on wide screens).
 * Closes on the dimmed backdrop, Esc, or the caller's own button; locks page
 * scroll while open and returns focus to whatever opened it.
 */
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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <button type="button" aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-[rgba(10,10,16,0.45)]" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="sheet-in absolute inset-x-0 bottom-0 mx-auto max-h-[88dvh] max-w-[480px] overflow-y-auto rounded-t-[28px] bg-white px-5 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+22px)] outline-none sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[28px]"
      >
        <div aria-hidden="true" className="mx-auto mb-3.5 h-1.5 w-11 rounded-full bg-[var(--tone)] sm:hidden" />
        {children}
      </div>
    </div>,
    document.body,
  );
}
