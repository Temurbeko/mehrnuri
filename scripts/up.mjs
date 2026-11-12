/**
 * One command for the whole test setup:
 *   - tops up the test cloud DB (your 5 test accounts always have an open request),
 *   - starts local MongoDB + seed + the Next dev server (scripts/dev-local.mjs),
 *   - prints every address (computer, phone on Wi-Fi, prod, admin),
 *   - with --open, opens local and prod in your browser.
 * If the dev server is already running, it only prints the addresses.
 */
import { spawn } from "node:child_process";
import net from "node:net";
import { networkInterfaces } from "node:os";
import { existsSync } from "node:fs";

const PROD = "https://mehrnuri.netlify.app";
const open = process.argv.includes("--open");

const portOpen = (port) =>
  new Promise((resolve) => {
    const s = net.connect(port, "127.0.0.1");
    s.setTimeout(800);
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("timeout", () => (s.destroy(), resolve(false)));
    s.once("error", () => resolve(false));
  });

const lan = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => `http://${i.address}:3000`);

function banner() {
  console.log("\n================ MehrNuri ================");
  console.log(`  Computer : http://localhost:3000`);
  console.log(`  Phone    : ${lan.join("  ") || "(no Wi-Fi found)"}`);
  console.log(`  Prod     : ${PROD}`);
  console.log(`  Admin    : http://localhost:3000/uz-latn/admin`);
  console.log("==========================================\n");
}

function openUrls() {
  if (!open) return;
  for (const url of ["http://localhost:3000/uz-latn", `${PROD}/uz-latn`]) {
    const cmd = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  }
}

// Cloud test DB top-up runs on the side; it never blocks the local start.
if (existsSync(".env.local")) {
  const seed = spawn(process.execPath, ["--env-file=.env.local", "scripts/seed.mjs"], { stdio: ["ignore", "pipe", "pipe"] });
  seed.stdout.on("data", (d) => process.stdout.write(`[remote] ${d}`));
  seed.stderr.on("data", () => {});
  seed.on("exit", (code) => code && console.log("[remote] cloud DB top-up failed (offline?) — local run is fine."));
}

if (await portOpen(3000)) {
  console.log("[up] Dev server already running.");
  banner();
  openUrls();
  // Stay alive so a launcher button (the app's Preview) keeps showing it as running.
  setInterval(() => {}, 1 << 30);
} else {
  const dev = spawn(process.execPath, ["scripts/dev-local.mjs"], { stdio: "inherit", env: process.env });
  // Show the addresses once the server answers.
  const t = setInterval(async () => {
    if (await portOpen(3000)) {
      clearInterval(t);
      banner();
      openUrls();
    }
  }, 1500);
  dev.on("exit", (code) => process.exit(code ?? 0));
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => dev.kill(sig));
}
