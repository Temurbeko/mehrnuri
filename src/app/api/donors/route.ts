import { NextResponse, type NextRequest } from "next/server";
import { clearDonorCookie, createDonor, currentDonor } from "@/lib/donors/session";
import { assertSameOrigin, handler } from "@/lib/security/http";
import { readJson } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { createDonorSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Current donor (by cookie). */
export const GET = handler(async (req: NextRequest) => {
  await enforceRateLimit(req, "read");
  const d = await currentDonor();
  return NextResponse.json({
    ok: true,
    donor: d ? { nickname: d.nickname, totalDonated: d.totalDonated, donationsCount: d.donationsCount } : null,
  });
});

/** Register a nickname (anonymous donor identity). */
export const POST = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  await enforceRateLimit(req, "donorCreate");
  const { nickname } = await readJson(req, createDonorSchema);
  const { donor, recoveryCode } = await createDonor(nickname);
  return NextResponse.json({ ok: true, donor: { nickname: donor.nickname, totalDonated: 0, donationsCount: 0 }, recoveryCode }, { status: 201 });
});

/** "Log out" on this device (recovery code can restore). */
export const DELETE = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  await clearDonorCookie();
  return NextResponse.json({ ok: true });
});
