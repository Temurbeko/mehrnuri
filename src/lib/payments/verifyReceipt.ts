import "server-only";
import { createHmac } from "node:crypto";
import { collections } from "@/lib/db/mongo";
import { sha256 } from "@/lib/security/crypto";
import { HttpError } from "@/lib/security/http";

export interface VerifiedReceipt {
  verifiedForLeaderboard: boolean;
  method: "fiscal_qr" | "unverified_claim";
  receiptKey: string | null;
  receiptLabel: string | null;
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

/**
 * Calls the official Tax Committee (Soliq OFD) API on `https://new-ofd.soliq.uz/api/payment`
 * from our server to verify that the receipt actually exists and is not refunded.
 */
async function verifyWithSoliqServer(params: SoliqQueryParams, minExpectedAmountUzs?: number): Promise<{
  kkmName: string;
  totalAmountUzs: number;
}> {
  const endpoint = params.fiscalSignHash
    ? `${SOLIQ_API_BASE}/payment/mobile-dashboard`
    : `${SOLIQ_API_BASE}/payment`;

  // Try the primary paymentType based on URL path (/epi -> CHECK_EPI, /check -> CHECK),
  // and fallback to the other one if 404.
  const typesToTry = params.isEpi ? ["CHECK_EPI", "CHECK"] : ["CHECK", "CHECK_EPI"];

  for (const paymentType of typesToTry) {
    const timestamp = Math.floor(Date.now() / 1000);
    const sigPayload = `${params.terminalId}:${params.paymentNo}:${timestamp}`;
    const signature = createHmac("sha256", SOLIQ_SIGN_KEY).update(sigPayload).digest("hex");

    const body: Record<string, string> = {
      terminalId: params.terminalId,
      paymentNo: params.paymentNo,
      paymentDate: params.paymentDate,
      paymentType,
    };
    if (params.fiscalSign) body.fiscalSign = params.fiscalSign;
    if (params.fiscalSignHash) body.fiscalSignHash = params.fiscalSignHash;

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Timestamp": String(timestamp),
          "X-Signature": signature,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new HttpError(502, "soliq_unavailable");
    }

    if (!res.ok) {
      continue;
    }

    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      data?: {
        isRefund?: number;
        kkmName?: string;
        cashTotal?: number;
        cardTotal?: number;
      };
    } | null;

    if (json?.data) {
      if (json.data.isRefund === 1) {
        throw new HttpError(422, "soliq_receipt_refunded");
      }
      // Soliq stores totals in tiyin (1 UZS = 100 tiyin) or UZS depending on terminal
      const rawTotal = Number(json.data.cashTotal ?? 0) + Number(json.data.cardTotal ?? 0);
      const totalAmountUzs = rawTotal >= (minExpectedAmountUzs ?? 1000) * 50 ? Math.round(rawTotal / 100) : Math.round(rawTotal);

      return {
        kkmName: json.data.kkmName ?? "OFD",
        totalAmountUzs,
      };
    }
  }

  throw new HttpError(422, "soliq_receipt_not_found");
}

/**
 * Server-side Fiscal Receipt Verification:
 * 1. Parses the `ofd.soliq.uz` QR link (`t`, `r`, `c`, `s`/`h`).
 * 2. Queries `https://new-ofd.soliq.uz/api/payment` live from the server.
 * 3. Enforces anti-replay uniqueness (`receiptKey` unique index in MongoDB) so
 *    the same receipt can never be used twice.
 */
export async function verifyAndLockReceipt(
  rawInput?: string | null,
  expectedAmountUzs?: number,
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
  const label = `OFD #${parsed.paymentNo} (${soliqData.kkmName})`.slice(0, 48);

  return {
    verifiedForLeaderboard: true,
    method: "fiscal_qr",
    receiptKey,
    receiptLabel: label,
  };
}
