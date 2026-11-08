import "server-only";
import { env } from "@/config/env";
import { BRAND } from "@/config/brand";

export type NotifyEvent =
  | { type: "bill_submitted"; code: string; amount: number }
  | { type: "payment_received"; code: string; amount: number; nickname: string }
  | { type: "bill_funded"; code: string; amount: number }
  | { type: "bill_paid_out"; code: string; reference: string };

function render(e: NotifyEvent): string {
  switch (e.type) {
    case "bill_submitted":
      return `🆕 ${BRAND.name}: new request ${e.code} — ${e.amount} UZS`;
    case "payment_received":
      return `💛 ${BRAND.name}: ${e.nickname} paid ${e.amount} UZS for ${e.code}`;
    case "bill_funded":
      return `✅ ${BRAND.name}: ${e.code} fully funded (${e.amount} UZS)`;
    case "bill_paid_out":
      return `🏦 ${BRAND.name}: ${e.code} paid out to utility (Receipt: ${e.reference})`;
  }
}

export async function notify(e: NotifyEvent): Promise<void> {
  const text = render(e);
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID } = env();
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
    console.info(`[notify] ${text}`);
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_ADMIN_CHAT_ID, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.warn("[notify] telegram failed", err);
  }
}
