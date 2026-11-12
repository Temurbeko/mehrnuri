/**
 * Illustrations for the home slider, drawn in the same night-building style as
 * BuildingArt. Pure SVG; every animation is CSS (opacity/transform/offset only,
 * see motion.css) and runs only while its slide is the visible one (`.hs-active`),
 * so slides out of view cost nothing. Without animation (reduced motion, or a
 * slide not in view) each picture shows its finished, static state.
 */

const INK = "#9a5410";

function Person({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g fill={INK}>
      <circle cx={x} cy={y - 8.6 * s} r={1.75 * s} />
      <path d={`M${x - 2.6 * s} ${y} v${-3.6 * s} a${2.6 * s} ${2.6 * s} 0 0 1 ${5.2 * s} 0 v${3.6 * s} z`} />
    </g>
  );
}

const HEART = "M0 1.6c0-1.9 2.4-2.6 3.3-.8C4.2-1 6.6-.3 6.6 1.6c0 2.1-3.3 4-3.3 4S0 3.7 0 1.6z";

/** "How it works": the request arrives, a payment travels from the phone, the home lights up. */
export function JourneyArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 30 122 100" className={className} aria-hidden="true">
      <defs>
        <filter id="ja-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <linearGradient id="ja-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2040" />
          <stop offset="1" stopColor="#12152a" />
        </linearGradient>
      </defs>
      {/* the route the money takes */}
      <path d="M40 60 C 58 22, 84 26, 92 86" fill="none" stroke="rgba(246,239,227,.3)" strokeWidth="1.2" strokeDasharray="2 3.2" strokeLinecap="round" />

      {/* phone: a payment app with the utility, the account and the amount */}
      <rect x="5" y="50" width="42" height="78" rx="8.5" fill="#2c3254" stroke="#454d80" strokeWidth="1.2" />
      <rect x="8.5" y="56" width="35" height="66" rx="5" fill="url(#ja-screen)" />
      <rect x="21" y="52.6" width="10" height="1.8" rx=".9" fill="#151826" />
      {/* app bar */}
      <rect x="8.5" y="56" width="35" height="9" rx="5" fill="#2b6fd6" />
      <rect x="8.5" y="61" width="35" height="4" fill="#2b6fd6" />
      <rect x="12" y="59.4" width="11" height="2" rx="1" fill="#cfe0ff" />
      {/* utility row */}
      <rect x="12" y="69" width="8" height="8" rx="2.4" fill="#ffd77e" />
      <path d="M16.6 70.4 l-2.4 3.6 h2 l-.8 2.6 2.6 -3.7 h-2 z" fill="#c26a00" />
      <rect x="22.5" y="70" width="16" height="2.2" rx="1.1" fill="#e9e3d6" />
      <rect x="22.5" y="74.2" width="11" height="1.8" rx=".9" fill="#5b6390" />
      {/* account field */}
      <rect x="12" y="80.5" width="28" height="7" rx="2" fill="#262b47" />
      <g fill="#8d96c2">
        <circle cx="15.5" cy="84" r=".9" /><circle cx="18.5" cy="84" r=".9" /><circle cx="21.5" cy="84" r=".9" />
        <circle cx="24.5" cy="84" r=".9" /><circle cx="27.5" cy="84" r=".9" /><circle cx="30.5" cy="84" r=".9" />
      </g>
      {/* amount */}
      <text x="26" y="98.5" textAnchor="middle" fontSize="8.4" fontWeight="800" fill="#f6efe3" fontFamily="system-ui, sans-serif">50 000</text>
      <rect x="20" y="101" width="12" height="1.6" rx=".8" fill="#5b6390" />
      {/* pay button with a check */}
      <rect className="ja-pay" x="12" y="108" width="28" height="9" rx="4.5" fill="#f6a623" />
      <path d="M22.6 112.6 l2.2 2.1 4.2 -4.2" fill="none" stroke="#3b2508" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* home: two floors, chimney, door, a tree */}
      <rect x="104" y="58" width="5" height="10" fill="#2a2f52" />
      <path d="M67 78 L91 58 L115 78 Z" fill="#3a4170" />
      <path d="M67 78 L91 58 L93 59.6 L70.4 78 Z" fill="#4a5288" />
      <rect x="71" y="78" width="40" height="46" rx="1.5" fill="#2c3254" />
      {/* upstairs window stays dark; the downstairs one lights up */}
      <rect x="79" y="83" width="9" height="9" rx="1.2" fill="#151826" />
      <rect x="95" y="83" width="9" height="9" rx="1.2" fill="#151826" />
      <rect x="76" y="99" width="16" height="13" rx="1.5" fill="#151826" />
      <g className="ja-win">
        <rect x="73.5" y="96.5" width="21" height="18" rx="3" fill="#ffad2a" filter="url(#ja-glow)" opacity=".65" />
        <rect x="76" y="99" width="16" height="13" rx="1.5" fill="#ffd77e" />
        <rect x="83.4" y="99" width="1.2" height="13" fill="#e2a44a" />
        <Person x={80.5} y={112} s={0.62} />
        <Person x={88} y={112} s={0.44} />
        <rect x="95" y="83" width="9" height="9" rx="1.2" fill="#ffd77e" opacity=".85" />
      </g>
      <rect x="97" y="104" width="9" height="20" rx="1" fill="#151826" />
      <circle cx="104" cy="114.5" r=".8" fill="#f6a623" />
      {/* tree + ground */}
      <rect x="117.4" y="112" width="1.6" height="12" fill="#2a2f52" />
      <circle cx="118.2" cy="108" r="5" fill="#2e5a4a" />
      <rect x="62" y="124" width="60" height="2" fill="#3a4170" />

      {/* the request (a small paper) appearing at the home */}
      <g className="ja-doc">
        <rect x="98" y="36" width="15" height="19" rx="2" fill="#f6efe3" />
        <rect x="101" y="40.5" width="9" height="1.6" rx=".8" fill="#c9b9a0" />
        <rect x="101" y="44.5" width="7" height="1.6" rx=".8" fill="#c9b9a0" />
        <rect x="101" y="48.5" width="8" height="1.6" rx=".8" fill="#f6a623" />
      </g>

      {/* the payment travelling along the route */}
      <g className="ja-coin">
        <circle r="5.5" fill="#ffad2a" opacity=".45" filter="url(#ja-glow)" />
        <circle r="3.6" fill="#ffc94f" stroke="#df7f0e" strokeWidth=".8" />
      </g>

      {/* thanks */}
      <path className="ja-heart" d={HEART} fill="#ff8a5c" transform="translate(83 74)" />
    </svg>
  );
}

