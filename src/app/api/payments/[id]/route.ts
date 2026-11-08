import { NextResponse, type NextRequest } from "next/server";
import { getPayment } from "@/lib/payments/core";
import { handler, HttpError } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await enforceRateLimit(req, "read");
  const { id } = await ctx.params;
  const p = await getPayment(id);
  if (!p) throw new HttpError(404, "not_found");
  return NextResponse.json({
    ok: true,
    payment: { id: p._id.toHexString(), status: p.status, amount: p.amount, billId: p.billId.toHexString() },
  });
});
