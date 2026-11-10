import "server-only";
import { env } from "@/config/env";
import { BRAND } from "@/config/brand";

export type NotifyEvent =
  | { type: "bill_submitted"; code: string; amount: number }
  | { type: "payment_received"; code: string; amount: number; nickname: string }
  | { type: "bill_funded"; code: string; amount: number }
  | { type: "bill_paid_out"; code: string; reference: string }
  | { type: "bill_held"; code: string; amount: number; reason: string }
  | { type: "bill_flagged"; code: string; reports: number; seenAmount: number | null }
  | { type: "account_blocked"; accountKey: string; reports: number };

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
    case "bill_held":
      return `⏸️ ${BRAND.name}: ${e.code} held for review — ${e.amount} UZS (${e.reason})`;
    case "bill_flagged":
      return `🚩 ${BRAND.name}: ${e.code} hidden after ${e.reports} donor reports${
        e.seenAmount === null ? "" : ` (app showed ${e.seenAmount} UZS)`
      }`;
    case "account_blocked":
      return `⛔ ${BRAND.name}: account ${e.accountKey} blocked after ${e.reports} reports`;
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
