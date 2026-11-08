import type { Dictionary } from "@/i18n";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T & { error?: string; details?: unknown };
}

export async function api<T = Record<string, unknown>>(url: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as ApiResult<T>["data"];
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "network" } as ApiResult<T>["data"] };
  }
}

/** Maps API error codes to friendly, localized text. */
export function errorText(code: string | undefined, dict: Dictionary): string {
  switch (code) {
    case "rate_limited":
      return dict.errors.rate_limited;
    case "duplicate_open_bill":
      return dict.errors.duplicate_open_bill;
    case "account_not_found":
      return dict.ask.notFound;
    case "nickname_taken":
      return dict.errors.nickname_taken;
    case "amount_exceeds_available":
    case "bill_not_open":
      return dict.donate.full;
    case "invalid_recovery_code":
      return dict.errors.invalid_recovery_code;
    case "wrong_password":
    case "unauthorized":
      return dict.errors.unauthorized;
    case "invalid_receipt":
    case "invalid_receipt_format":
      return dict.errors.invalid_receipt_format;
    case "soliq_receipt_not_found":
      return dict.errors.soliq_receipt_not_found;
    case "soliq_receipt_refunded":
      return dict.errors.soliq_receipt_refunded;
    case "soliq_unavailable":
      return dict.errors.soliq_unavailable;
    case "duplicate_receipt":
      return dict.errors.duplicate_receipt;
    default:
      return dict.errors.invalid_input;
  }
}
