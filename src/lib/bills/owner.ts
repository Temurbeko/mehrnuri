import "server-only";
import { signPayload, verifyPayload } from "@/lib/security/crypto";

/**
 * Which requests this browser posted, kept in a signed httpOnly cookie.
 *
 * It used to hold one `billId`, overwritten by every new request, so a family
 * could never get back to their earlier requests and nothing listed them. It
 * now keeps the latest few ids; old single-id cookies are still read.
 */
export const OWNER_COOKIE = "mn_owner";
const MAX_OWNED = 10;
const ID = /^[a-f0-9]{24}$/;

export function ownedBillIds(raw: string | undefined | null): string[] {
  const payload = verifyPayload<{ billId?: unknown; billIds?: unknown }>(raw);
  if (!payload) return [];
  const ids: unknown[] = Array.isArray(payload.billIds) ? payload.billIds : [payload.billId];
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && ID.test(id)))].slice(0, MAX_OWNED);
}

export function isBillOwner(raw: string | undefined | null, billId: string): boolean {
  return ownedBillIds(raw).includes(billId);
}

/** Cookie value after posting `newId`: newest first, capped. */
export function ownerCookieWith(raw: string | undefined | null, newId: string): string {
  const billIds = [newId, ...ownedBillIds(raw).filter((id) => id !== newId)].slice(0, MAX_OWNED);
  return signPayload({ billIds, iat: Date.now() });
}
