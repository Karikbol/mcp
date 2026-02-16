import { config } from "./config.js";
import { logger } from "./logger.js";

/** Stub for future commercial licensing. Validates format only; no server call yet. */
export const LicenseGuard = {
  isEnabled(): boolean {
    return Boolean(config.license.key);
  },

  /** Validate license format and log. Returns true to allow operation; later replace with signed lease verification. */
  async validate(): Promise<boolean> {
    if (!config.license.key) {
      return true;
    }
    // Format check: e.g. XXXXX-XXXXX-XXXXX (placeholder)
    const formatOk = /^[A-Za-z0-9-]{10,200}$/.test(config.license.key);
    if (!formatOk) {
      logger.warn({ keyPrefix: config.license.key.slice(0, 8) }, "Invalid license key format");
      return false;
    }
    logger.info("License check skipped in dev (stub)");
    return true;
  },
};
