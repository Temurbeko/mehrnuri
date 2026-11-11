"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type State = "idle" | "run" | "done";

export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [state, setState] = useState<State>("idle");
  const timer = useRef<number | undefined>(undefined);
  const running = useRef(false);

  useEffect(() => {
    const finish = () => {
      if (!running.current) return;
      running.current = false;
      window.clearTimeout(timer.current);
      setState("done");
      timer.current = window.setTimeout(() => setState("idle"), 450);
    };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      window.clearTimeout(timer.current);
      running.current = true;
      setState("idle");
      requestAnimationFrame(() => requestAnimationFrame(() => running.current && setState("run")));
      // Safety: never leave the bar hanging if the navigation is aborted.
      timer.current = window.setTimeout(finish, 15000);
    };
    // capture phase: next/link calls preventDefault() before a bubbling listener would see the click
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!running.current) return;
    running.current = false;
    window.clearTimeout(timer.current);
    setState("done");
    timer.current = window.setTimeout(() => setState("idle"), 450);
  }, [pathname, search]);

  return <div className="nav-progress" data-state={state} aria-hidden="true" />;
}
