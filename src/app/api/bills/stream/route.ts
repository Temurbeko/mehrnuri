import type { NextRequest } from "next/server";
import { billsChangedSince, listOpenBills } from "@/lib/bills/service";
import { errorResponse } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Serverless-compatible Server-Sent Events (SSE) endpoint.
 * Sends any recent bill updates (or current open bills) and closes cleanly with `retry: 8000`
 * so serverless platforms (Netlify / Vercel) never buffer or hit Lambda execution timeouts,
 * while the browser's native EventSource automatically polls every 8 seconds.
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    await enforceRateLimit(req, "stream");
  } catch (err) {
    return errorResponse(err);
  }

  const encoder = new TextEncoder();
  const since = new Date(Date.now() - 12_000);
  let changed: Awaited<ReturnType<typeof listOpenBills>> = [];
  try {
    changed = await billsChangedSince(since);
  } catch {
    /* ignore transient db errors */
  }

  const chunks: string[] = [
    `retry: 8000\n\n`,
    `event: ready\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`,
  ];
  if (changed.length > 0) {
    chunks.push(`event: bills\ndata: ${JSON.stringify(changed)}\n\n`);
  }

  const body = encoder.encode(chunks.join(""));

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
