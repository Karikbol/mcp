import { query } from "./client.js";

export interface UserRow {
  id: number;
  tg_id: number;
  tg_id_prev: number | null;
  first_name: string;
  last_name: string;
  phone_e164: string;
  pin_hash: string;
  role: string;
  recovered_flag: boolean;
  recovered_at: Date | null;
  recovered_count: number;
  recovery_locked_until: Date | null;
  last_seen_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export async function findByTgId(tgId: number): Promise<UserRow | null> {
  const r = await query(
    `SELECT id, tg_id, tg_id_prev, first_name, last_name, phone_e164, pin_hash, role,
            recovered_flag, recovered_at, recovered_count, recovery_locked_until,
            last_seen_at, created_at, updated_at FROM users WHERE tg_id = $1`,
    [tgId]
  );
  if (r.rows.length === 0) return null;
  return r.rows[0] as UserRow;
}

export async function findByPhone(phoneE164: string): Promise<UserRow | null> {
  const r = await query(
    `SELECT id, tg_id, tg_id_prev, first_name, last_name, phone_e164, pin_hash, role,
            recovered_flag, recovered_at, recovered_count, recovery_locked_until,
            last_seen_at, created_at, updated_at FROM users WHERE phone_e164 = $1`,
    [phoneE164]
  );
  if (r.rows.length === 0) return null;
  return r.rows[0] as UserRow;
}

export async function createUser(params: {
  tgId: number;
  firstName: string;
  lastName: string;
  phoneE164: string;
  pinHash: string;
}): Promise<UserRow> {
  const r = await query(
    `INSERT INTO users (tg_id, first_name, last_name, phone_e164, pin_hash, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id, tg_id, tg_id_prev, first_name, last_name, phone_e164, pin_hash, role,
               recovered_flag, recovered_at, recovered_count, recovery_locked_until,
               last_seen_at, created_at, updated_at`,
    [params.tgId, params.firstName, params.lastName, params.phoneE164, params.pinHash]
  );
  return r.rows[0] as UserRow;
}

export async function updateLastSeen(tgId: number): Promise<void> {
  await query(`UPDATE users SET last_seen_at = NOW(), updated_at = NOW() WHERE tg_id = $1`, [tgId]);
}

export async function performRecovery(params: {
  userId: number;
  newTgId: number;
}): Promise<void> {
  await query(
    `UPDATE users SET
       tg_id_prev = tg_id,
       tg_id = $2,
       recovered_flag = true,
       recovered_at = NOW(),
       recovered_count = recovered_count + 1,
       recovery_locked_until = NULL,
       updated_at = NOW()
     WHERE id = $1`,
    [params.userId, params.newTgId]
  );
}

export async function setRecoveryLockedUntil(userId: number, until: Date): Promise<void> {
  await query(
    `UPDATE users SET recovery_locked_until = $2, updated_at = NOW() WHERE id = $1`,
    [userId, until]
  );
}
