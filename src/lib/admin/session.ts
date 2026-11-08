import "server-only";
import { cookies } from "next/headers";
import { env } from "@/config/env";
import { safeEqual, sha256, signPayload, verifyPayload } from "@/lib/security/crypto";
import { HttpError } from "@/lib/security/http";

const ADMIN_COOKIE = "mn_admin";
const SESSION_HOURS = 12;

interface AdminSession {
  role: "admin";
  exp: number;
}

export function checkAdminPassword(password: string): boolean {
  // compare hashes so lengths are equal (constant time)
  return safeEqual(sha256(password), sha256(env().ADMIN_PASSWORD));
}

export async function startAdminSession(): Promise<void> {
  const jar = await cookies();
  const exp = Date.now() + SESSION_HOURS * 3600_000;
  jar.set(ADMIN_COOKIE, signPayload({ role: "admin", exp } satisfies AdminSession), {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const s = verifyPayload<AdminSession>((await cookies()).get(ADMIN_COOKIE)?.value);
  return !!s && s.role === "admin" && s.exp > Date.now();
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new HttpError(401, "unauthorized");
}
