import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/config/env";
import { collections } from "@/lib/db/mongo";
import { sha256 } from "@/lib/security/crypto";
import { HttpError } from "@/lib/security/http";
import type { ObjectId } from "mongodb";
import { checkRecipient, recipientsOf, rememberRecipient, type ReceiptRecipient } from "./recipient";

export interface VerifiedReceipt {
  verifiedForLeaderboard: boolean;
  method: "fiscal_qr" | "unverified_claim";
  receiptKey: string | null;
  receiptLabel: string | null;
}

interface SoliqReceiptData {
  isRefund?: number;
  kkmName?: string;
  cashTotal?: number;
  cardTotal?: number;
  paymentDetails?: Array<{ comitentTin?: number | string | null; name?: string | null }>;
}

interface SoliqRequestSpec {
  endpoint: string;
  headers: Record<string, string>;
  bodies: Array<Record<string, string>>;
}

const SOLIQ_API_BASE = "https://new-ofd.soliq.uz/api";
const SOLIQ_SIGN_KEY = "thisIsPaymentSecretKey123@#";

interface SoliqQueryParams {
  terminalId: string;
  paymentNo: string;
  paymentDate: string;
  fiscalSign?: string;
  fiscalSignHash?: string;
  isEpi: boolean;
}

/**
 * Parses an official `ofd.soliq.uz` QR URL (`https://ofd.soliq.uz/epi?t=...&r=...&c=...&s=...`
 * or `https://ofd.soliq.uz/check?t=...&r=...&c=...&s=...`).
 */
function parseSoliqQrUrl(raw: string): SoliqQueryParams | null {
  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!host.endsWith("soliq.uz")) {
    return null;
  }

  const t = url.searchParams.get("t")?.trim() ?? "";
  const r = url.searchParams.get("r")?.trim() ?? "";
  const c = url.searchParams.get("c")?.trim() ?? "";
  const s = url.searchParams.get("s")?.trim() ?? "";
  const h = url.searchParams.get("h")?.trim() ?? "";

  if (!t || !r || !c || (!s && !h)) {
    return null;
  }

  const isEpi = url.pathname.toLowerCase().includes("/epi");
  return {
    terminalId: t,
    paymentNo: r,
    paymentDate: c,
    ...(s ? { fiscalSign: s } : {}),
    ...(h ? { fiscalSignHash: h } : {}),
    isEpi,
  };
}

function buildSoliqRequestSpec(params: SoliqQueryParams): SoliqRequestSpec {
  const endpoint = params.fiscalSignHash
    ? `${SOLIQ_API_BASE}/payment/mobile-dashboard`
    : `${SOLIQ_API_BASE}/payment`;
  const typesToTry = params.isEpi ? ["CHECK_EPI", "CHECK"] : ["CHECK", "CHECK_EPI"];
  const timestamp = Math.floor(Date.now() / 1000);
  const sigPayload = `${params.terminalId}:${params.paymentNo}:${timestamp}`;
  const signature = createHmac("sha256", SOLIQ_SIGN_KEY).update(sigPayload).digest("hex");

  const bodies = typesToTry.map((paymentType) => {
    const body: Record<string, string> = {
      terminalId: params.terminalId,
      paymentNo: params.paymentNo,
      paymentDate: params.paymentDate,
      paymentType,
    };
    if (params.fiscalSign) body.fiscalSign = params.fiscalSign;
    if (params.fiscalSignHash) body.fiscalSignHash = params.fiscalSignHash;
    return body;
  });

  return {
    endpoint,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Timestamp": String(timestamp),
      "X-Signature": signature,
    },
    bodies,
  };
}

export function evaluateSoliqData(data: SoliqReceiptData, expectedAmountUzs: number): { kkmName: string; recipients: ReceiptRecipient[] } {
  if (data.isRefund === 1) {
    throw new HttpError(422, "soliq_receipt_refunded");
  }
  // Soliq reports totals in tiyin on some receipt types and in so'm on others.
  const rawTotal = Number(data.cashTotal ?? 0) + Number(data.cardTotal ?? 0);
  const totalAmountUzs =
    rawTotal >= Math.max(expectedAmountUzs, 1000) * 50 ? Math.round(rawTotal / 100) : Math.round(rawTotal);

  // The receipt must cover the whole donation it is being claimed for.
  if (totalAmountUzs < expectedAmountUzs) {
    throw new HttpError(422, "receipt_amount_mismatch", undefined, { receipt: totalAmountUzs, expected: expectedAmountUzs });
  }

  return { kkmName: data.kkmName ?? "OFD", recipients: recipientsOf(data.paymentDetails) };
}

/**
 * Calls the official Tax Committee (Soliq OFD) API at `https://new-ofd.soliq.uz/api/payment`.
 * Soliq only answers requests from inside Uzbekistan (TAS-IX), so `SOLIQ_MODE=live` needs a server there.
 * `SOLIQ_MODE=mock` (test hosting outside Uzbekistan only) skips the call and treats every
 * well-formed receipt link as a valid receipt for the exact donation amount.
 */