/** "Thank you" slide: a warm window with the family, hearts floating up. */
export function ThanksArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 150" className={className} aria-hidden="true">
      <defs>
        <filter id="ta-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <rect x="8" y="40" width="104" height="90" rx="10" fill="#ffad2a" opacity=".35" filter="url(#ta-glow)" />
      {/* wall + window */}
      <rect x="14" y="44" width="92" height="82" rx="7" fill="#262b47" />
      <rect x="20" y="50" width="80" height="64" rx="4" fill="#ffd77e" />
      {/* curtains */}
      <path d="M20 50 h16 q-6 28 -3 64 h-13 z" fill="#f3a531" opacity=".7" />
      <path d="M100 50 h-16 q6 28 3 64 h13 z" fill="#f3a531" opacity=".7" />
      {/* the family */}
      <g opacity=".72">
        <Person x={50} y={114} s={1.7} />
        <Person x={70} y={114} s={1.6} />
        <Person x={60} y={114} s={1.05} />
      </g>
      {/* lamp on the right */}
      <path d="M83 66 h9 l2 5 h-13 z" fill={INK} opacity=".55" />
      <rect x="87.2" y="71" width="1.2" height="43" fill={INK} opacity=".55" />
      {/* sill */}
      <rect x="15" y="114" width="90" height="4" rx="2" fill="#3a4170" />
      <path d="M26 114 h7 l-1 -4 h-5 z" fill="#2e9a67" />
      <path d="M29.5 110 c-3 -1 -3.5 -5 -2.5 -7 c1.5 1.4 2.4 3.6 2.5 7 c.2 -3 1.2 -5.4 3 -7 c1 2.2 .2 5.6 -3 7 z" fill="#3fbf82" />
      {/* hearts drifting up from the window */}
      <path className="ta-heart" d={HEART} fill="#ff8a5c" transform="translate(52 40) scale(1.4)" />
      <path className="ta-heart ta-h2" d={HEART} fill="#ffc94f" transform="translate(70 42) scale(1.1)" />
      <path className="ta-heart ta-h3" d={HEART} fill="#ff8a5c" transform="translate(38 46) scale(.9)" />
    </svg>
  );
}

