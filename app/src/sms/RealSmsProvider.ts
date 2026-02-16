import type { SmsProvider } from "./types.js";
import { logger } from "../logger.js";

/**
 * Placeholder for real SMS provider (Twilio, etc.).
 * Set SMS_PROVIDER=real and configure provider env keys to use.
 */
export class RealSmsProvider implements SmsProvider {
  async sendOtp(_phoneE164: string, _code: string): Promise<boolean> {
    logger.warn("RealSmsProvider not implemented; use SMS_PROVIDER=mock or implement provider");
    return false;
  }
}
