import { parsePhoneNumber, type CountryCode } from "libphonenumber-js";
import { z } from "zod";

export function normalizePhone(phone: string, defaultCountry?: CountryCode): string | null {
  try {
    const parsed = parsePhoneNumber(phone, defaultCountry ?? "RU");
    return parsed?.isValid() ? parsed.format("E.164") : null;
  } catch {
    return null;
  }
}

export const phoneE164Schema = z.string().min(10).max(20).refine(
  (val) => normalizePhone(val) !== null,
  { message: "Invalid phone number" }
);

export function validateAndNormalize(phone: string, countryCode: CountryCode = "RU"): { ok: true; e164: string } | { ok: false; error: string } {
  const e164 = normalizePhone(phone, countryCode);
  if (!e164) return { ok: false, error: "Invalid phone number" };
  return { ok: true, e164 };
}
