import { query } from "./client.js";
import { config } from "../config.js";
import { hashToken, randomToken } from "../crypto.js";

const TTL_MINUTES = config.recoveryTokenTtlMin;

export interface RecoveryTokenRow {
  id: number;
  token_hash: string;
  bound_tg_id: number;
  issued_by_admin_tg_id: number;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

export async function createToken(boundTgId: number, issuedByAdminTgId: number): Promise<string> {
  const raw = randomToken(32);
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
  await query(
    `INSERT INTO recovery_tokens (token_hash, bound_tg_id, issued_by_admin_tg_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [tokenHash, boundTgId, issuedByAdminTgId, expiresAt]
  );
  return raw;
}

export async function findByToken(rawToken: string): Promise<RecoveryTokenRow | null> {
  const tokenHash = hashToken(rawToken);
  const r = await query(
    `SELECT id, token_hash, bound_tg_id, issued_by_admin_tg_id, expires_at, used_at, created_at
     FROM recovery_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [tokenHash]
  );
  if (r.rows.length === 0) return null;
  return r.rows[0] as RecoveryTokenRow;
}

export async function markUsed(tokenHash: string): Promise<void> {
  await query(`UPDATE recovery_tokens SET used_at = NOW() WHERE token_hash = $1`, [tokenHash]);
}
