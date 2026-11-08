import "server-only";
import { env } from "@/config/env";
import { collections } from "@/lib/db/mongo";
import { clientIp, HttpError } from "./http";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

interface RateLimitStore {
  hit(key: string, windowSec: number): Promise<{ count: number; resetAt: number }>;
}

class MemoryStore implements RateLimitStore {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, windowSec: number) {
    const now = Date.now();
    if (this.buckets.size > 50_000) {
      for (const [k, v] of this.buckets) if (v.resetAt < now) this.buckets.delete(k);
    }
    const b = this.buckets.get(key);
    if (!b || b.resetAt < now) {
      const fresh = { count: 1, resetAt: now + windowSec * 1000 };
      this.buckets.set(key, fresh);
      return fresh;
    }
    b.count++;
    return b;
  }
}

class MongoStore implements RateLimitStore {
  async hit(key: string, windowSec: number) {
    const windowMs = windowSec * 1000;
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
    const resetAt = windowStart + windowMs;
    const { rateLimits } = await collections();
    const doc = await rateLimits.findOneAndUpdate(
      { _id: `${key}:${windowStart}` },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(resetAt + 60_000) } },
      { upsert: true, returnDocument: "after" },
    );
    return { count: doc?.count ?? 1, resetAt };
  }
}

const memory = new MemoryStore();
const mongo = new MongoStore();

function store(): RateLimitStore {
  return env().RATE_LIMIT_STORE === "memory" ? memory : mongo;
}

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  let res: { count: number; resetAt: number };
  try {
    res = await store().hit(key, windowSec);
  } catch (err) {
    console.warn("[rate-limit] store failed, using memory fallback", err);
    res = await memory.hit(key, windowSec);
  }
  return { ok: res.count <= limit, remaining: Math.max(0, limit - res.count), resetAt: res.resetAt };
}

export const POLICIES = {
  billCreate: { limit: 3, windowSec: 60 * 60 },
  donorCreate: { limit: 5, windowSec: 60 * 60 },
  donorRestore: { limit: 10, windowSec: 15 * 60 },
  checkout: { limit: 20, windowSec: 10 * 60 },
  paymentConfirm: { limit: 30, windowSec: 60 },
  read: { limit: 120, windowSec: 60 },
  stream: { limit: 20, windowSec: 60 },
  adminLogin: { limit: 5, windowSec: 15 * 60 },
  admin: { limit: 120, windowSec: 60 },
} as const satisfies Record<string, { limit: number; windowSec: number }>;

export type PolicyName = keyof typeof POLICIES;

export async function enforceRateLimit(req: Request, policy: PolicyName, extraKey = ""): Promise<void> {
  const { limit, windowSec } = POLICIES[policy];
  const res = await rateLimit(`${policy}:${clientIp(req)}${extraKey ? `:${extraKey}` : ""}`, limit, windowSec);
  if (!res.ok) {
    throw new HttpError(429, "rate_limited", "Too many requests", { retryAfterSec: Math.ceil((res.resetAt - Date.now()) / 1000) });
  }
}
