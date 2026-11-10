/**
 * Client-side Receipt QR Decoder (0 KB image storage on server).
 *
 * Reads a receipt screenshot (Click, Payme, Uzum Bank, Paynet, or the
 * ofd.soliq.uz page itself) inside the browser's memory, extracts the QR
 * text/URL, and frees the image. The image never leaves the device.
 *
 * Two decoders:
 * 1. The browser's native `BarcodeDetector` when it exists (Chrome on Android
 *    and macOS) — fast.
 * 2. `jsQR` (pure JS, loaded only when needed) everywhere else. Without it,
 *    iPhone Safari, Firefox and desktop Chrome on Windows could never read a
 *    receipt, which is why uploads "had the screenshot but found nothing".
 */

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): BarcodeDetectorLike;
    };
  }
}

export type QrScanOutcome = { status: "found"; rawValue: string } | { status: "no_qr_found" };

/** Large screenshots are scaled down to this for jsQR: plenty for a receipt QR, and fast. */
const MAX_SIDE = 1600;

/**
 * Regions to try, as fractions of the image height. Phone receipt screenshots
 * are tall and the QR is small, usually in the lower half; cropping makes the
 * QR a bigger share of the pixels, which helps both decoders.
 */
const REGIONS: Array<[top: number, height: number]> = [
  [0, 1],
  [0.45, 0.55],
  [0.6, 0.4],
  [0, 0.55],
  [0.25, 0.5],
];

export async function decodeQrFromImageFile(file: File): Promise<QrScanOutcome> {
  if (typeof window === "undefined") return { status: "no_qr_found" };

  let bitmap: ImageBitmap | null = null;
  const canvas = document.createElement("canvas");
  try {
    bitmap = await createImageBitmap(file);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { status: "no_qr_found" };

    const native = makeNativeDetector();
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));

    for (const [top, height] of REGIONS) {
      const sy = Math.floor(bitmap.height * top);
      const sh = Math.floor(bitmap.height * height);
      if (sh < 40) continue;

      // Crops get upscaled a little so a small QR has enough pixels per module.
      const zoom = top === 0 && height === 1 ? scale : Math.min(1.5, MAX_SIDE / Math.max(bitmap.width, sh));
      canvas.width = Math.max(1, Math.round(bitmap.width * zoom));
      canvas.height = Math.max(1, Math.round(sh * zoom));
      ctx.imageSmoothingEnabled = zoom < 1; // smooth when shrinking, crisp when enlarging
      ctx.drawImage(bitmap, 0, sy, bitmap.width, sh, 0, 0, canvas.width, canvas.height);

      const hit = (await detectNative(native, canvas)) ?? (await detectJsQr(ctx, canvas.width, canvas.height));
      if (hit) return { status: "found", rawValue: hit };
    }
    return { status: "no_qr_found" };
  } catch {
    return { status: "no_qr_found" };
  } finally {
    bitmap?.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}

function makeNativeDetector(): BarcodeDetectorLike | null {
  try {
    return window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
  } catch {
    return null; // exists but QR format unsupported on this device
  }
}

async function detectNative(detector: BarcodeDetectorLike | null, canvas: HTMLCanvasElement): Promise<string | null> {
  if (!detector) return null;
  try {
    const hits = await detector.detect(canvas);
    const raw = hits.find((h) => h.rawValue && h.rawValue.trim().length > 0)?.rawValue;
    return raw ? raw.trim() : null;
  } catch {
    return null;
  }
}

async function detectJsQr(ctx: CanvasRenderingContext2D, width: number, height: number): Promise<string | null> {
  const { default: jsQR } = await import("jsqr");
  const { data } = ctx.getImageData(0, 0, width, height);
  // Dark-mode receipt pages put a light QR on a dark background: try both.
  const hit = jsQR(data, width, height, { inversionAttempts: "attemptBoth" });
  const raw = hit?.data?.trim();
  return raw ? raw : null;
}
