import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongo";
import { enabledProviders } from "@/lib/payments/providers";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await (await getDb()).command({ ping: 1 });
    return NextResponse.json({ ok: true, db: "up", providers: enabledProviders() });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