/** Taller buildings behind the street: [x, y] of their few lit windows. */
const BACK: Array<{ x: number; w: number; h: number; lit: Array<[number, number]> }> = [
  { x: 0, w: 34, h: 96, lit: [[8, 14], [20, 34]] },
  { x: 40, w: 28, h: 120, lit: [[6, 20], [16, 52], [6, 70]] },
  { x: 76, w: 40, h: 84, lit: [[10, 16]] },
  { x: 124, w: 30, h: 108, lit: [[8, 24], [17, 46]] },
  { x: 162, w: 44, h: 92, lit: [[12, 18], [26, 40]] },
  { x: 214, w: 30, h: 126, lit: [[8, 22], [17, 58], [8, 84]] },
  { x: 252, w: 36, h: 88, lit: [[10, 30]] },
  { x: 294, w: 26, h: 104, lit: [[8, 20], [8, 50]] },
];

/**
 * "In numbers" slide: a street of six homes. Homes helped this week light up
 * one after another; the others wait with a small pulsing lamp.
 */
export function StreetArt({ lit, className }: { lit: number; className?: string }) {
  const homes = [
    { x: 6, w: 40, h: 40 },
    { x: 56, w: 46, h: 54 },
    { x: 112, w: 38, h: 36 },
    { x: 160, w: 48, h: 48 },
    { x: 218, w: 40, h: 58 },
    { x: 268, w: 46, h: 42 },
  ];
  const n = Math.max(0, Math.min(lit, homes.length));
  // spread the lit homes along the street instead of bunching them at the start
  const order = [1, 4, 2, 5, 0, 3];
  const isLit = new Set(order.slice(0, n));
  return (
    <svg viewBox="0 0 320 150" className={className} preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
      <defs>
        <filter id="sa-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
      {/* night sky and the city behind the street */}
      <circle className="bw-star" cx="40" cy="14" r="1" fill="#f6efe3" />
      <circle className="bw-star" style={{ animationDelay: "1.1s" }} cx="150" cy="8" r=".8" fill="#f6efe3" />
      <circle className="bw-star" style={{ animationDelay: "2s" }} cx="210" cy="26" r=".9" fill="#f6efe3" />
      <circle className="bw-star" style={{ animationDelay: ".5s" }} cx="96" cy="30" r=".7" fill="#f6efe3" />
      <circle cx="288" cy="22" r="13" fill="#ffd27a" opacity=".1" />
      <circle cx="288" cy="22" r="8" fill="#ffe7b0" opacity=".95" />
      <circle cx="292.5" cy="19" r="7" fill="#151826" />
      {BACK.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={146 - b.h} width={b.w} height={b.h} rx="2" fill="#1b1f35" />
          {b.lit.map(([wx, wy], j) => (
            <rect key={j} x={b.x + wx} y={146 - b.h + wy} width="5" height="6" rx=".8" fill="#e9b04a" opacity=".45" />
          ))}
        </g>
      ))}
      <g transform="translate(0 74)">
      {homes.map((h, i) => {
        const top = 72 - h.h;
        const on = isLit.has(i);
        const wx = h.x + h.w / 2 - 7;
        const wy = top + 12;
        return (
          <g key={i}>
            <path d={`M${h.x - 3} ${top} L${h.x + h.w / 2} ${top - 12} L${h.x + h.w + 3} ${top} Z`} fill="#323860" />
            <rect x={h.x} y={top} width={h.w} height={h.h} rx="1.5" fill="#262b47" />
            <rect x={wx} y={wy} width="14" height="12" rx="1.5" fill="#12152a" />
            {on ? (
              <g className="sa-on" style={{ animationDelay: `${0.35 + order.indexOf(i) * 0.35}s` }}>
                <rect x={wx - 3} y={wy - 3} width="20" height="18" rx="3" fill="#ffad2a" opacity=".55" filter="url(#sa-glow)" />
                <rect x={wx} y={wy} width="14" height="12" rx="1.5" fill="#ffd77e" />
              </g>
            ) : (
              <circle className="sa-wait" cx={h.x + h.w / 2} cy={top - 18} r="2" fill="#f6a623" />
            )}
            <rect x={h.x + h.w / 2 - 3.5} y={72 - 13} width="7" height="13" rx="1" fill="#12152a" />
          </g>
        );
      })}
      <rect x="0" y="72" width="320" height="2.5" rx="1" fill="#363d68" />
      </g>
    </svg>
  );
}

