import type { TelegrafContext } from "../types.js";
import { config } from "../config.js";
import { createToken } from "../db/recoveryTokens.js";
import { logger } from "../logger.js";

const WEBAPP_BASE = config.webappBaseUrl;

function isAdmin(tgId: number): boolean {
  return config.adminIds.includes(tgId);
}

/** Admin-only: /issue_recovery <tg_id> — creates recovery token for the given (new) Telegram ID and returns recovery URL. */
export async function handleIssueRecovery(ctx: TelegrafContext): Promise<void> {
  const fromId = ctx.from?.id;
  if (!fromId) return;
  if (!isAdmin(fromId)) {
    await ctx.reply("Доступ запрещён.").catch(() => {});
    return;
  }

  const text = (ctx.message && "text" in ctx.message ? ctx.message.text : "") ?? "";
  const parts = text.trim().split(/\s+/);
  const tgIdStr = parts[1];
  if (!tgIdStr) {
    await ctx.reply("Использование: /issue_recovery <tg_id>").catch(() => {});
    return;
  }
  const boundTgId = parseInt(tgIdStr, 10);
  if (Number.isNaN(boundTgId) || boundTgId <= 0) {
    await ctx.reply("Некорректный tg_id.").catch(() => {});
    return;
  }

  try {
    const token = await createToken(boundTgId, fromId);
    const url = `${WEBAPP_BASE}/webapp/recover?token=${encodeURIComponent(token)}`;
    await ctx.reply(`Токен восстановления для tg_id=${boundTgId}:\n\n${url}`, {
      parse_mode: undefined,
    });
    logger.info({ adminTgId: fromId, boundTgId }, "Recovery token issued");
  } catch (err) {
    logger.error({ err, adminTgId: fromId }, "Failed to issue recovery token");
    await ctx.reply("Ошибка создания токена.").catch(() => {});
  }
}
