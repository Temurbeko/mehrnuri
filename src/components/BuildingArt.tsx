"use client";

import { useEffect, useState } from "react";

/**
 * The home-page building at night. Every lit window is a home that got help;
 * about every 1.5s one window fades on or off (more on than off), so the
 * building feels alive. Pure SVG + CSS opacity — no video, no images.
 * Still for people who prefer reduced motion.
 */

const WARM = ["#ffc94f", "#ffd77e", "#ffbf3a", "#ffe3a0"];
const COLS = [36, 60, 84];
const FLOORS = [44, 64, 84, 104, 124];
// 5 floors x 3 windows + 2 small ground-floor windows
const WINDOWS: Array<{ x: number; y: number; w: number; h: number; ledge: boolean }> = [
  ...FLOORS.flatMap((y) => COLS.map((x) => ({ x, y, w: 16, h: 14, ledge: true }))),
  { x: 38, y: 145, w: 11, h: 9, ledge: false },
  { x: 87, y: 145, w: 11, h: 9, ledge: false },
];
const START_LIT = [0, 2, 4, 6, 7, 9, 11, 12, 14, 15];

export function BuildingArt({ className }: { className?: string }) {
  const [lit, setLit] = useState<boolean[]>(() => WINDOWS.map((_, i) => START_LIT.includes(i)));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setLit((prev) => {
        const on = prev.filter(Boolean).length;
        const turnOn = on < 7 || (on < prev.length - 3 && Math.random() < 0.62);
        const pool = prev.map((v, i) => (v === !turnOn ? i : -1)).filter((i) => i >= 0);
        if (pool.length === 0) return prev;
        const pick = pool[Math.floor(Math.random() * pool.length)]!;
        const next = [...prev];
        next[pick] = turnOn;
        return next;
      });
    }, 1500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <svg viewBox="0 0 120 160" className={className} aria-hidden="true">
      <defs>
        <filter id="bw-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      {/* sky */}
      <circle cx="14" cy="10" r="1" fill="#f6efe3" opacity=".7" />
      <circle cx="26" cy="22" r=".8" fill="#f6efe3" opacity=".5" />
      <circle cx="8" cy="34" r=".7" fill="#f6efe3" opacity=".45" />
      <circle cx="108" cy="12" r="7" fill="#ffe7b0" opacity=".95" />
      <circle cx="111.5" cy="9.5" r="6.2" fill="#151826" />
      {/* building behind, for depth */}
      <rect x="2" y="70" width="30" height="88" rx="3" fill="#1d2138" />
      <rect x="8" y="80" width="7" height="9" rx="1" fill="#e9b04a" opacity=".55" />
      <rect x="19" y="98" width="7" height="9" rx="1" fill="#e9b04a" opacity=".35" />
      <rect x="8" y="116" width="7" height="9" rx="1" fill="#12152a" />
      {/* roof: antenna + water tank */}
      <rect x="44" y="14" width="1.5" height="18" fill="#3a4170" />
      <rect x="40" y="16" width="9.5" height="1.5" fill="#3a4170" />
      <rect x="80" y="22" width="14" height="10" rx="2" fill="#2c3254" />
      <rect x="78" y="31" width="18" height="2" fill="#3a4170" />
      {/* main block */}
      <rect x="28" y="34" width="80" height="124" rx="3" fill="#262b47" />
      <rect x="25" y="31" width="86" height="5" rx="2" fill="#323860" />
      {WINDOWS.map((w, i) => (
        <g key={i}>
          <g className={`bw${lit[i] ? " on" : ""}`}>
            <rect x={w.x} y={w.y} width={w.w} height={w.h} rx="1.5" fill="#12152a" />
            <rect className="halo" x={w.x - 2.5} y={w.y - 2.5} width={w.w + 5} height={w.h + 5} rx="3" fill="#ffad2a" filter="url(#bw-glow)" />
            <rect className="pane" x={w.x} y={w.y} width={w.w} height={w.h} rx="1.5" fill={WARM[i % WARM.length]} />
            <rect x={w.x + w.w / 2 - 0.5} y={w.y} width="1" height={w.h} fill="#20253f" opacity=".85" />
            <rect x={w.x} y={w.y + w.h * 0.38} width={w.w} height="1" fill="#20253f" opacity=".85" />
          </g>
          {w.ledge && <rect x={w.x - 2} y={w.y + w.h} width={w.w + 4} height="2" rx="1" fill="#353b62" />}
        </g>
      ))}
      {/* entrance with awning */}
      <rect x="58" y="141" width="20" height="2.5" rx="1" fill="#3a4170" />
      <rect x="61" y="144" width="14" height="14" rx="1.5" fill="#12152a" />
      <rect x="67.5" y="144" width="1" height="14" fill="#262b47" />
      <rect x="28" y="156" width="80" height="2" fill="#323860" />
    </svg>
  );
}
