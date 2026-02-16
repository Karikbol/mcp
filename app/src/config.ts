import "dotenv/config";

const maskSecret = (s: string | undefined): string =>
  s ? (s.length > 8 ? s.slice(0, 4) + "***" + s.slice(-4) : "***") : "";

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "3000", 10),

  webappBaseUrl: (process.env.WEBAPP_BASE_URL ?? "https://ybrjch.qgsm.store").replace(/\/$/, ""),
  botToken: process.env.BOT_TOKEN ?? "",
  adminIds: (process.env.ADMIN_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => parseInt(id, 10))
    .filter((n) => !Number.isNaN(n)),

  database: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/telegram_bot",
  },

  /** Session TTL (minutes) for auth_sessions */
  sessionTtlMin: Math.max(5, Math.min(60, parseInt(process.env.SESSION_TTL_MIN ?? "15", 10))),

  /** Recovery token TTL (minutes) */
  recoveryTokenTtlMin: Math.max(5, Math.min(120, parseInt(process.env.RECOVERY_TOKEN_TTL_MIN ?? "30", 10))),

  /** OTP TTL (minutes) */
  otpTtlMin: Math.max(5, parseInt(process.env.OTP_TTL_MIN ?? "10", 10)),

  /** Max OTP verify attempts per recovery */
  otpMaxAttempts: Math.min(5, Math.max(1, parseInt(process.env.OTP_MAX_ATTEMPTS ?? "2", 10))),

  /** Max OTP sends per recovery (request-otp) */
  otpMaxSends: Math.min(5, Math.max(1, parseInt(process.env.OTP_MAX_SENDS ?? "2", 10))),

  /** Max PIN attempts per recovery */
  pinMaxAttempts: Math.min(5, Math.max(1, parseInt(process.env.PIN_MAX_ATTEMPTS ?? "3", 10))),

  /** Recovery lock duration (hours) after OTP or PIN exhaustion */
  recoveryLockHours: Math.max(1, Math.min(168, parseInt(process.env.RECOVERY_LOCK_HOURS ?? "24", 10))),

  /** PIN length (digits); fixed 6 for plan */
  pinLength: 6 as const,

  webhook: {
    enabled: process.env.USE_POLLING !== "true",
    path: process.env.WEBHOOK_PATH ?? "/telegram-webhook",
    secretToken: process.env.WEBHOOK_SECRET_TOKEN ?? "",
  },

  flood: {
    enabled: process.env.FLOOD_PROTECTION_ENABLED === "true",
    hardBlockEnabled: process.env.FLOOD_HARD_BLOCK_ENABLED === "true",
    windowSec: Math.max(1, Math.min(60, parseInt(process.env.FLOOD_WINDOW_SEC ?? "2", 10))),
    maxEvents: Math.max(2, Math.min(50, parseInt(process.env.FLOOD_MAX_EVENTS ?? "5", 10))),
    blockMin: Math.max(1, Math.min(1440, parseInt(process.env.FLOOD_BLOCK_MIN ?? "30", 10))),
  },

  smsProvider: (process.env.SMS_PROVIDER ?? "mock").toLowerCase() === "real" ? "real" : "mock",

  license: {
    key: process.env.LICENSE_KEY ?? "",
    serverUrl: process.env.LICENSE_SERVER_URL ?? "",
  },

  /** Optional secret for token hashing (sha256(token + secret)) */
  tokenHashSecret: process.env.TOKEN_HASH_SECRET ?? "",
} as const;

export const configSafe = {
  ...config,
  botToken: maskSecret(config.botToken),
  webhook: { ...config.webhook, secretToken: config.webhook.secretToken ? "***" : "" },
  license: { ...config.license, key: config.license.key ? "***" : "" },
  tokenHashSecret: config.tokenHashSecret ? "***" : "",
};
