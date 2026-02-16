import type { SmsProvider } from "./types.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

/** Mock SMS: log OTP and optionally send to ADMIN Telegram. Does NOT send real SMS. */
export class MockSmsProvider implements SmsProvider {
  constructor(
    private sendToAdmin: (message: string) => Promise<void>
  ) {}

  async sendOtp(phoneE164: string, code: string): Promise<boolean> {
    const masked = phoneE164.slice(0, 4) + "***" + phoneE164.slice(-2);
    logger.info({ phoneMasked: masked }, "Mock SMS OTP (logged only)");
    if (config.adminIds.length > 0) {
      try {
        await this.sendToAdmin(`🔐 Mock OTP for ${masked}: ${code}`);
      } catch (err) {
        logger.warn({ err }, "Failed to send mock OTP to admin");
      }
    }
    return true;
  }
}
