"use client";

import Link from "next/link";
import { Heart, Home, HouseHeart, Lightbulb, Smartphone } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { UTILITY_ICONS } from "@/lib/domain";
import type { ClosedThanks } from "@/lib/community";
import type { Locale } from "@/i18n/config";
import { fmt, type Dictionary } from "@/i18n";
import { BuildingArt } from "./BuildingArt";
import { JourneyArt, StreetArt, ThanksArt } from "./HeroArt";
import { HowItWorks } from "./HowItWorks";

const AUTO_MS = 5000;
const IDLE_MS = 8000;

type SlideId = "main" | "closed" | "how" | "live";

/** Counts up to `to` (transform-free: just text) once `run` turns true. */
function CountUp({ to, run }: { to: number; run: boolean }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || done) {
      el.textContent = String(to);
      return;
    }
    if (!run) {
      el.textContent = "0";
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 1200);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
      else setDone(true);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run, to, done]);

  return <span ref={ref}>{to}</span>;
}

export function HeroSlider({
  locale,
  dict,
  waiting,
  weekCount,
  closed,
}: {
  locale: Locale;
  dict: Dictionary;
  waiting: number;
  weekCount: number;
  closed: ClosedThanks[];
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [howOpen, setHowOpen] = useState(false);
  const indexRef = useRef(0);
  const pausedUntil = useRef(0);
  const visible = useRef(true);
  const rafRef = useRef(0);

  const slides: SlideId[] = ["main", ...(closed.length > 0 ? (["closed"] as const) : []), "how", "live"];
  const count = slides.length;
  const thanks = closed[0];

  const hold = useCallback((ms: number) => {
    pausedUntil.current = ms === Infinity ? Infinity : Date.now() + ms;
  }, []);

  const goTo = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  // Track the active slide from scroll position.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const i = Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
        if (i !== indexRef.current) {
          indexRef.current = i;
          setIndex(i);
        }
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [count]);

  // Auto-advance, paused by touch, off-screen, hidden tab and reduced motion.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const io = new IntersectionObserver(([entry]) => {
      visible.current = Boolean(entry?.isIntersecting);
    }, { threshold: 0.4 });
    io.observe(el);

    const down = () => hold(Infinity);
    const up = () => hold(IDLE_MS);
    el.addEventListener("pointerdown", down, { passive: true });
    el.addEventListener("pointerup", up, { passive: true });
    el.addEventListener("pointercancel", up, { passive: true });
    el.addEventListener("touchstart", down, { passive: true });
    el.addEventListener("touchend", up, { passive: true });
    el.addEventListener("touchcancel", up, { passive: true });
    el.addEventListener("wheel", up, { passive: true });

    const timer = window.setInterval(() => {
      if (reduce.matches || document.hidden || !visible.current || Date.now() < pausedUntil.current) return;
      goTo((indexRef.current + 1) % count);
    }, AUTO_MS);

    return () => {
      io.disconnect();
      window.clearInterval(timer);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("touchstart", down);
      el.removeEventListener("touchend", up);
      el.removeEventListener("touchcancel", up);
      el.removeEventListener("wheel", up);
    };
  }, [count, goTo, hold]);

  const steps = [
    { Icon: HouseHeart, text: dict.how.s1t },
    { Icon: Smartphone, text: dict.how.s2t },
    { Icon: Lightbulb, text: dict.how.s3t },
  ];

  function renderSlide(id: SlideId) {
    if (id === "main") {
      return (
        <div className="flex h-full flex-col justify-center">
          <div className="relative flex items-end gap-3.5">
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-[7px] text-[13px] font-bold text-[var(--glow)]">
                <span aria-hidden="true" className="lamp-dot shrink-0" />
                {fmt(dict.home.stats, { count: waiting })}
              </span>
              <h1 className="mt-2.5 mb-2 text-[25px] leading-[1.12] font-extrabold tracking-tight text-balance min-[380px]:text-[28px]">
                {dict.home.heroTitle}
              </h1>
              <p className="text-[14.5px] text-[#cfc6b8] min-[380px]:text-[15px]">
                {weekCount > 0 ? fmt(dict.feed.heroWeek, { count: weekCount }) : dict.feed.heroWeekNone}
              </p>
            </div>
            <BuildingArt className="-mr-1.5 -mb-1 h-[150px] w-[112px] shrink-0 min-[380px]:h-[168px] min-[380px]:w-[126px] md:h-[230px] md:w-[172px]" />
          </div>
          <div className="relative mt-5 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 min-[420px]:gap-2.5">
            <a href="#feed" className="btn-primary min-w-0 px-4">
              <Heart size={20} aria-hidden="true" />
              {dict.home.wantHelp}
            </a>
            <Link href={`/${locale}/ask`} className="btn btn-glass min-w-0 px-4">
              <Home size={20} aria-hidden="true" />
              {dict.home.needHelp}
            </Link>
          </div>
        </div>
      );
    }
    if (id === "closed" && thanks) {
      return (
        <div className="flex h-full items-center gap-3 md:gap-8">
          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            <div className="hs-rise flex items-center gap-2 text-[13px] font-extrabold text-[var(--glow)]">
              <span aria-hidden="true" className="text-[20px] leading-none">{UTILITY_ICONS[thanks.utilityType]}</span>
              {dict.feed.closedTitle}
            </div>
            <blockquote className="hs-rise m-0 text-[22px] leading-[1.18] font-extrabold tracking-tight text-balance break-words min-[380px]:text-[24px] md:text-[32px]">
              <span aria-hidden="true" className="text-[var(--glow)]">“</span>
              {dict.reactions.items[thanks.reaction]}
              <span aria-hidden="true" className="text-[var(--glow)]">”</span>
            </blockquote>
            <p className="hs-rise text-[14px] font-semibold text-[#e6dccb]">{dict.app.closedLine}</p>
            <span className="hs-rise inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--glow)] px-3 py-1 text-[13px] font-extrabold whitespace-nowrap text-[#3b2508]">
              <Heart size={14} aria-hidden="true" />
              {fmt(dict.feed.helpersCount, { count: thanks.helpers })}
            </span>
          </div>
          <ThanksArt className="h-[150px] w-[112px] shrink-0 min-[380px]:h-[168px] min-[380px]:w-[126px] md:h-[240px] md:w-[180px]" />
        </div>
      );
    }
    if (id === "how") {
      return (
        <div className="flex h-full flex-col justify-center gap-3 md:flex-row md:items-center md:gap-8">
          <JourneyArt className="mx-auto h-[118px] w-auto shrink-0 md:order-last md:mx-0 md:h-[200px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <h2 className="text-[22px] leading-tight font-extrabold tracking-tight md:text-[30px]">{dict.app.howTitle}</h2>
            <ol className="m-0 grid list-none gap-2 p-0 md:gap-3">
              {steps.map(({ Icon, text }, i) => (
                <li key={text} className="hs-step flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[rgba(255,255,255,0.12)] text-[var(--glow)] md:h-11 md:w-11">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 text-[14px] leading-snug font-bold md:text-[17px]">
                    <span aria-hidden="true" className="mr-1 text-[var(--glow)]">{i + 1}.</span>
                    {text}
                  </span>
                </li>
              ))}
            </ol>
            <button type="button" onClick={() => setHowOpen(true)} className="btn btn-glass mt-1 min-h-11 w-auto self-start px-5">
              {dict.app.howMore}
            </button>
          </div>
        </div>
      );
    }
    const liveOn = index === slides.indexOf("live");
    return (
      <div className="flex h-full flex-col">
        <h2 className="hs-rise flex items-center gap-2 text-[13px] font-extrabold text-[var(--glow)]">
          <span aria-hidden="true" className="lamp-dot shrink-0" />
          {dict.app.liveTitle}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-4 md:max-w-xl">
          <div className="hs-rise min-w-0">
            <div className="text-[44px] leading-none font-extrabold tracking-tight text-[var(--glow)] tabular-nums md:text-[60px]">
              <CountUp to={weekCount} run={liveOn} />
            </div>
            <p className="mt-1.5 text-[13.5px] leading-snug font-bold text-[#e6dccb] md:text-[15px]">{dict.app.liveWeek}</p>
          </div>
          <div className="hs-rise min-w-0">
            <div className="text-[44px] leading-none font-extrabold tracking-tight tabular-nums md:text-[60px]">
              <CountUp to={waiting} run={liveOn} />
            </div>
            <p className="mt-1.5 text-[13.5px] leading-snug font-bold text-[#e6dccb] md:text-[15px]">{dict.app.liveOpen}</p>
          </div>
        </div>
        <StreetArt lit={weekCount} className="-mx-5 -mb-[22px] mt-auto block h-auto max-h-[190px] w-[calc(100%+40px)] max-w-none md:-mt-28 md:h-[260px] md:max-h-none" />
      </div>
    );
  }

  return (
    <section aria-roledescription="carousel" aria-label={dict.app.slidesLabel} className="min-w-0">
      <div ref={trackRef} className="hs-track">
        {slides.map((id, i) => (
          <div
            key={id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${count}`}
            className={`hs-slide ${i === index ? "hs-active" : ""}`}
          >
            <div className={`hero-mesh ${id === "closed" ? "hs-warm" : ""} relative h-full min-h-[318px] overflow-hidden rounded-[28px] px-5 py-[22px] text-[#f6efe3]`}>
              {renderSlide(id)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex items-center justify-center">
        {slides.map((id, i) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              hold(IDLE_MS);
              goTo(i);
            }}
            aria-label={fmt(dict.app.slideGo, { n: i + 1 })}
            className="flex h-6 cursor-pointer items-center px-[3px]"
          >
            <span className="hs-dot" aria-current={i === index ? "true" : undefined} />
          </button>
        ))}
      </div>

      <HowItWorks dict={dict} open={howOpen} onOpenChange={setHowOpen} hideTrigger />
    </section>
  );
}
