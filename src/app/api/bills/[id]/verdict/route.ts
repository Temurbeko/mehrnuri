import { NextResponse, type NextRequest } from "next/server";
import { getBill } from "@/lib/bills/service";
import { assertCanVote, recordVerdict } from "@/lib/bills/verdicts";
import { currentDonor } from "@/lib/donors/session";
import { hashIp, verifyPayload } from "@/lib/security/crypto";
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
 * Because a vote can hide a family's request, only a donor who opened a payment
 * on this bill may vote, once per network, and never the family itself
 * (see `assertCanVote`).
 */
export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  await enforceRateLimit(req, "verdict");

  const { id } = await ctx.params;
  const bill = await getBill(id);
  if (!bill) throw new HttpError(404, "bill_not_found");
  if (bill.reviewStatus === "rejected") throw new HttpError(409, "bill_not_open");

  const { kind, seenAmount } = await readJson(req, verdictSchema);

  const donor = await currentDonor();
  const ipHash = hashIp(clientIp(req));
  const owner = verifyPayload<{ billId?: string }>(req.cookies.get("mn_owner")?.value);
  await assertCanVote({
    bill,
    donorId: donor?._id ?? null,
    ipHash,
    isOwner: owner?.billId === id,
  });

  const { bill: publicBill, hidden } = await recordVerdict({
    bill,
    kind,
    seenAmount,
    voterKey: `donor:${donor!._id.toHexString()}`,
    ipHash,
  });
  return NextResponse.json({ ok: true, bill: publicBill, hidden });
});
