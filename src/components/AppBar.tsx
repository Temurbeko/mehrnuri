"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Compact sticky app bar for inner pages: back chevron, title, optional action.
 * `onBack` overrides the default (history back, or the locale home when the
 * page was opened directly).
 */
export function AppBar({
  title,
  locale,
  backLabel,
  onBack,
  action,
}: {
  title: string;
  locale: string;
  backLabel: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  const router = useRouter();

  function back() {
    if (onBack) return onBack();
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(`/${locale}`);
  }

  return (
    <div className="appbar -mx-4 -mt-5 mb-3 sm:-mt-8">
      <button type="button" onClick={back} aria-label={backLabel} className="appbar-btn">
        <ChevronLeft size={24} aria-hidden="true" />
      </button>
      <h2 className="min-w-0 flex-1 truncate text-[17px] font-extrabold tracking-tight text-[var(--ink)]">{title}</h2>
      <div className="flex min-w-10 shrink-0 justify-end">{action}</div>
    </div>
  );
}
