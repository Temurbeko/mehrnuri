import "server-only";
import { MongoClient, type Collection, type Db } from "mongodb";
import { env } from "@/config/env";
import type { AccountDoc, BillDoc, DonorDoc, PaymentDoc, RateLimitDoc, VerdictDoc } from "./models";

/**
 * Re-use one MongoClient per process (survives Next.js dev hot reloads).
 */
const globalForMongo = globalThis as unknown as {
  __mongoClient?: Promise<MongoClient>;
  __mongoIndexes?: Promise<void>;
};

function getClient(): Promise<MongoClient> {
  if (!globalForMongo.__mongoClient) {
    const client = new MongoClient(env().MONGODB_URI, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
      appName: "mehrnuri",
    });
    globalForMongo.__mongoClient = client.connect().catch((err: unknown) => {
      globalForMongo.__mongoClient = undefined;
      throw err;
    });
  }
  return globalForMongo.__mongoClient;
}

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection<BillDoc>("bills").createIndexes([
      { key: { code: 1 }, unique: true },
      // Only ONE open request per utility account number.
      { key: { utilityType: 1, accountNumber: 1 }, unique: true, partialFilterExpression: { isOpen: true }, name: "one_open_per_account" },
      { key: { reviewStatus: 1, isOpen: 1, createdAt: 1 } },
      { key: { updatedAt: 1 } },
      // Stale-request sweep, and the per-phone posting cap.
      { key: { isOpen: 1, expiresAt: 1 } },
      { key: { phone: 1, createdAt: -1 } },
    ]),
    db.collection<VerdictDoc>("verdicts").createIndexes([
      // One verdict per visitor per bill.
      { key: { billId: 1, voterHash: 1 }, unique: true, name: "one_verdict_per_voter" },
      { key: { billId: 1, ipHash: 1 } },
      { key: { accountKey: 1, createdAt: -1 } },
    ]),
    db.collection<AccountDoc>("accounts").createIndexes([{ key: { blocked: 1 } }, { key: { lastSeenAt: -1 } }]),
    db.collection<PaymentDoc>("payments").createIndexes([
      { key: { billId: 1, status: 1 } },
      { key: { status: 1, expiresAt: 1 } },
      { key: { donorId: 1, createdAt: -1 } },
      { key: { receiptKey: 1 }, unique: true, partialFilterExpression: { receiptKey: { $type: "string" } } },
    ]),
    db.collection<DonorDoc>("donors").createIndexes([
      { key: { nicknameKey: 1 }, unique: true },
      { key: { totalDonated: -1 } },
    ]),
    db.collection<RateLimitDoc>("rate_limits").createIndexes([{ key: { expiresAt: 1 }, expireAfterSeconds: 0 }]),
  ]);
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  const db = client.db(env().MONGODB_DB);
  if (!globalForMongo.__mongoIndexes) {
    globalForMongo.__mongoIndexes = ensureIndexes(db).catch((err: unknown) => {
      globalForMongo.__mongoIndexes = undefined;
      throw err;
    });
  }
  await globalForMongo.__mongoIndexes;
  return db;
}

export async function collections(): Promise<{
  bills: Collection<BillDoc>;
  payments: Collection<PaymentDoc>;
  donors: Collection<DonorDoc>;
  rateLimits: Collection<RateLimitDoc>;
  verdicts: Collection<VerdictDoc>;
  accounts: Collection<AccountDoc>;
}> {
  const db = await getDb();
  return {
    bills: db.collection<BillDoc>("bills"),
    payments: db.collection<PaymentDoc>("payments"),
    donors: db.collection<DonorDoc>("donors"),
    rateLimits: db.collection<RateLimitDoc>("rate_limits"),
    verdicts: db.collection<VerdictDoc>("verdicts"),
    accounts: db.collection<AccountDoc>("accounts"),
  };
}
