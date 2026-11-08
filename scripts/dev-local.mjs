import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";
import { MongoMemoryServer } from "mongodb-memory-server";
import { seedDatabase } from "./seed.mjs";

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
    socket.connect(port, host);
  });
}

let mongod = null;
if (!(await isPortOpen(27017))) {
  const dbPath = join(process.cwd(), ".mongo-data");
  mkdirSync(dbPath, { recursive: true });
  console.log("[dev:local] No MongoDB detected on :27017 — starting embedded MongoDB...");
  mongod = await MongoMemoryServer.create({
    instance: { port: 27017, ip: "127.0.0.1", dbPath, storageEngine: "wiredTiger" },
  });
  console.log(`[dev:local] MongoDB running at ${mongod.getUri()}`);
} else {
  console.log("[dev:local] Using existing MongoDB on 127.0.0.1:27017");
}

await seedDatabase();

const nextBin = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev"], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", async (code) => {
  if (mongod) await mongod.stop();
  process.exit(code ?? 0);
});
