import argon2 from "argon2";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { logger } from "./logger.js";
import { config } from "./config.js";

const PIN_PEPPER = process.env.PIN_PEPPER ?? "telegram-bot-platform-v1";

export async function hashPin(pin: string): Promise<string> {
  return argon2.hash(pin + PIN_PEPPER, { type: argon2.argon2id });
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, pin + PIN_PEPPER);
  } catch (err) {
    logger.warn({ err }, "Pin verify error");
    return false;
  }
}

/** token_hash = sha256(token + optional server secret). Do not log raw token. */
export function hashToken(token: string): string {
  const payload = config.tokenHashSecret ? token + config.tokenHashSecret : token;
  return createHash("sha256").update(payload).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** Constant-time comparison for OTP/codes */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function hashOtp(otp: string): Promise<string> {
  return argon2.hash(otp, { type: argon2.argon2id });
}

export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, otp);
  } catch {
    return false;
  }
}
