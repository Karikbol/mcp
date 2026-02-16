import { randomUUID } from "crypto";
import { query } from "./client.js";
import { config } from "../config.js";

const TTL_MINUTES = config.sessionTtlMin;

export interface AuthSessionRow {
  session_id: string;
  tg_id: number | null;
  purpose: string;
  expires_at: Date;
  created_at: Date;
}

export async function createSession(tgId: number, purpose: "register" | "login" | "recover"): Promise<string> {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
  await query(
    `INSERT INTO auth_sessions (session_id, tg_id, purpose, expires_at) VALUES ($1, $2, $3, $4)`,
    [sessionId, tgId, purpose, expiresAt]
  );
  return sessionId;
}

export async function getSession(sessionId: string): Promise<AuthSessionRow | null> {
  const r = await query(
    `SELECT session_id, tg_id, purpose, expires_at, created_at FROM auth_sessions
     WHERE session_id = $1 AND expires_at > NOW()`,
    [sessionId]
  );
  if (r.rows.length === 0) return null;
  return r.rows[0] as AuthSessionRow;
}

export async function getTgIdFromSession(sessionId: string): Promise<number | null> {
  const row = await getSession(sessionId);
  return row?.tg_id != null ? row.tg_id : null;
}

export async function deleteExpiredSessions(): Promise<void> {
  await query(`DELETE FROM auth_sessions WHERE expires_at < NOW()`);
}
