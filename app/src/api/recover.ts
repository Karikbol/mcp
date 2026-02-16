import { config } from "../config.js";
import { findByToken, markUsed } from "../db/recoveryTokens.js";
import { findByPhone, performRecovery, setRecoveryLockedUntil } from "../db/users.js";
import {
  createOrUpdateOtp,
  getActiveOtp,
  getAttempts,
  incrementAttempts,
  incrementPinAttempts,
} from "../db/otpCodes.js";
import { log as auditLog } from "../db/auditLog.js";
import { hashToken } from "../crypto.js";
import { verifyPin, hashOtp, verifyOtp } from "../crypto.js";
import { normalizePhone } from "../validation/phone.js";
import { createSmsProvider } from "../sms/index.js";
import { logger } from "../logger.js";

const NEUTRAL_MSG = "Если данные верны — код отправлен.";
const DELAY_MS_MIN = 900;
const DELAY_MS_MAX = 1300;

function delayWhenPhoneNotFound(): Promise<void> {
  const ms = DELAY_MS_MIN + Math.random() * (DELAY_MS_MAX - DELAY_MS_MIN);
  return new Promise((r) => setTimeout(r, ms));
}

function maskPhone(phoneE164: string): string {
  if (phoneE164.length < 4) return "****";
  return "****" + phoneE164.slice(-4);
}

export type RequestOtpResult =
  | { ok: true }
  | { ok: false; error: "token_invalid" }
  | { ok: false; error: "recovery_locked" }
  | { ok: false; error: "send_limit" };

export async function requestOtp(
  token: string,
  phoneE164: string,
  sendToAdmin: (msg: string) => Promise<void>
): Promise<RequestOtpResult> {
  const tokenRow = await findByToken(token);
  if (!tokenRow) {
    return { ok: false, error: "token_invalid" };
  }

  const e164 = normalizePhone(phoneE164);
  if (!e164) {
    return { ok: false, error: "token_invalid" };
  }

  const user = await findByPhone(e164);
  if (user?.recovery_locked_until && user.recovery_locked_until > new Date()) {
    await auditLog("recovery_locked_attempt", {
      tgId: tokenRow.bound_tg_id,
      meta: { phone_masked: maskPhone(e164) },
    });
    await delayWhenPhoneNotFound();
    return { ok: false, error: "recovery_locked" };
  }

  const crypto = await import("crypto");
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpHash = await hashOtp(otp);

  const id = await createOrUpdateOtp(e164, otpHash);
  if (id === 0) {
    return { ok: false, error: "send_limit" };
  }

  if (user) {
    const sms = createSmsProvider(sendToAdmin);
    await sms.sendOtp(e164, otp);
  } else {
    await auditLog("recovery_phone_not_found", {
      tgId: tokenRow.bound_tg_id,
      meta: { phone_masked: maskPhone(e164) },
    });
    await sendToAdmin(
      `⚠️ Recovery: OTP requested for unknown phone ${maskPhone(e164)}, bound_tg_id=${tokenRow.bound_tg_id}`
    ).catch(() => {});
  }

  await delayWhenPhoneNotFound();
  return { ok: true };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; error: "token_invalid" }
  | { ok: false; error: "wrong_code" }
  | { ok: false; error: "attempts_exceeded" };

