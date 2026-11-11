"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The home-page building at night. Every lit window is a home that got help,
 * and some show who lives there: a family, a mother and child, grandparents,
 * a cat on the sill. Windows switch on and off about once a second (more on
 * than off); when one lights up, a small heart rises from it.
 *
 * Cost: one inline SVG (server-rendered, so it is in the first paint) and one
 * timer that starts only after the page is idle, and pauses while the building
 * is scrolled away or the tab is hidden. Animations touch opacity/transform
 * only. With "reduce motion" on, windows still fade (no movement), hearts are off.
 */

const WARM = ["#ffc94f", "#ffd77e", "#ffbf3a", "#ffe3a0"];
const INK = "#9a5410"; // silhouettes: dark amber, read as people behind a warm curtain

type Scene = "family" | "mother" | "elders" | "cat" | "lamp" | "plant" | "curtain";

const COLS = [32, 58, 84];
const FLOORS = [40, 63, 86, 109];
const W = 20;
const H = 17;

// 4 floors x 3 windows; who is in each one
const SCENES: Scene[] = [
  "curtain", "cat", "lamp",
  "mother", "curtain", "plant",
  "lamp", "family", "curtain",
  "plant", "elders", "curtain",
];
const WINDOWS = FLOORS.flatMap((y, f) => COLS.map((x, c) => ({ x, y, scene: SCENES[f * 3 + c]! })));
/** The family window stays lit: it is the story of the app. */
const ANCHOR = SCENES.indexOf("family");
const START_LIT = [0, 2, 3, 5, 7, 8, 10];

