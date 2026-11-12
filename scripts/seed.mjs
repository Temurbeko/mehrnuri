import { pathToFileURL } from "node:url";
import dns from "node:dns";
import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB || "mehrnuri";
// Cloud (mongodb+srv) URIs need an SRV lookup, which some Windows resolvers refuse.
if (uri.startsWith("mongodb+srv:")) dns.setServers(["1.1.1.1", "8.8.8.8"]);


/**
 * The owner's real Olmazor utility accounts, for end-to-end tests (paying a real
 * small amount in Click/Payme and checking the receipt). Each run makes sure every
 * one of them has an OPEN request, on any database (local or the test cloud DB).
 */
const TEST_ACCOUNTS = [
  { utilityType: "waste", accountNumber: "101040110778", supplier: "«Maxsustrans» DUK", amount: 30_000 },
  { utilityType: "electricity", accountNumber: "1281318", supplier: "«Hududiy elektr tarmoqlari» AJ (HET)", amount: 120_000 },
  { utilityType: "gas", accountNumber: "1008025187", supplier: "«Hududgazta'minot» AJ", amount: 90_000 },
  { utilityType: "water", accountNumber: "2628018238", supplier: "«Toshkent shahar suv ta'minoti» MChJ", amount: 40_000 },
  { utilityType: "heating", accountNumber: "08000309282", supplier: "«Veolia Energy Tashkent» MChJ XK", amount: 250_000 },
];

export async function ensureTestAccounts(db) {
  const bills = db.collection("bills");
  const now = new Date();
  let added = 0;
  for (const a of TEST_ACCOUNTS) {
    const open = await bills.findOne({ utilityType: a.utilityType, accountNumber: a.accountNumber, isOpen: true }, { projection: { _id: 1 } });
    if (open) continue;
    const _id = new ObjectId();
    await bills.insertOne({
      _id,
      code: `MN-T${_id.toHexString().slice(-5).toUpperCase()}`,
      utilityType: a.utilityType,
      region: "tashkent_city",
      district: "olmazor",
      soato: "1726280",
      supplier: a.supplier,
      paymentPurpose: "main",
      meterReading: null,
      accountNumber: a.accountNumber,
      familyName: null,
      story: "Test arizasi: haqiqiy hisob raqam, kichik summa bilan to'lab, chekni tekshirish uchun.",
      amountOwed: a.amount,
      paidAmount: 0,
      reservedAmount: 0,
      isOpen: true,
      reviewStatus: "approved",
      trust: { level: "new", matchVotes: 0, mismatchVotes: 0, lastMismatch: null },
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      rejectReason: null,
      verification: { provider: "manual", verified: false, holderMasked: null, addressMasked: null, verifiedDebt: null, checkedAt: now },
      payout: { status: "not_paid_out", reference: null, at: null },
      ipHash: "seed",
      createdAt: now,
      updatedAt: now,
    });
    added++;
  }
  console.log(`[seed] Test accounts: ${added} new open request(s), ${TEST_ACCOUNTS.length - added} already open.`);
}

