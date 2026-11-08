import "server-only";
import { cookies } from "next/headers";
import { MongoServerError, ObjectId } from "mongodb";
import { collections } from "@/lib/db/mongo";
import type { DonorDoc } from "@/lib/db/models";
import { randomToken, safeEqual, sha256 } from "@/lib/security/crypto";
import { HttpError } from "@/lib/security/http";
import { env } from "@/config/env";

/**
 * Donor identity: a unique nickname bound to a secret token stored in an
 * httpOnly cookie. The token is also the "recovery code" for other devices.
 * Leaderboard totals are ONLY changed by verified payment callbacks, so a
 * nickname cannot be inflated from the client.
 *
 * Door: link telegramId / phone later for stronger identity.
 */
export const DONOR_COOKIE = "mn_donor";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function nicknameKey(nickname: string): string {
  return nickname.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

async function setDonorCookie(value: string): Promise<void> {
  const jar = await cookies();
  jar.set(DONOR_COOKIE, value, {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export async function createDonor(nickname: string): Promise<{ donor: DonorDoc; recoveryCode: string }> {
  const { donors } = await collections();
  const token = randomToken(24);
  const now = new Date();
  const donor: DonorDoc = {
    _id: new ObjectId(),
    nickname,
    nicknameKey: nicknameKey(nickname),
    tokenHash: sha256(token),
    totalDonated: 0,
    donationsCount: 0,
    telegramId: null,
    phone: null,
    createdAt: now,
    lastSeenAt: now,
  };
  try {
    await donors.insertOne(donor);
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) throw new HttpError(409, "nickname_taken");
    throw err;
  }
  const recoveryCode = `${donor._id.toHexString()}.${token}`;
  await setDonorCookie(recoveryCode);
  return { donor, recoveryCode };
}

async function donorFromCode(code: string | undefined): Promise<DonorDoc | null> {
  if (!code) return null;
  const [id, token] = code.split(".");
  if (!id || !token || !/^[a-f0-9]{24}$/.test(id)) return null;
  const { donors } = await collections();
  const donor = await donors.findOne({ _id: new ObjectId(id) });
  if (!donor || !safeEqual(donor.tokenHash, sha256(token))) return null;
  return donor;
}

export async function restoreDonor(recoveryCode: string): Promise<DonorDoc> {
  const donor = await donorFromCode(recoveryCode);
  if (!donor) throw new HttpError(401, "invalid_recovery_code");
  await setDonorCookie(recoveryCode);
  return donor;
}

export async function currentDonor(): Promise<DonorDoc | null> {
  const jar = await cookies();
  return donorFromCode(jar.get(DONOR_COOKIE)?.value);
}

export async function currentRecoveryCode(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(DONOR_COOKIE)?.value;
  return v && (await donorFromCode(v)) ? v : null;
}

export async function clearDonorCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(DONOR_COOKIE);
}
