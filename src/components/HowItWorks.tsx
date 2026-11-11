"use client";

import { useCallback, useState } from "react";
import { CircleHelp, HouseHeart, Lightbulb, ShieldCheck, Smartphone } from "lucide-react";
import type { Dictionary } from "@/i18n";
import { BottomSheet } from "./BottomSheet";

/**
 * "How it works?" — always reachable from the top of the home page, but not
 * taking space: a small pill that opens a sheet with the three steps.
 */
export function HowItWorks({
  dict,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  dict: Dictionary;
  /** Optional: let a parent (the home slider) own the open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const t = dict.how;
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = useCallback(
    (v: boolean) => {
      setInnerOpen(v);
      onOpenChange?.(v);
    },
    [onOpenChange],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);

  const steps = [
    { Icon: HouseHeart, title: t.s1t, text: t.s1d },
    { Icon: Smartphone, title: t.s2t, text: t.s2d },
    { Icon: Lightbulb, title: t.s3t, text: t.s3d },
  ];

  return (
    <>
      {!hideTrigger && (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--tone)] px-3 text-sm font-bold whitespace-nowrap text-[var(--ink)] transition active:scale-95"
      >
        <CircleHelp size={16} aria-hidden="true" />
        {t.open}
      </button>
      )}
      <BottomSheet open={open} onClose={close} labelledBy="how-title">
        <h2 id="how-title" className="text-2xl font-extrabold tracking-tight text-[var(--ink)]">
          {t.open}
        </h2>
        <p className="mt-1 mb-4 text-base text-[var(--ink-soft)]">{t.lead}</p>
        <ol className="mb-5 grid gap-3.5">
          {steps.map(({ Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-[var(--lamp-deep)]">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <b className="block text-base text-[var(--ink)]">{title}</b>
                <span className="text-sm text-[var(--ink-soft)]">{text}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mb-4 flex items-start gap-2.5 rounded-2xl bg-[var(--paper)] px-3.5 py-3 text-sm text-[var(--ink-soft)]">
          <ShieldCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--hope)]" />
          {t.trust}
        </p>
        <button type="button" onClick={close} className="btn-primary">
          {t.ok}
        </button>
      </BottomSheet>
    </>
  );
}
