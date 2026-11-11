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
      </defs>
      {/* the route the money takes */}
      <path d="M40 60 C 58 22, 84 26, 92 86" fill="none" stroke="rgba(246,239,227,.28)" strokeWidth="1.2" strokeDasharray="2 3.2" strokeLinecap="round" />

      {/* phone */}
      <rect x="6" y="52" width="40" height="74" rx="8" fill="#262b47" stroke="#3a4170" strokeWidth="1.2" />
      <rect x="10.5" y="60" width="31" height="54" rx="3.5" fill="#12152a" />
      <rect x="22" y="55" width="8" height="1.6" rx=".8" fill="#3a4170" />
      <rect x="15" y="66" width="14" height="2.4" rx="1.2" fill="#3a4170" />
      <rect x="15" y="72" width="22" height="4.5" rx="1.5" fill="#f6efe3" opacity=".85" />
      <rect x="15" y="80" width="18" height="2.4" rx="1.2" fill="#3a4170" />
      <rect className="ja-pay" x="15" y="99" width="22" height="8.5" rx="4.2" fill="#f6a623" />
      <rect x="19" y="102.3" width="14" height="1.9" rx=".9" fill="#3b2508" opacity=".55" />

      {/* home */}
      <path d="M70 80 L93 60 L116 80 Z" fill="#323860" />
      <rect x="74" y="80" width="38" height="44" rx="1.5" fill="#262b47" />
      <rect x="79" y="88" width="15" height="13" rx="1.5" fill="#12152a" />
      <g className="ja-win">
        <rect x="76.5" y="85.5" width="20" height="18" rx="3" fill="#ffad2a" filter="url(#ja-glow)" opacity=".6" />
        <rect x="79" y="88" width="15" height="13" rx="1.5" fill="#ffd77e" />
        <Person x={84.5} y={101} s={0.62} />
        <Person x={89.5} y={101} s={0.42} />
      </g>
      <rect x="99" y="102" width="8" height="22" rx="1" fill="#12152a" />
      <rect x="66" y="124" width="54" height="2" fill="#363d68" />

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