function Person({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  // head + rounded shoulders, standing on the sill line y
  return (
    <g fill={INK}>
      <circle cx={x} cy={y - 8.6 * s} r={1.75 * s} />
      <path d={`M${x - 2.6 * s} ${y} v${-3.6 * s} a${2.6 * s} ${2.6 * s} 0 0 1 ${5.2 * s} 0 v${3.6 * s} z`} />
    </g>
  );
}

function SceneArt({ scene, x, y }: { scene: Scene; x: number; y: number }) {
  const sill = y + H;
  switch (scene) {
    case "family":
      return (
        <g opacity=".62">
          <Person x={x + 5} y={sill} />
          <Person x={x + 15} y={sill} s={0.95} />
          <Person x={x + 10} y={sill} s={0.62} />
        </g>
      );
    case "mother":
      return (
        <g opacity=".6">
          <Person x={x + 8} y={sill} />
          <Person x={x + 13.5} y={sill} s={0.6} />
        </g>
      );
    case "elders":
      return (
        <g opacity=".58">
          <Person x={x + 7} y={sill} s={0.92} />
          <Person x={x + 13} y={sill} s={0.88} />
          {/* walking stick */}
          <rect x={x + 16.2} y={sill - 6} width=".7" height="6" fill={INK} />
        </g>
      );
    case "cat":
      return (
        <g fill={INK} opacity=".7">
          <ellipse cx={x + 13} cy={sill - 1.7} rx="3.2" ry="1.9" />
          <circle cx={x + 10.2} cy={sill - 3.6} r="1.5" />
          <path d={`M${x + 9.1} ${sill - 4.6} l.3 -1.6 l.9 1.1 z M${x + 10.6} ${sill - 4.9} l.6 -1.5 l.6 1.3 z`} />
          <path d={`M${x + 16} ${sill - 1.4} q2 -.5 1.4 -3`} stroke={INK} strokeWidth=".7" fill="none" />
        </g>
      );
    case "lamp":
      return (
        <g opacity=".6">
          <path d={`M${x + 12.5} ${y + 4.5} h5 l1.3 3.3 h-7.6 z`} fill={INK} />
          <rect x={x + 14.6} y={y + 7.8} width=".8" height={H - 7.8} fill={INK} />
          <Person x={x + 6.5} y={sill} s={0.85} />
        </g>
      );
    case "plant":
      return (
        <g fill={INK} opacity=".6">
          <path d={`M${x + 4} ${sill} h4.4 l-.6 -2.6 h-3.2 z`} />
          <path d={`M${x + 6.2} ${sill - 2.6} c-2.6 -1 -3 -3.6 -2.2 -5 c1.2 1 2 2.6 2.2 5 c.2 -2.4 1 -4 2.4 -5.2 c.8 1.6 .2 4 -2.4 5.2 z`} />
          <Person x={x + 14} y={sill} s={0.8} />
        </g>
      );
    default:
      // tied-back curtains
      return (
        <g fill="#f3a531" opacity=".55">
          <path d={`M${x} ${y} h5 q-1.6 ${H * 0.45} -1 ${H} h-4 z`} />
          <path d={`M${x + W} ${y} h-5 q1.6 ${H * 0.45} 1 ${H} h4 z`} />
        </g>
      );
  }
}

export function BuildingArt({ className }: { className?: string }) {
  const [lit, setLit] = useState<boolean[]>(() => WINDOWS.map((_, i) => START_LIT.includes(i)));
  const [heart, setHeart] = useState<{ i: number; k: number } | null>(null);
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timer: number | undefined;
    let visible = true;
    let k = 0;

    const tick = () => {
      setLit((prev) => {
        const on = prev.filter(Boolean).length;
        const turnOn = on < 6 || (on < prev.length - 2 && Math.random() < 0.6);
        const pool = prev.map((v, i) => (v === !turnOn && i !== ANCHOR ? i : -1)).filter((i) => i >= 0);
        if (pool.length === 0) return prev;
        const pick = pool[Math.floor(Math.random() * pool.length)]!;
        const next = [...prev];
        next[pick] = turnOn;
        if (turnOn && !calm) setHeart({ i: pick, k: ++k });
        return next;
      });
    };
    const start = () => {
      if (timer === undefined && visible && !document.hidden) timer = window.setInterval(tick, 1100);
    };
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };

    // pause while scrolled away or in a background tab
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) start();
      else stop();
    });
    const onVis = () => (document.hidden ? stop() : start());

    // start after the page has settled, so it never competes with the first render
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => (io.observe(el), start()), { timeout: 1500 })
      : window.setTimeout(() => (io.observe(el), start()), 600);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const hw = heart ? WINDOWS[heart.i] : null;

  return (
    <svg ref={ref} viewBox="0 0 120 160" className={className} aria-hidden="true">
      <defs>
        <filter id="bw-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <linearGradient id="bw-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b3152" />
          <stop offset="1" stopColor="#222741" />
        </linearGradient>
      </defs>
      {/* sky */}
      <circle className="bw-star" cx="10" cy="10" r="1" fill="#f6efe3" />
      <circle className="bw-star" style={{ animationDelay: "1.3s" }} cx="24" cy="22" r=".8" fill="#f6efe3" />
      <circle className="bw-star" style={{ animationDelay: "2.1s" }} cx="6" cy="36" r=".7" fill="#f6efe3" />
      <circle className="bw-star" style={{ animationDelay: ".6s" }} cx="62" cy="8" r=".7" fill="#f6efe3" />
      <circle cx="104" cy="13" r="10" fill="#ffd27a" opacity=".12" />
      <circle cx="104" cy="13" r="6.5" fill="#ffe7b0" opacity=".95" />
      <circle cx="107.5" cy="10.5" r="5.8" fill="#151826" />
      {/* neighbour building, for depth */}
      <rect x="0" y="74" width="26" height="86" rx="3" fill="#1b1f35" />
      <rect x="5" y="84" width="6" height="8" rx="1" fill="#e9b04a" opacity=".5" />
      <rect x="15" y="100" width="6" height="8" rx="1" fill="#e9b04a" opacity=".32" />
      <rect x="5" y="116" width="6" height="8" rx="1" fill="#12152a" />
      {/* roof: antenna + water tank */}
      <rect x="40" y="12" width="1.4" height="18" fill="#3a4170" />
      <rect x="36.5" y="15" width="8.5" height="1.4" fill="#3a4170" />
      <rect x="80" y="20" width="14" height="10" rx="2" fill="#2c3254" />
      <rect x="78" y="29" width="18" height="2" fill="#3a4170" />
      {/* main block */}
      <rect x="24" y="32" width="88" height="126" rx="3" fill="url(#bw-wall)" />
      <rect x="21" y="29" width="94" height="5" rx="2" fill="#363d68" />
      {WINDOWS.map((w, i) => (
        <g key={i}>
          <g className={`bw${lit[i] || i === ANCHOR ? " on" : ""}`}>
            <rect x={w.x} y={w.y} width={W} height={H} rx="1.6" fill="#12152a" />
            <rect className="halo" x={w.x - 3} y={w.y - 3} width={W + 6} height={H + 6} rx="3.5" fill="#ffad2a" filter="url(#bw-glow)" />
            <g className="pane">
              <rect x={w.x} y={w.y} width={W} height={H} rx="1.6" fill={WARM[i % WARM.length]} />
              <SceneArt scene={w.scene} x={w.x} y={w.y} />
            </g>
            {/* frame bar only where it does not cut through someone */}
            {w.scene === "curtain" && <rect x={w.x + W / 2 - 0.5} y={w.y} width="1" height={H} fill="#20253f" opacity=".8" />}
          </g>
          <rect x={w.x - 2} y={w.y + H} width={W + 4} height="2" rx="1" fill="#3a4170" />
        </g>
      ))}
      {/* a heart rises from the window that just lit up */}
      {hw && (
        <path
          key={heart!.k}
          className="bw-heart"
          d="M0 1.6c0-1.9 2.4-2.6 3.3-.8C4.2-1 6.6-.3 6.6 1.6c0 2.1-3.3 4-3.3 4S0 3.7 0 1.6z"
          fill="#ff8a5c"
          transform={`translate(${hw.x + W / 2 - 3.3} ${hw.y - 2})`}
        />
      )}
      {/* entrance with awning and a warm doorway light */}
      <rect x="57" y="139" width="22" height="2.6" rx="1" fill="#3a4170" />
      <circle cx="68" cy="143" r="5" fill="#ffad2a" opacity=".25" filter="url(#bw-glow)" />
      <rect x="61" y="142.5" width="14" height="15.5" rx="1.6" fill="#ffcf6b" opacity=".9" />
      <rect x="67.5" y="142.5" width="1" height="15.5" fill="#c9861c" />
      <rect x="34" y="144" width="12" height="9" rx="1.2" fill="#12152a" />
      <rect x="90" y="144" width="12" height="9" rx="1.2" fill="#e9b04a" opacity=".7" />
      <rect x="24" y="156" width="88" height="2" fill="#363d68" />
    </svg>
  );
}
