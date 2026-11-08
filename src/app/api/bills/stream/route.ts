import type { NextRequest } from "next/server";
import { billsChangedSince } from "@/lib/bills/service";
import { errorResponse } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MS = 3000;
const MAX_LIFETIME_MS = 5 * 60_000; // client EventSource auto-reconnects

/**
 * Server-Sent Events: pushes public bill changes (paid amounts / status) in real time.
 * Implemented as DB polling so it works across multiple instances without a
 * replica set. Swap for MongoDB change streams / Redis pub-sub when scaling.
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    await enforceRateLimit(req, "stream");
  } catch (err) {
    return errorResponse(err);
  }

  const encoder = new TextEncoder();
  let since = new Date(Date.now() - 2000);
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      controller.enqueue(encoder.encode(`retry: 3000\n\n`));
      send("ready", { at: Date.now() });
      const started = Date.now();

      timer = setInterval(async () => {
        if (closed) return;
        if (Date.now() - started > MAX_LIFETIME_MS) return close();
        try {
          const changed = await billsChangedSince(since);
          if (changed.length > 0) {
            const last = changed[changed.length - 1];
            if (last) since = new Date(last.updatedAt);
            send("bills", changed);
          } else {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          }
        } catch (err) {
          console.warn("[sse] poll failed", err);
        }
      }, POLL_MS);

      req.signal.addEventListener("abort", close);
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
