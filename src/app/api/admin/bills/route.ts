import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/admin/session";
import { adminQueues, approveBill, markPaidOut, rejectBill } from "@/lib/admin/service";
import { assertSameOrigin, handler, parseOr400, readJson } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { adminBillActionSchema, objectIdSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  await enforceRateLimit(req, "admin");
  await requireAdmin();
  return NextResponse.json({ ok: true, ...(await adminQueues()) });
});

/** POST /api/admin/bills?id=<billId>  body: { action: "approve" | "reject" | "payout", ... } */
export const POST = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  await enforceRateLimit(req, "admin");
  await requireAdmin();
  const id = new ObjectId(parseOr400(objectIdSchema, req.nextUrl.searchParams.get("id")));
  const action = await readJson(req, adminBillActionSchema);
  if (action.action === "approve") await approveBill(id);
  else if (action.action === "reject") await rejectBill(id, action.reason, action.blockAccount ?? false);
  else await markPaidOut(id, action.reference);
  return NextResponse.json({ ok: true });
});
