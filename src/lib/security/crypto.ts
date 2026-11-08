import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/config/env";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

export function hmac(input: string): string {
  return createHmac("sha256", env().APP_SECRET).update(input).digest("base64url");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // still burn comparable time
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** Signs a JSON payload: base64url(json).signature */
export function signPayload(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body)}`;
}

export function verifyPayload<T>(token: string | undefined | null): T | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, hmac(body))) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

/** Hash an IP with the app secret so we can correlate abuse without storing raw IPs. */
export function hashIp(ip: string): string {
  return hmac(`ip:${ip}`).slice(0, 24);
}

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I confusion

export function shortCode(prefix = "MN", length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[(bytes[i] ?? 0) % CODE_ALPHABET.length];
  return `${prefix}-${out}`;
}
