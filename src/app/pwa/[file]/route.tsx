import { ImageResponse } from "next/og";

/** Home-screen icons: the app's lit window (see og.tsx) on the night colour. */
const FILES: Record<string, { size: number; maskable: boolean }> = {
  "180.png": { size: 180, maskable: false },
  "192.png": { size: 192, maskable: false },
  "512.png": { size: 512, maskable: false },
  "512-maskable.png": { size: 512, maskable: true },
};

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const spec = FILES[(await params).file];
  if (!spec) return new Response("Not found", { status: 404 });
  const { size, maskable } = spec;
  // Maskable icons keep the mark inside the central 80% safe zone; others use more of the canvas.
  const win = Math.round(size * (maskable ? 0.5 : 0.62));
  const pad = Math.round(win * 0.06);
  const gap = Math.round(win * 0.04);
  const pane = {
    display: "flex",
    flex: 1,
    background: "linear-gradient(160deg, #ffe3a0 0%, #ffc94f 55%, #f6a623 100%)",
    borderRadius: Math.round(win * 0.04),
  } as const;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#151826" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: win,
            height: win,
            padding: pad,
            gap,
            borderRadius: Math.round(win * 0.11),
            background: "#262b47",
            boxShadow: `0 0 ${Math.round(win * 0.3)}px ${Math.round(win * 0.06)}px rgba(246,166,35,0.45)`,
          }}
        >
          <div style={{ display: "flex", flex: 1, gap }}>
            <div style={pane} />
            <div style={pane} />
          </div>
          <div style={{ display: "flex", flex: 1, gap }}>
            <div style={pane} />
            <div style={pane} />
          </div>
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "cache-control": "public, max-age=86400" } },
  );
}
