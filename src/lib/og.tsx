import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";

/**
 * Shared pieces for the link-preview images (Telegram, WhatsApp, Facebook...):
 * the Manrope font in Latin + Cyrillic (WOFF, which the image renderer reads)
 * and the night card frame with a warm lit window, in the app's own look.
 */

export const OG_SIZE = { width: 1200, height: 630 };

const FONT_DIR = join(process.cwd(), "src", "assets", "fonts");
const SUBSETS = ["latin", "latin-ext", "cyrillic", "cyrillic-ext"];
/** One family name per subset, listed together in fontFamily so each glyph finds its file. */
const FAMILY = SUBSETS.map((s) => `Manrope-${s}`);
export const OG_FONT_FAMILY = FAMILY.join(", ");

let fontCache: Promise<Array<{ name: string; data: Buffer; weight: 600 | 800; style: "normal" }>> | null = null;

export function ogFonts() {
  fontCache ??= Promise.all(
    SUBSETS.flatMap((s) =>
      ([600, 800] as const).map(async (weight) => ({
        name: `Manrope-${s}`,
        data: await readFile(join(FONT_DIR, `manrope-${s}-${weight}.woff`)),
        weight,
        style: "normal" as const,
      })),
    ),
  );
  return fontCache;
}

let logoCache: Promise<string | null> | null = null;

export function ogLogo() {
  logoCache ??= readFile(join(process.cwd(), "public", "brand", "logo.jpg"))
    .then((b) => `data:image/jpeg;base64,${b.toString("base64")}`)
    .catch(() => null);
  return logoCache;
}

/** A big warm window with a family inside: the app's symbol, drawn with boxes. */
function Window() {
  const pane = {
    display: "flex",
    flex: 1,
    background: "linear-gradient(160deg, #ffe3a0 0%, #ffc94f 55%, #f6a623 100%)",
    borderRadius: 10,
  } as const;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 330,
        height: 330,
        padding: 18,
        borderRadius: 36,
        background: "#262b47",
        boxShadow: "0 0 120px 30px rgba(246,166,35,0.45)",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", flex: 1, gap: 12 }}>
        <div style={pane} />
        <div style={pane} />
      </div>
      <div style={{ display: "flex", flex: 1, gap: 12, marginTop: 12 }}>
        <div style={{ ...pane, alignItems: "flex-end", justifyContent: "center" }}>
          <Figure h={92} />
        </div>
        <div style={{ ...pane, alignItems: "flex-end", justifyContent: "center", gap: 6 }}>
          <Figure h={58} />
          <Figure h={84} />
        </div>
      </div>
      <div style={{ display: "flex", position: "absolute", left: -14, right: -14, bottom: -14, height: 16, borderRadius: 8, background: "#3a4170" }} />
    </div>
  );
}

function Figure({ h }: { h: number }) {
  const w = h * 0.5;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: 0.6 }}>
      <div style={{ width: w * 0.55, height: w * 0.55, borderRadius: 999, background: "#9a5410" }} />
      <div style={{ width: w, height: h - w * 0.55 - 4, marginTop: 4, borderRadius: `${w}px ${w}px 0 0`, background: "#9a5410" }} />
    </div>
  );
}

/** The whole preview card: brand row, the text block, the window on the right. */
export function OgCard({ logo, eyebrow, title, sub, foot }: { logo: string | null; eyebrow: string; title: string; sub?: string; foot: string }): ReactNode {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "64px 80px",
        fontFamily: OG_FONT_FAMILY,
        color: "#f6efe3",
        background: "radial-gradient(circle at 85% 60%, rgba(246,166,35,0.30), transparent 55%), #151826",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: 640, height: "100%", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {logo && <img src={logo} width={64} height={64} style={{ borderRadius: 18 }} alt="" />}
          <div style={{ fontSize: 40, fontWeight: 800 }}>MehrNuri</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 800, color: "#ffc94f" }}>
            <div style={{ width: 16, height: 16, borderRadius: 999, background: "#f6a623", boxShadow: "0 0 18px 6px rgba(246,166,35,0.6)" }} />
            {eyebrow}
          </div>
          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1 }}>{title}</div>
          {sub && <div style={{ fontSize: 30, fontWeight: 600, color: "#cfc6b8" }}>{sub}</div>}
        </div>
        <div style={{ fontSize: 26, fontWeight: 600, color: "#a99f90" }}>{foot}</div>
      </div>
      <Window />
    </div>
  );
}
