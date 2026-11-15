import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { collections } from "@/lib/db/mongo";
import { toPublicBill } from "@/lib/bills/service";
import { isBillOwner, OWNER_COOKIE } from "@/lib/bills/owner";
import { settleFamilyRemaining } from "@/lib/bills/familyRemaining";
import { remainingSchema } from "@/lib/validation";
import { assertSameOrigin, handler, HttpError, readJson } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

/**
 * "Qarzim kamaydi": the owner says the debt is now lower than shown.
 * Lowering only. The drop first confirms money donors paid without a receipt
 * (unconfirmed -> paid); the rest is `familyPaid` (paid outside the app), never
 * a donation (no leaderboard, no trust effect).
 */
export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  await enforceRateLimit(req, "checkout");
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id) || id.length !== 24) throw new HttpError(404, "bill_not_found");

  if (!isBillOwner(req.cookies.get(OWNER_COOKIE)?.value, id)) {
    throw new HttpError(403, "forbidden");
  }

  const { remaining } = await readJson(req, remainingSchema);
  const { bills } = await collections();

  const bill = await bills.findOne({ _id: new ObjectId(id) });
  if (!bill) throw new HttpError(404, "bill_not_found");

  const updated = await settleFamilyRemaining(bill, remaining);
  return NextResponse.json({ ok: true, bill: toPublicBill(updated) });
});
