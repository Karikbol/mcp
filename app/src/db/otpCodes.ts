import { query } from "./client.js";
import { config } from "../config.js";

const TTL_MINUTES = config.otpTtlMin;
const MAX_SENDS = config.otpMaxSends;

export interface OtpRow {
  id: number;
  phone_e164: string;
  otp_hash: string;
  expires_at: Date;
  attempts: number;
  pin_attempts: number;
  send_count: number;
  created_at: Date;
}

/** Returns id if OTP row was created/updated and send_count still under limit, else 0. */
export async function createOrUpdateOtp(phoneE164: string, otpHash: string): Promise<number> {
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
  const existing = await getActiveOtp(phoneE164);
  if (existing) {
    if (existing.send_count >= MAX_SENDS) return 0;
    const r = await query(
      `UPDATE otp_codes SET otp_hash = $2, expires_at = $3, send_count = send_count + 1
       WHERE id = $4 RETURNING id`,
      [phoneE164, otpHash, expiresAt, existing.id]
    );
    return r.rows.length > 0 ? (r.rows[0] as { id: number }).id : 0;
  }
  const r = await query(
    `INSERT INTO otp_codes (phone_e164, otp_hash, expires_at, send_count)
     VALUES ($1, $2, $3, 1) RETURNING id`,
    [phoneE164, otpHash, expiresAt]
  );
  return r.rows.length > 0 ? (r.rows[0] as { id: number }).id : 0;
}

export async function getActiveOtp(phoneE164: string): Promise<OtpRow | null> {
  const r = await query(
    `SELECT id, phone_e164, otp_hash, expires_at, attempts, pin_attempts, send_count, created_at
     FROM otp_codes WHERE phone_e164 = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
    [phoneE164]
  );
  if (r.rows.length === 0) return null;
  return r.rows[0] as OtpRow;
}

export async function canSendAgain(phoneE164: string): Promise<boolean> {
  const r = await query(
    `SELECT send_count FROM otp_codes WHERE phone_e164 = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
    [phoneE164]
  );
  if (r.rows.length === 0) return true;
  const row = r.rows[0] as { send_count: number };
  return row.send_count < MAX_SENDS;
}

export async function incrementAttempts(phoneE164: string): Promise<{ attempts: number }> {
  const r = await query(
    `UPDATE otp_codes SET attempts = attempts + 1 WHERE phone_e164 = $1 AND expires_at > NOW()
     RETURNING attempts`,
    [phoneE164]
  );
  if (r.rows.length === 0) return { attempts: 0 };
  return { attempts: (r.rows[0] as { attempts: number }).attempts };
}

export async function getAttempts(phoneE164: string): Promise<number> {
  const r = await query(
    `SELECT attempts FROM otp_codes WHERE phone_e164 = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
    [phoneE164]
  );
  if (r.rows.length === 0) return 0;
  return (r.rows[0] as { attempts: number }).attempts;
}

export async function incrementPinAttempts(phoneE164: string): Promise<number> {
  const r = await query(
    `UPDATE otp_codes SET pin_attempts = pin_attempts + 1 WHERE phone_e164 = $1 AND expires_at > NOW()
     RETURNING pin_attempts`,
    [phoneE164]
  );
  if (r.rows.length === 0) return 0;
  return (r.rows[0] as { pin_attempts: number }).pin_attempts;
}
