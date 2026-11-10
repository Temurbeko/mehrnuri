import { fmt, formatMoney, type Dictionary } from "@/i18n";

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

/**
 * Maps API error codes to friendly, localized text.
 *
 * Any code that has its own entry in `dict.errors` gets that text, with
 * {min} / {max} / {available} filled from the error details. Only truly
 * unknown codes fall back to the generic "check your input" message: before,
 * many specific errors (e.g. an expired payment) all showed that generic text,
 * which left donors with no idea what to do.
 */
export function errorText(code: string | undefined, dict: Dictionary, details?: unknown): string {
  const aliased = code ? (ALIASES[code] ?? code) : "invalid_input";
  if (aliased === "account_not_found") return dict.ask.notFound;
  if (aliased === "bill_not_open") return dict.donate.full;

  const table = dict.errors as Record<string, string>;
  const template = table[aliased];
  if (!template) return dict.errors.invalid_input;

  const vars: Record<string, string> = {};
  if (details && typeof details === "object") {
    for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
      if (typeof v === "number") vars[k] = formatMoney(v, dict);
    }
  }
  const text = fmt(template, vars);
  // If the server sent no amount, a raw "{available}" would show: use the general text instead.
  if (/\{\w+\}/.test(text)) {
    return aliased === "amount_exceeds_available" ? dict.donate.full : dict.errors.invalid_input;
  }
  return text;
}

/** Server codes that share a message with another code. */
const ALIASES: Record<string, string> = {
  wrong_password: "unauthorized",
  invalid_receipt: "invalid_receipt_format",
  bad_origin: "forbidden_origin",
  bad_signature: "payment_not_found",
};