/** Gas paid: the stove lights up, the pot steams, the family smiles. */
export function GasArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 150" className={className} aria-hidden="true">
      <defs>
        <filter id="ga-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id="ga-blue" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
      <rect x="8" y="40" width="104" height="90" rx="10" fill="#ffad2a" opacity=".3" filter="url(#ga-glow)" />
      <rect x="14" y="44" width="92" height="82" rx="7" fill="#262b47" />
      <rect x="20" y="50" width="80" height="70" rx="4" fill="#ffe2a0" />
      {/* tiles */}
      <g stroke="#f3c56b" strokeWidth=".8" opacity=".6">
        <path d="M20 66 h80 M20 82 h80" />
        <path d="M40 50 v32 M60 50 v32 M80 50 v32" />
      </g>
      {/* the family on the left */}
      <g opacity=".75">
        <Person x={30} y={104} s={1.55} />
        <Person x={40} y={104} s={1.05} />
      </g>
      {/* stove */}
      <rect x="50" y="98" width="46" height="22" rx="3" fill="#3a4170" />
      <circle cx="58" cy="110" r="2" fill="#ffc94f" />
      <circle cx="66" cy="110" r="2" fill="#ffc94f" />
      <rect x="48" y="95" width="50" height="4" rx="2" fill="#4a5288" />
      {/* blue flames */}
      <ellipse cx="73" cy="93" rx="13" ry="2.6" fill="#4fa3ff" opacity=".55" filter="url(#ga-blue)" />
      <g className="ga-flame" fill="#4fa3ff">
        <path d="M63 95 q2 -6 4 0 z" />
        <path d="M68 95 q2.2 -7.5 4.4 0 z" fill="#7cc0ff" />
        <path d="M73.6 95 q2 -6.5 4 0 z" />
        <path d="M78.6 95 q2 -6 4 0 z" fill="#7cc0ff" />
      </g>
      {/* pot with a smile */}
      <rect x="61" y="76" width="24" height="15" rx="3" fill="#e2683c" />
      <rect x="59" y="74" width="28" height="4" rx="2" fill="#f08a5d" />
      <rect x="57" y="80" width="4" height="2.4" rx="1.2" fill="#c4522a" />
      <rect x="85" y="80" width="4" height="2.4" rx="1.2" fill="#c4522a" />
      <circle cx="69" cy="82" r="1" fill="#5a1e0c" />
      <circle cx="77" cy="82" r="1" fill="#5a1e0c" />
      <path d="M69.5 85 q3.5 3 7 0" stroke="#5a1e0c" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      {/* steam */}
      <g stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".9">
        <path className="ga-steam" d="M67 71 c-3 -4 3 -6 0 -11" />
        <path className="ga-steam ga-s2" d="M73 70 c-3 -4 3 -6 0 -12" />
        <path className="ga-steam ga-s3" d="M79 71 c-3 -4 3 -6 0 -11" />
      </g>
      <rect x="15" y="120" width="90" height="4" rx="2" fill="#3a4170" />
      <path className="ta-heart" d={HEART} fill="#ff8a5c" transform="translate(32 40) scale(1.3)" />
      <path className="ta-heart ta-h2" d={HEART} fill="#ffc94f" transform="translate(86 38) scale(1.1)" />
      <path className="ta-heart ta-h3" d={HEART} fill="#ff8a5c" transform="translate(58 44) scale(.9)" />
    </svg>
  );
}

