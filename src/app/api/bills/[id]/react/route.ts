import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { REACTION_TYPES } from "@/lib/domain";
import { collections } from "@/lib/db/mongo";
import { toPublicBill } from "@/lib/bills/service";
import { verifyPayload } from "@/lib/security/crypto";
import { assertSameOrigin, handler, HttpError, readJson } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

const reactSchema = z.object({
  reaction: z.enum(REACTION_TYPES),
});

export function canReactToBill(reqCookies: { get(name: string): { value: string } | undefined }, billId: string): boolean {
  const ownerSession = verifyPayload<{ billId?: string }>(reqCookies.get("mn_owner")?.value);
  if (ownerSession?.billId === billId) return true;
  const adminSession = verifyPayload<{ role?: string; exp?: number }>(reqCookies.get("mn_admin")?.value);
  if (adminSession?.role === "admin" && (adminSession.exp ?? 0) > Date.now()) return true;
  return false;
}

/**
 * Safe 1-Click Family / Requester Reaction (Zero-Chat):
 * Only the requester who created the bill (verified via 256-bit HMAC `mn_owner` httpOnly cookie)
 * or an authenticated Admin can attach a preset thank-you reaction (`duo` | `rahmat` | `nur`).
 * Does NOT inflate Leaderboard points, preventing Sybil self-farming.
 */
export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  await enforceRateLimit(req, "checkout");
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id) || id.length !== 24) throw new HttpError(404, "bill_not_found");

  if (!canReactToBill(req.cookies, id)) {
    throw new HttpError(403, "forbidden");
  }

  const { reaction } = await readJson(req, reactSchema);
  const { bills } = await collections();

  const updated = await bills.findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $addToSet: { thanksReactions: reaction },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" },
  );

  if (!updated) throw new HttpError(404, "bill_not_found");

  return NextResponse.json({
    ok: true,
    bill: toPublicBill(updated),
  });
});
