import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { UTILITY_TYPES } from "@/lib/domain";
import { accountStatus } from "@/lib/bills/service";
import { handler, parseOr400 } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { accountNumberSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const query = z.object({
  utilityType: z.enum(UTILITY_TYPES),
  accountNumber: accountNumberSchema,
});

/** Does this account already have an open request (or is it blocked)? Asked by the request form at the account step. */
export const GET = handler(async (req: NextRequest) => {
  await enforceRateLimit(req, "read");
  const q = parseOr400(query, Object.fromEntries(req.nextUrl.searchParams));
  const status = await accountStatus(q.utilityType, q.accountNumber);
  return NextResponse.json({ ok: true, ...status });
});
