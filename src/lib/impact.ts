import "server-only";
import { ObjectId } from "mongodb";
import { collections } from "@/lib/db/mongo";
import type { UtilityType } from "@/lib/domain";

/** Tashkent has no daylight saving: always UTC+5. */
const TASHKENT_OFFSET_MS = 5 * 3600_000;

const SHARE_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => SHARE_ALPHABET[b % SHARE_ALPHABET.length]).join("");
}

export function isMonthKey(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

/** "2026-11" for the month a moment falls in, Tashkent time. */
export function monthKeyOf(d: Date): string {
  return new Date(d.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 7);
}

export function previousMonthKey(key: string): string {
  const [y = 0, m = 1] = key.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Month as a [start, end) range in real instants. */
function monthRange(key: string): { start: Date; end: Date } {
  const [y = 0, m = 1] = key.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1) - TASHKENT_OFFSET_MS),
    end: new Date(Date.UTC(y, m, 1) - TASHKENT_OFFSET_MS),
  };
}

export interface MonthImpact {
  month: string;
  families: number;
  total: number;
  utilities: UtilityType[];
}

/** Paid payments only: distinct families (bills), total amount, utility types. */
export async function donorMonthImpact(donorId: ObjectId, month: string): Promise<MonthImpact> {
  const { payments, bills } = await collections();
  const { start, end } = monthRange(month);
  const rows = await payments
    .find(
      { donorId, status: "paid", paidAt: { $gte: start, $lt: end } },
      { projection: { billId: 1, amount: 1 } },
    )
    .toArray();
  const billIds = [...new Set(rows.map((r) => r.billId.toHexString()))].map((id) => new ObjectId(id));
  const utilities = billIds.length
    ? await bills.find({ _id: { $in: billIds } }, { projection: { utilityType: 1 } }).toArray()
    : [];
  return {
    month,
    families: billIds.length,
    total: rows.reduce((s, r) => s + r.amount, 0),
    utilities: [...new Set(utilities.map((b) => b.utilityType))],
  };
}

/** The donor's random public impact code, created on first use. */
export async function ensureImpactCode(donorId: ObjectId): Promise<string> {
  const { donors } = await collections();
  const existing = await donors.findOne({ _id: donorId }, { projection: { impactCode: 1 } });
  if (existing?.impactCode) return existing.impactCode;
  const code = randomCode();
  const res = await donors.findOneAndUpdate(
    { _id: donorId, impactCode: { $exists: false } },
    { $set: { impactCode: code } },
    { returnDocument: "after" },
  );
  if (res?.impactCode) return res.impactCode;
  const again = await donors.findOne({ _id: donorId }, { projection: { impactCode: 1 } });
  return again?.impactCode ?? code;
}

export interface SharedImpact extends MonthImpact {
  nickname: string;
}

/** What the public card may show; null when the code is unknown or nothing was paid that month. */
export async function getSharedImpact(code: string, month: string): Promise<SharedImpact | null> {
  if (!/^[A-Za-z0-9]{6,20}$/.test(code) || !isMonthKey(month)) return null;
  const { donors } = await collections();
  const donor = await donors.findOne({ impactCode: code }, { projection: { nickname: 1 } });
  if (!donor) return null;
  const impact = await donorMonthImpact(donor._id, month);
  if (impact.families < 1) return null;
  return { ...impact, nickname: donor.nickname };
}

/** "2026-11-a" -> month + amount flag. */
export function parseMonthParam(raw: string): { month: string; withAmount: boolean } {
  const withAmount = raw.endsWith("-a");
  return { month: withAmount ? raw.slice(0, -2) : raw, withAmount };
}

/** "2026-11" as "noyabr 2026" in the reader's language. */
export function monthLabel(key: string, htmlLang: string): string {
  const [y = 0, m = 1] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(htmlLang, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
}
