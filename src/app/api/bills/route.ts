import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/config/env";
import { REGIONS, UTILITY_TYPES } from "@/lib/domain";
import { createBill, listOpenBills } from "@/lib/bills/service";
import { sweepExpired } from "@/lib/payments/core";
import { signPayload } from "@/lib/security/crypto";
import { assertSameOrigin, clientIp, handler, HttpError, parseOr400, readJson } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { createBillSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const feedQuery = z.object({
  utilityType: z.enum(UTILITY_TYPES).optional(),
  region: z.enum(REGIONS).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** Public feed of approved, open bills. */
export const GET = handler(async (req: NextRequest) => {
  await enforceRateLimit(req, "read");
  const q = parseOr400(feedQuery, Object.fromEntries(req.nextUrl.searchParams));
  void sweepExpired();
  const bills = await listOpenBills(q);
  return NextResponse.json({ ok: true, bills });
});

/** Family submits a help request. */
export const POST = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  await enforceRateLimit(req, "billCreate");
  const input = await readJson(req, createBillSchema);
  if (input.website) throw new HttpError(400, "validation_error"); // honeypot
  const bill = await createBill(input, clientIp(req));
  const billId = bill._id.toHexString();
  const res = NextResponse.json({ ok: true, id: billId, code: bill.code }, { status: 201 });
  res.cookies.set("mn_owner", signPayload({ billId, iat: Date.now() }), {
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60, // 60 days
  });
  return res;
});
