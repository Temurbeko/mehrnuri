import { NextResponse, type NextRequest } from "next/server";
import { getBill, isPubliclyVisible, toPublicBill } from "@/lib/bills/service";
import { handler, HttpError } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await enforceRateLimit(req, "read");
  const { id } = await ctx.params;
  const bill = await getBill(id);
  if (!bill) throw new HttpError(404, "not_found");
  return NextResponse.json({
    ok: true,
    bill: toPublicBill(bill),
    reviewStatus: bill.reviewStatus,
    visible: isPubliclyVisible(bill),
  });
});
