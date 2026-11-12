import "server-only";
import type { ObjectId } from "mongodb";
import { collections } from "@/lib/db/mongo";
import type { UtilityType } from "@/lib/domain";
import { HttpError } from "@/lib/security/http";
import { KNOWN_SUPPLIER_TINS } from "@/lib/uzbekistan";

/**
 * Was the receipt paid to the right utility?
 *
 * A Soliq receipt names the real recipient: `paymentDetails[].comitentTin`, the
 * utility's tax id (the payment app, e.g. Click, is only the cashier: `tin`).
 * It does NOT carry the utility account number (`extraInfo.accountNumber` is
 * null for Click utility payments), so we can check WHO was paid, not WHICH
 * family account.
 *
 * Rules, strictest first:
 * 1. The bill already has a confirmed utility tax id: the receipt must name it.
 * 2. The receipt's tax ids are all known to belong to OTHER utility types and
 *    none to this one (e.g. a gas receipt for an electricity request): refused.
 * 3. Unknown tax id: accepted and learned. A tax id becomes "known" for a type
 *    from the static list, or once receipts for it were accepted on
 *    TRUST_AFTER_BILLS different requests of that type (so one person cannot
 *    teach the system a wrong mapping).
 *
 * Personal data on the receipt (payer phone, address) is never read or stored.
 */
export const TRUST_AFTER_BILLS = 3;

export interface ReceiptRecipient {
  tin: string;
  name: string | null;
}

interface SoliqDetail {
  comitentTin?: number | string | null;
  name?: string | null;
}

export function recipientsOf(details: SoliqDetail[] | null | undefined): ReceiptRecipient[] {
  const out = new Map<string, ReceiptRecipient>();
  for (const d of details ?? []) {
    const tin = String(d.comitentTin ?? "").replace(/\D/g, "");
    if (tin.length < 9 || /^0+$/.test(tin)) continue;
    if (!out.has(tin)) out.set(tin, { tin, name: typeof d.name === "string" ? d.name.slice(0, 80) : null });
  }
  return [...out.values()];
}

/** Utility types each tax id is known for (static list + learned with enough distinct requests). */
async function knownTypes(tins: string[]): Promise<Map<string, Set<UtilityType>>> {
  const { supplierTins } = await collections();
  const docs = await supplierTins.find({ _id: { $in: tins } }).toArray();
  const map = new Map<string, Set<UtilityType>>();
  for (const tin of tins) {
    const set = new Set<UtilityType>(KNOWN_SUPPLIER_TINS[tin] ?? []);
    const doc = docs.find((d) => d._id === tin);
    for (const [type, bills] of Object.entries(doc?.bills ?? {})) {
      if ((bills?.length ?? 0) >= TRUST_AFTER_BILLS) set.add(type as UtilityType);
    }
    map.set(tin, set);
  }
  return map;
}

/** Throws 422 `receipt_wrong_recipient` when the receipt clearly paid another utility. */
export async function checkRecipient(billId: ObjectId, recipients: ReceiptRecipient[]): Promise<void> {
  if (recipients.length === 0) return; // older receipt formats: nothing to compare
  const { bills } = await collections();
  const bill = await bills.findOne({ _id: billId }, { projection: { utilityType: 1, supplierTin: 1 } });
  if (!bill) return;
  const tins = recipients.map((r) => r.tin);

  if (bill.supplierTin) {
    if (!tins.includes(bill.supplierTin)) throw new HttpError(422, "receipt_wrong_recipient");
    return;
  }

  const known = await knownTypes(tins);
  const anyForThis = tins.some((t) => known.get(t)?.has(bill.utilityType));
  const allForOthers = tins.every((t) => (known.get(t)?.size ?? 0) > 0);
  if (!anyForThis && allForOthers) throw new HttpError(422, "receipt_wrong_recipient");
}

/** After an accepted receipt: learn the tax id, and pin it on the bill once it is trusted for this type. */
export async function rememberRecipient(billId: ObjectId, recipients: ReceiptRecipient[]): Promise<void> {
  if (recipients.length === 0) return;
  const { bills, supplierTins } = await collections();
  const bill = await bills.findOne({ _id: billId }, { projection: { utilityType: 1, supplierTin: 1 } });
  if (!bill) return;
  const id = billId.toHexString();
  const now = new Date();

  await Promise.all(
    recipients.map((r) =>
      supplierTins.updateOne(
        { _id: r.tin },
        {
          $addToSet: { [`bills.${bill.utilityType}`]: id },
          $set: { lastSeenAt: now, ...(r.name ? { name: r.name } : {}) },
        },
        { upsert: true },
      ),
    ),
  );

  if (!bill.supplierTin) {
    const known = await knownTypes(recipients.map((r) => r.tin));
    const pin = recipients.find((r) => known.get(r.tin)?.has(bill.utilityType));
    if (pin) {
      await bills.updateOne({ _id: billId, supplierTin: { $exists: false } }, { $set: { supplierTin: pin.tin } });
    }
  }
}
