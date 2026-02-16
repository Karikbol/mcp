import { z } from "zod";
import { config } from "../config.js";
import { findByTgId, findByPhone, createUser } from "../db/users.js";
import { getSession } from "../db/authSessions.js";
import { hashPin } from "../crypto.js";
import { normalizePhone } from "../validation/phone.js";
import { log as auditLog } from "../db/auditLog.js";
import { logger } from "../logger.js";

const pinLength = config.pinLength;
const pinSchema = z.string().regex(new RegExp(`^\\d{${pinLength}}$`), `PIN must be ${pinLength} digits`);

export const registerBodySchema = z.object({
  session: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  phone_e164: z.string().min(10).max(20),
  pin: pinSchema,
}).refine((d) => (d.session ?? d.session_id) != null, { message: "session or session_id required", path: ["session"] });

export type RegisterBody = z.infer<typeof registerBodySchema>;

export async function registerUser(body: RegisterBody): Promise<
  | { ok: true }
  | { ok: false; error: "session_invalid" }
  | { ok: false; error: "phone_exists" }
  | { ok: false; error: "validation"; message: string }
> {
  const parsed = registerBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "validation", message: parsed.error.flatten().formErrors.join(" ") };
  }
  const data = parsed.data;
  const sessionId = data.session ?? data.session_id;
  if (!sessionId) {
    return { ok: false, error: "validation", message: "session required" };
  }
  const { first_name, last_name, phone_e164, pin } = data;

  const sessionRow = await getSession(sessionId);
  if (!sessionRow || sessionRow.purpose !== "register") {
    return { ok: false, error: "session_invalid" };
  }
  const tgId = sessionRow.tg_id;
  if (tgId == null) {
    return { ok: false, error: "session_invalid" };
  }

  const e164 = normalizePhone(phone_e164);
  if (!e164) {
    return { ok: false, error: "validation", message: "Invalid phone number" };
  }

  const existingByPhone = await findByPhone(e164);
  if (existingByPhone) {
    await auditLog("register_conflict", { tgId, meta: { reason: "phone_exists" } });
    return { ok: false, error: "phone_exists" };
  }

  const existingByTg = await findByTgId(tgId);
  if (existingByTg) {
    await auditLog("register_conflict", { tgId, meta: { reason: "already_registered" } });
    return { ok: false, error: "validation", message: "Already registered" };
  }

  const pinHash = await hashPin(pin);
  await createUser({
    tgId,
    firstName: first_name.trim(),
    lastName: last_name.trim(),
    phoneE164: e164,
    pinHash,
  });
  await auditLog("register_success", { tgId, meta: { phone_masked: "****" + e164.slice(-4) } });
  logger.info({ tgId, phoneMasked: "****" + e164.slice(-4) }, "User registered");
  return { ok: true };
}
