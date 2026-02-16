import { query } from "./client.js";

export async function log(
  event: string,
  params: { tgId?: number; phoneE164?: string; meta?: Record<string, unknown> }
): Promise<void> {
  const meta = params.meta != null ? JSON.stringify(params.meta) : "{}";
  await query(
    `INSERT INTO audit_log (event, tg_id, phone_e164, meta) VALUES ($1, $2, $3, $4::jsonb)`,
    [event, params.tgId ?? null, params.phoneE164 ?? null, meta]
  );
}
