import { createHmac, createHash, timingSafeEqual } from "crypto";

const AUTH_DATE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export interface TelegramWebAppUser {
  id: number;
  username?: string;
  first_name?: string;
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string
): { valid: true; user: TelegramWebAppUser } | { valid: false } {
  if (!initData || typeof initData !== "string" || initData.length === 0) {
    return { valid: false };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { valid: false };

  params.delete("hash");
  const sortedKeys = Array.from(params.keys()).sort();
  const dataCheckString = sortedKeys.map((k) => `${k}=${params.get(k)}`).join("\n");

  const secretKey = createHash("sha256").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (hash.length !== computedHash.length || !timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computedHash, "hex"))) {
    return { valid: false };
  }

  const authDate = params.get("auth_date");
  if (!authDate) return { valid: false };
  const authTimestamp = parseInt(authDate, 10);
  if (Number.isNaN(authTimestamp)) return { valid: false };
  if (Date.now() - authTimestamp * 1000 > AUTH_DATE_MAX_AGE_MS) {
    return { valid: false };
  }

  const userJson = params.get("user");
  if (!userJson) return { valid: false };
  let user: { id?: number; username?: string; first_name?: string };
  try {
    user = JSON.parse(userJson) as { id?: number; username?: string; first_name?: string };
  } catch {
    return { valid: false };
  }
  if (user == null || typeof user.id !== "number") return { valid: false };

  return {
    valid: true,
    user: {
      id: user.id,
      username: user.username,
      first_name: user.first_name,
    },
  };
}