export async function seedDatabase(clientUri = uri, databaseName = dbName, forceReplace = false) {
  const client = new MongoClient(clientUri);
  await client.connect();
  const db = client.db(databaseName);
  const bills = db.collection("bills");
  const donors = db.collection("donors");

  await ensureTestAccounts(db);

  if (forceReplace) {
    await bills.deleteMany({});
  } else {
    const existingCount = await bills.countDocuments();
    if (existingCount > 0) {
      console.log(`[seed] ${existingCount} bills already in DB — skipping seed.`);
      await client.close();
      return;
    }
  }

  const now = new Date();
  const sampleBills = [
    {
      _id: new ObjectId(),
      code: "MN-OLM001",
      utilityType: "electricity",
      region: "tashkent_city",
      district: "olmazor",
      soato: "1726280",
      supplier: "«Hududiy elektr tarmoqlari» AJ (HET)",
      paymentPurpose: "main",
      meterReading: null,
      accountNumber: "1281318",
      familyName: "Olmazor tumani",
      story: "3 farzandli oilamiz, shu oy elektr energiyasi to'lovini yopishga yordam so'raymiz.",
      amountOwed: 50_000,
      paidAmount: 0,
      reservedAmount: 0,
      isOpen: true,
      reviewStatus: "approved",
      trust: { level: "new", matchVotes: 0, mismatchVotes: 0, lastMismatch: null },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      rejectReason: null,
      verification: {
        provider: "manual",
        verified: true,
        holderMasked: "A******",
        addressMasked: "Toshkent sh., Olmazor tumani",
        verifiedDebt: 150_000,
        checkedAt: now,
      },
      payout: { status: "not_paid_out", reference: null, at: null },
      ipHash: "seed",
      createdAt: new Date(now.getTime() - 3600_000 * 4),
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      code: "MN-OLM002",
      utilityType: "gas",
      region: "tashkent_city",
      district: "olmazor",
      soato: "1726280",
      supplier: "«Hududgazta'minot» AJ",
      paymentPurpose: "main",
      meterReading: null,
      accountNumber: "1008025187",
      familyName: "Olmazor tumani",
      story: "Uyda kichik farzandlarimiz bor, tabiiy gaz to'lovida ko'maklashsangiz minnatdor bo'lamiz.",
      amountOwed: 65_000,
      paidAmount: 0,
      reservedAmount: 0,
      isOpen: true,
      reviewStatus: "approved",
      trust: { level: "new", matchVotes: 0, mismatchVotes: 0, lastMismatch: null },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      rejectReason: null,
      verification: {
        provider: "manual",
        verified: true,
        holderMasked: "A******",
        addressMasked: "Toshkent sh., Olmazor tumani",
        verifiedDebt: 150_000,
        checkedAt: now,
      },
      payout: { status: "not_paid_out", reference: null, at: null },
      ipHash: "seed",
      createdAt: new Date(now.getTime() - 3600_000 * 3),
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      code: "MN-OLM003",
      utilityType: "water",
      region: "tashkent_city",
      district: "olmazor",
      soato: "1726280",
      supplier: "«Toshkent shahar suv ta'minoti» MChJ",
      paymentPurpose: "main",
      meterReading: null,
      accountNumber: "2628018238",
      familyName: "Olmazor tumani",
      story: "Sovuq suvdan yig'ilib qolgan qarzimizni yopishga yordam berishingizni so'raymiz.",
      amountOwed: 45_000,
      paidAmount: 0,
      reservedAmount: 0,
      isOpen: true,
      reviewStatus: "approved",
      trust: { level: "new", matchVotes: 0, mismatchVotes: 0, lastMismatch: null },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      rejectReason: null,
      verification: {
        provider: "manual",
        verified: true,
        holderMasked: "A******",
        addressMasked: "Toshkent sh., Olmazor tumani",
        verifiedDebt: 150_000,
        checkedAt: now,
      },
      payout: { status: "not_paid_out", reference: null, at: null },
      ipHash: "seed",
      createdAt: new Date(now.getTime() - 3600_000 * 2),
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      code: "MN-OLM004",
      utilityType: "heating",
      region: "tashkent_city",
      district: "olmazor",
      soato: "1726280",
      supplier: "«Veolia Energy Tashkent» MChJ XK",
      paymentPurpose: "main",
      meterReading: null,
      accountNumber: "08000309282",
      familyName: "Olmazor tumani",
      story: "Yolg'iz nafaqaxo'rman, issiqlik energiyasi to'lovini qoplashda yordamingizga muhtojman.",
      amountOwed: 80_000,
      paidAmount: 0,
      reservedAmount: 0,
      isOpen: true,
      reviewStatus: "approved",
      trust: { level: "new", matchVotes: 0, mismatchVotes: 0, lastMismatch: null },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      rejectReason: null,
      verification: {
        provider: "manual",
        verified: true,
        holderMasked: "A******",
        addressMasked: "Toshkent sh., Olmazor tumani",
        verifiedDebt: 150_000,
        checkedAt: now,
      },
      payout: { status: "not_paid_out", reference: null, at: null },
      ipHash: "seed",
      createdAt: new Date(now.getTime() - 3600_000 * 1),
      updatedAt: now,
    },
  ];

  await bills.insertMany(sampleBills);

  const donorCount = await donors.countDocuments();
  if (donorCount === 0) {
    await donors.insertMany([
      {
        _id: new ObjectId(),
        nickname: "Saxiy_Inson",
        nicknameKey: "saxiy_inson",
        tokenHash: "seed_1",
        totalDonated: 450_000,
        donationsCount: 6,
        telegramId: null,
        phone: null,
        createdAt: now,
        lastSeenAt: now,
      },
      {
        _id: new ObjectId(),
        nickname: "Mehribon_01",
        nicknameKey: "mehribon_01",
        tokenHash: "seed_2",
        totalDonated: 190_000,
        donationsCount: 3,
        telegramId: null,
        phone: null,
        createdAt: now,
        lastSeenAt: now,
      },
    ]);
  }

  console.log(`[seed] Inserted ${sampleBills.length} bills.`);
  await client.close();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const force = process.argv.includes("--force");
  seedDatabase(uri, dbName, force).catch((err) => {
    console.error("[seed] Failed:", err);
    process.exit(1);
  });
}