/** Water paid: the tap turns on, water flows into a glass, the family smiles. */
export function WaterArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 150" className={className} aria-hidden="true">
      <defs>
        <filter id="wa-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <clipPath id="wa-glass">
          <path d="M60 86 h22 l-2.4 30 h-17.2 z" />
        </clipPath>
      </defs>
      <rect x="8" y="40" width="104" height="90" rx="10" fill="#4fb4ff" opacity=".3" filter="url(#wa-glow)" />
      <rect x="14" y="44" width="92" height="82" rx="7" fill="#262b47" />
      <rect x="20" y="50" width="80" height="70" rx="4" fill="#d6efff" />
      {/* the family on the left */}
      <g fill="#2d6f9e" opacity=".7">
        <circle cx="32" cy="91" r="2.7" />
        <path d="M28 105 v-5.6 a4 4 0 0 1 8 0 v5.6 z" />
        <circle cx="42" cy="96.5" r="1.8" />
        <path d="M39.3 105 v-3.7 a2.7 2.7 0 0 1 5.4 0 v3.7 z" />
      </g>
      {/* tap */}
      <rect x="66" y="56" width="14" height="5" rx="2.5" fill="#8a97b8" />
      <rect x="71" y="52" width="4" height="6" rx="1" fill="#6b7898" />
      <path d="M70 61 h6 v8 h-2 q0 3 -2 3 h-2 z" fill="#9aa7c8" />
      <rect className="wa-handle" x="64" y="51" width="18" height="3.4" rx="1.7" fill="#4fa3ff" />
      {/* the stream */}
      <rect className="wa-stream" x="71" y="72" width="3.2" height="40" rx="1.6" fill="#4fa3ff" opacity=".85" />
      {/* glass filling up, with a smile */}
      <g clipPath="url(#wa-glass)">
        <rect className="wa-level" x="58" y="92" width="28" height="26" fill="#7cc4ff" />
      </g>
      <path d="M60 86 h22 l-2.4 30 h-17.2 z" fill="none" stroke="#2d6f9e" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="67" cy="103" r="1" fill="#1d4f75" />
      <circle cx="75" cy="103" r="1" fill="#1d4f75" />
      <path d="M67.5 106.5 q3.5 3 7 0" stroke="#1d4f75" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      {/* splashes */}
      <circle className="wa-drop" cx="64" cy="88" r="1.3" fill="#4fa3ff" />
      <circle className="wa-drop wa-d2" cx="81" cy="87" r="1.1" fill="#4fa3ff" />
      <rect x="15" y="116" width="90" height="4" rx="2" fill="#3a4170" />
      <path className="ta-heart" d={HEART} fill="#ff8a5c" transform="translate(30 42) scale(1.3)" />
      <path className="ta-heart ta-h2" d={HEART} fill="#4fa3ff" transform="translate(88 40) scale(1.1)" />
      <path className="ta-heart ta-h3" d={HEART} fill="#ff8a5c" transform="translate(48 46) scale(.9)" />
    </svg>
  );
}
