import { NextResponse, type NextRequest } from "next/server";
import { checkAdminPassword, endAdminSession, startAdminSession } from "@/lib/admin/session";
import { assertSameOrigin, handler, HttpError, readJson } from "@/lib/security/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { adminLoginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  await enforceRateLimit(req, "adminLogin");
  const { password } = await readJson(req, adminLoginSchema);
  if (!checkAdminPassword(password)) throw new HttpError(401, "wrong_password");
  await startAdminSession();
  return NextResponse.json({ ok: true });
});

export const DELETE = handler(async (req: NextRequest) => {
  assertSameOrigin(req);
  await endAdminSession();
  return NextResponse.json({ ok: true });
});
