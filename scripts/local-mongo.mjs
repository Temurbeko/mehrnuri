import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

const dbPath = join(process.cwd(), ".mongo-data");
mkdirSync(dbPath, { recursive: true });

console.log("[db:local] Starting local MongoDB on 127.0.0.1:27017 (data persisted in .mongo-data)...");
const mongod = await MongoMemoryServer.create({
  instance: {
    port: 27017,
    ip: "127.0.0.1",
    dbPath,
    storageEngine: "wiredTiger",
  },
});

console.log(`[db:local] Ready at ${mongod.getUri()}`);
process.on("SIGINT", async () => {
  await mongod.stop();
  process.exit(0);
});
