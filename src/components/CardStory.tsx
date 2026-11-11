"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * The family's own words on a feed card: two lines, with "Ko'proq" to open the
 * rest in place when it is longer. The toggle sits above the card's
 * full-card link, so tapping it expands instead of opening the bill.
 */
export function CardStory({ story, more, less }: { story: string; more: string; less: string }) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setLong(el.scrollHeight > el.clientHeight + 1);
  }, [story, open]);

  return (
    <div className="min-w-0">
      <p ref={ref} className={`m-0 text-[15px] leading-normal break-words text-[var(--ink)] ${open ? "" : "line-clamp-2"}`}>
        <span aria-hidden="true" className="font-extrabold text-[var(--lamp-deep)]">“</span>
        {story}
        <span aria-hidden="true" className="font-extrabold text-[var(--lamp-deep)]">”</span>
      </p>
      {(long || open) && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          className="relative z-10 mt-0.5 cursor-pointer text-[13px] font-extrabold text-[var(--lamp-deep)]"
        >
          {open ? less : more}
        </button>
      )}
    </div>
  );
}