async function verifyWithSoliqServer(params: SoliqQueryParams, expectedAmountUzs: number): Promise<{ kkmName: string; recipients: ReceiptRecipient[] }> {
  if (env().SOLIQ_MODE === "mock") {
    return { kkmName: "TEST MODE", recipients: [] };
  }

  const spec = buildSoliqRequestSpec(params);
  let reached = false;

  for (const body of spec.bodies) {
    let res: Response;
    try {
      res = await fetch(spec.endpoint, {
        method: "POST",
        headers: spec.headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      continue;
    }
    reached = true;

    if (!res.ok) {
      continue;
    }

    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: SoliqReceiptData } | null;

    if (json?.data) {
      return evaluateSoliqData(json.data, expectedAmountUzs);
    }
  }

  if (!reached) {
    throw new HttpError(503, "soliq_unavailable");
  }
  throw new HttpError(422, "soliq_receipt_not_found");
}

/**
 * Server-side Fiscal Receipt Verification:
 * 1. Parses the `ofd.soliq.uz` QR link (`t`, `r`, `c`, `s`/`h`).
 * 2. Queries `https://new-ofd.soliq.uz/api/payment` live from the server and checks the paid amount.
 * 3. Enforces anti-replay uniqueness (`receiptKey` unique index in MongoDB) so
 *    the same receipt can never be used twice.
 */
/**
 * The receipt time is printed in the QR itself (`c=YYYYMMDDHHmmss`, Tashkent
 * time, UTC+5), so it can be checked without asking Soliq. Returns null when
 * the format is unknown (then the date is simply not checked).
 */
export function receiptTime(c: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(c.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number) as number[];
  const t = Date.UTC(y!, mo! - 1, d!, h! - 5, mi!, s!);
  return Number.isFinite(t) ? new Date(t) : null;
}

/** A receipt may be made a little before the payment record (clock skew), never long before. */
const RECEIPT_EARLY_SLACK_MS = 30 * 60_000;
const RECEIPT_FUTURE_SLACK_MS = 15 * 60_000;

/**
 * Soliq has not got the receipt yet (payment services may send it to the tax
 * office hours later) or could not be reached. Such a receipt is kept and
 * checked again later instead of being refused.
 */
export function isRetryableReceiptError(err: unknown): boolean {
  return err instanceof HttpError && (err.code === "soliq_receipt_not_found" || err.code === "soliq_unavailable");
}

/** Cheap checks that need no network: link format and date window. Throws on a bad receipt. */
export function precheckReceipt(rawInput: string, paymentCreatedAt: Date): void {
  const parsed = parseSoliqQrUrl(rawInput.trim());
  if (!parsed) throw new HttpError(422, "invalid_receipt_format");
  const at = receiptTime(parsed.paymentDate);
  if (!at) return;
  if (at.getTime() < paymentCreatedAt.getTime() - RECEIPT_EARLY_SLACK_MS || at.getTime() > Date.now() + RECEIPT_FUTURE_SLACK_MS) {
    throw new HttpError(422, "receipt_date_mismatch");
  }
}

export async function verifyAndLockReceipt(
  rawInput: string | null | undefined,
  expectedAmountUzs: number,
  paymentCreatedAt?: Date,
  billId?: ObjectId,
): Promise<VerifiedReceipt> {
  const trimmed = (rawInput ?? "").trim();
  if (!trimmed) {
    return {
      verifiedForLeaderboard: false,
      method: "unverified_claim",
      receiptKey: null,
      receiptLabel: null,
    };
  }

  const parsed = parseSoliqQrUrl(trimmed);
  if (!parsed) {
    throw new HttpError(422, "invalid_receipt_format");
  }

  // The receipt must be from this payment, not an old one from another day.
  if (paymentCreatedAt) precheckReceipt(trimmed, paymentCreatedAt);

  const canonical = `soliq:${parsed.terminalId}:${parsed.paymentNo}:${parsed.paymentDate}:${parsed.fiscalSign ?? parsed.fiscalSignHash ?? ""}`.toLowerCase();
  const receiptKey = sha256(canonical);

  // 1. Check anti-replay uniqueness before calling external API
  const { payments } = await collections();
  const existing = await payments.findOne({ receiptKey, status: "paid" }, { projection: { _id: 1 } });
  if (existing) {
    throw new HttpError(409, "duplicate_receipt");
  }

  // 2. Live verification with Uzbekistan Tax Committee (new-ofd.soliq.uz)
  const soliqData = await verifyWithSoliqServer(parsed, expectedAmountUzs);
  // 3. Paid to the right utility (tax id on the receipt), not just any receipt with a big enough total.
  if (billId) {
    await checkRecipient(billId, soliqData.recipients);
    void rememberRecipient(billId, soliqData.recipients).catch((err: unknown) => console.warn("[receipt] rememberRecipient failed", err));
  }
  const label = `OFD #${parsed.paymentNo} (${soliqData.kkmName})`.slice(0, 48);

  return {
    verifiedForLeaderboard: true,
    method: "fiscal_qr",
    receiptKey,
    receiptLabel: label,
  };
}