export async function verifyOtpStep(
  token: string,
  phoneE164: string,
  otp: string,
  sendToAdmin?: (msg: string) => Promise<void>
): Promise<VerifyOtpResult> {
  const tokenRow = await findByToken(token);
  if (!tokenRow) return { ok: false, error: "token_invalid" };

  const e164 = normalizePhone(phoneE164) ?? phoneE164;
  const userForLock = await findByPhone(e164);
  if (userForLock?.recovery_locked_until && userForLock.recovery_locked_until > new Date()) {
    await auditLog("recovery_locked_attempt", {
      tgId: tokenRow.bound_tg_id,
      meta: { phone_masked: maskPhone(e164) },
    });
    await delayWhenPhoneNotFound();
    return { ok: false, error: "attempts_exceeded" };
  }

  const row = await getActiveOtp(e164);

  const lockUser = async (reason: string): Promise<void> => {
    const user = await findByPhone(e164);
    if (user) {
      const lockUntil = new Date(Date.now() + config.recoveryLockHours * 60 * 60 * 1000);
      await setRecoveryLockedUntil(user.id, lockUntil);
      await markUsed(hashToken(token));
      await auditLog("recovery_locked", {
        tgId: tokenRow.bound_tg_id,
        meta: { reason, phone_masked: maskPhone(e164) },
      });
      if (sendToAdmin) {
        await sendToAdmin(`⚠️ Recovery locked (${reason}) for ${maskPhone(e164)}, tg_id=${tokenRow.bound_tg_id}`).catch(() => {});
      }
    }
  };

  if (!row) {
    await delayWhenPhoneNotFound();
    return { ok: false, error: "wrong_code" };
  }

  if (row.attempts >= config.otpMaxAttempts) {
    await lockUser("otp_attempts");
    return { ok: false, error: "attempts_exceeded" };
  }

  const valid = await verifyOtp(otp, row.otp_hash);
  if (!valid) {
    await incrementAttempts(e164);
    const attempts = await getAttempts(e164);
    if (attempts >= config.otpMaxAttempts) {
      await lockUser("otp_attempts");
      return { ok: false, error: "attempts_exceeded" };
    }
    await delayWhenPhoneNotFound();
    return { ok: false, error: "wrong_code" };
  }
  return { ok: true };
}

export type VerifyPinResult =
  | { ok: true }
  | { ok: false; error: "token_invalid" }
  | { ok: false; error: "phone_not_found" }
  | { ok: false; error: "wrong_pin" }
  | { ok: false; error: "attempts_exceeded" }
  | { ok: false; error: "recovery_locked" };

export async function verifyPinAndRecover(
  token: string,
  phoneE164: string,
  pin: string,
  sendToAdmin?: (msg: string) => Promise<void>
): Promise<VerifyPinResult> {
  const tokenRow = await findByToken(token);
  if (!tokenRow) return { ok: false, error: "token_invalid" };

  const e164 = normalizePhone(phoneE164) ?? phoneE164;
  const user = await findByPhone(e164);
  if (!user) {
    await delayWhenPhoneNotFound();
    return { ok: false, error: "phone_not_found" };
  }

  if (user.recovery_locked_until && user.recovery_locked_until > new Date()) {
    await auditLog("recovery_locked_attempt", {
      tgId: tokenRow.bound_tg_id,
      meta: { phone_masked: maskPhone(e164) },
    });
    await delayWhenPhoneNotFound();
    return { ok: false, error: "recovery_locked" };
  }

  const row = await getActiveOtp(e164);
  if (!row) {
    await delayWhenPhoneNotFound();
    return { ok: false, error: "token_invalid" };
  }

  const pinValid = await verifyPin(pin, user.pin_hash);
  if (!pinValid) {
    await auditLog("recover_pin_fail", {
      tgId: tokenRow.bound_tg_id,
      meta: { phone_masked: maskPhone(e164) },
    });
    const nextPinAttempts = await incrementPinAttempts(e164);
    if (nextPinAttempts >= config.pinMaxAttempts) {
      const lockUntil = new Date(Date.now() + config.recoveryLockHours * 60 * 60 * 1000);
      await setRecoveryLockedUntil(user.id, lockUntil);
      await markUsed(hashToken(token));
      await auditLog("recovery_locked", {
        tgId: tokenRow.bound_tg_id,
        meta: { reason: "pin_attempts", phone_masked: maskPhone(e164) },
      });
      if (sendToAdmin) {
        await sendToAdmin(
          `⚠️ Recovery locked (pin attempts) for ${maskPhone(e164)}, tg_id=${tokenRow.bound_tg_id}`
        ).catch(() => {});
      }
      return { ok: false, error: "attempts_exceeded" };
    }
    await delayWhenPhoneNotFound();
    return { ok: false, error: "wrong_pin" };
  }

  await performRecovery({ userId: user.id, newTgId: tokenRow.bound_tg_id });
  await markUsed(hashToken(token));
  await auditLog("recovery_success", {
    tgId: tokenRow.bound_tg_id,
    meta: { old_tg_id: user.tg_id, new_tg_id: tokenRow.bound_tg_id, phone_masked: maskPhone(e164) },
  });
  if (sendToAdmin) {
    await sendToAdmin(
      `Recovery success for phone ${maskPhone(e164)}, old tg_id=${user.tg_id} -> new tg_id=${tokenRow.bound_tg_id}`
    ).catch(() => {});
  }

  return { ok: true };
}
