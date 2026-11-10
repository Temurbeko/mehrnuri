import { NextResponse, type NextRequest } from "next/server";
import { getBill } from "@/lib/bills/service";
import { recordVerdict } from "@/lib/bills/verdicts";
import { currentDonor } from "@/lib/donors/session";
import { assertSameOrigin, clientIp, handler, HttpError, readJson } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { verdictSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * A donor says what their payment app showed for this account.
 *
 * This is the verification step that replaces manual approval: the donor is
 * already looking at the real debt in Click / Payme / Uzum / Paynet, so they
 * are the only party who can actually check the claim. Enough reports take the
 * request off the feed automatically; a confirmation marks it donor-checked.
 *
 * Open to any same-origin visitor (a donor nickname is not required to report
 * something wrong), one vote per visitor per bill, rate limited per IP.
 */
export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  await enforceRateLimit(req, "verdict");

  const { id } = await ctx.params;
  const bill = await getBill(id);
  if (!bill) throw new HttpError(404, "bill_not_found");
  if (bill.reviewStatus === "rejected") throw new HttpError(409, "bill_not_open");

  const { kind, seenAmount } = await readJson(req, verdictSchema);

  // Signed-in donors vote as themselves; everyone else by IP.
  const donor = await currentDonor();
  const voterKey = donor ? `donor:${donor._id.toHexString()}` : `ip:${clientIp(req)}`;

  const { bill: publicBill, hidden } = await recordVerdict({ bill, kind, seenAmount, voterKey });
  return NextResponse.json({ ok: true, bill: publicBill, hidden });
});
