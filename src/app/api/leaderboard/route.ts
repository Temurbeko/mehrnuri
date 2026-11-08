import { NextResponse, type NextRequest } from "next/server";
import { topDonors } from "@/lib/donors/leaderboard";
import { handler } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  await enforceRateLimit(req, "read");
  return NextResponse.json({ ok: true, donors: await topDonors(50) });
});
