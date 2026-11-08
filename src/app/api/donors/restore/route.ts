import { NextResponse, type NextRequest } from "next/server";
import { restoreDonor } from "@/lib/donors/session";
import { assertSameOrigin, handler, readJson } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { restoreDonorSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  await enforceRateLimit(req, "donorRestore");
  const { recoveryCode } = await readJson(req, restoreDonorSchema);
  const donor = await restoreDonor(recoveryCode);
  return NextResponse.json({ ok: true, donor: { nickname: donor.nickname, totalDonated: donor.totalDonated, donationsCount: donor.donationsCount } });
});
