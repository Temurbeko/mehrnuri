import "server-only";
import { z } from "zod";

const optional = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().optional());

const int = (fallback: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : fallback), z.number().int().positive());

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v : "http://localhost:3000"), z.url()),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
  ADMIN_PASSWORD: z.string().min(8, "ADMIN_PASSWORD must be at least 8 characters"),

  MONGODB_URI: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v : "mongodb://127.0.0.1:27017"), z.string()),
  MONGODB_DB: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v : "mehrnuri"), z.string()),

  RESERVATION_MINUTES: int(20),
  MIN_DONATION_UZS: int(1000),
  MAX_DONATION_UZS: int(10_000_000),

  RATE_LIMIT_STORE: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v : "mongo"), z.enum(["mongo", "memory"])),

  /** `live`: verify receipts with Soliq (server must be inside Uzbekistan). `mock`: accept any well-formed receipt link (test hosting only). */
  SOLIQ_MODE: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v : "live"), z.enum(["live", "mock"])),

  TELEGRAM_BOT_TOKEN: optional,
  TELEGRAM_ADMIN_CHAT_ID: optional,
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${details}\nSee .env.example`);
  }
  cached = parsed.data;
  return cached;
}
