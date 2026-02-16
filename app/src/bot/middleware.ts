import type { Context } from "telegraf";
import { checkFlood, getBlockMessage } from "../services/flood.js";
import { logger } from "../logger.js";

/**
 * Flood protection: in-memory window, optional hard block.
 * When blocked: do not process; ACK only (no reply after one-time block message).
 */
export async function floodProtectionHook(ctx: Context, next: () => Promise<void>): Promise<void> {
  const tgId = ctx.from?.id;
  if (tgId == null) {
    return next();
  }

  try {
    const now = Date.now();
    const { allowed, sendBlockMessage } = checkFlood(tgId, now);

    if (!allowed) {
      if (sendBlockMessage) {
        try {
          await ctx.reply(getBlockMessage());
        } catch (err) {
          logger.warn({ err, tgId }, "Flood block message send failed");
        }
      }
      return;
    }

    return next();
  } catch (err) {
    logger.error({ err, tgId }, "Flood middleware error");
    return next();
  }
}
