import { pathToFileURL } from "node:url";
import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB || "mehrnuri";

export async function seedDatabase(clientUri = uri, databaseName = dbName, forceReplace = false) {
  const client = new MongoClient(clientUri);
  await client.connect();
  const db = client.db(databaseName);
  const bills = db.collection("bills");
  const donors = db.collection("donors");

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
      phone: "+998901234567",
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
      phone: "+998901234567",
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
      phone: "+998901234567",
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
      phone: "+998901234567",
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
