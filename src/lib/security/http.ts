import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
  }
}

export function clientIp(req: NextRequest | Request): string {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return h.get("x-real-ip")?.trim() || h.get("cf-connecting-ip")?.trim() || "unknown";
}

const DEFAULT_MAX_BODY = 16 * 1024;

/** Reads & validates a JSON body with a hard size cap. */
export async function readJson<S extends z.ZodType>(req: Request, schema: S, maxBytes = DEFAULT_MAX_BODY): Promise<z.infer<S>> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) throw new HttpError(413, "payload_too_large");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "payload_too_large");
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  return parseOr400(schema, data);
}

export function parseOr400<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "validation_error",
      "Invalid input",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return parsed.data;
}

/** Same-origin guard for state-changing browser requests (CSRF defense in depth on top of SameSite cookies). */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients; cookies are SameSite=Lax anyway
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new HttpError(403, "bad_origin");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, "bad_origin");
  }
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ ok: false, error: err.code, message: err.message, details: err.details }, { status: err.status });
  }
  console.error("[api] unexpected error", err);
  return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
}

/** Wraps a route handler with uniform error handling. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
