/**
 * Client-side Receipt QR Decoder (0 KB image storage on server).
 *
 * Reads a receipt screenshot (Click, Payme, Uzum Bank, Paynet) inside the browser's
 * memory via an offscreen Canvas, scans multiple crops (full image + bottom half where
 * Uzbekistan apps place the Soliq Fiscal QR code), extracts the QR text/URL, and
 * immediately frees the image memory.
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

export type QrScanOutcome =
  | { status: "found"; rawValue: string }
  | { status: "no_qr_found" }
  | { status: "unsupported_browser" };

export async function decodeQrFromImageFile(file: File): Promise<QrScanOutcome> {
  if (typeof window === "undefined" || !window.BarcodeDetector) {
    return { status: "unsupported_browser" };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    bitmap = await createImageBitmap(file);

    // 1. Try full image first
    const fullHits = await detector.detect(bitmap);
    const firstFull = fullHits.find((h) => h.rawValue && h.rawValue.trim().length > 0);
    if (firstFull?.rawValue) {
      return { status: "found", rawValue: firstFull.rawValue.trim() };
    }

    // 2. Tall phone receipt screenshots often have a small QR code in the bottom 50% or 35%.
    // Crop and upscale those regions on an offscreen canvas so BarcodeDetector catches small QRs.
    const regions = [
      { sy: Math.floor(bitmap.height * 0.45), sh: Math.floor(bitmap.height * 0.55) },
      { sy: Math.floor(bitmap.height * 0.6), sh: Math.floor(bitmap.height * 0.4) },
      { sy: 0, sh: Math.floor(bitmap.height * 0.55) },
    ];

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      for (const reg of regions) {
        if (reg.sh < 40) continue;
        canvas.width = bitmap.width * 1.5;
        canvas.height = reg.sh * 1.5;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bitmap, 0, reg.sy, bitmap.width, reg.sh, 0, 0, canvas.width, canvas.height);
        const hits = await detector.detect(canvas);
        const hit = hits.find((h) => h.rawValue && h.rawValue.trim().length > 0);
        if (hit?.rawValue) {
          canvas.width = 0;
          canvas.height = 0;
          return { status: "found", rawValue: hit.rawValue.trim() };
        }
      }
      canvas.width = 0;
      canvas.height = 0;
    }

    return { status: "no_qr_found" };
  } catch {
    return { status: "no_qr_found" };
  } finally {
    bitmap?.close();
  }
}
