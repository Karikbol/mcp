import { Telegraf } from "telegraf";
import type { IncomingMessage, ServerResponse } from "http";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { floodProtectionHook } from "./middleware.js";
import { handleStart } from "./startHandler.js";
import { handleIssueRecovery } from "./adminHandler.js";

export function createBot(): Telegraf {
  const bot = new Telegraf(config.botToken);

  bot.use(floodProtectionHook);
  bot.command("start", handleStart);
  bot.command("issue_recovery", handleIssueRecovery);
  bot.catch((err, ctx) => {
    logger.error({ err, update: ctx.update }, "Bot error");
  });

  return bot;
}

/** Returns Express-style (req, res) handler for Fastify: use with request.raw, reply.raw */
export async function createWebhookHandler(bot: Telegraf): Promise<(req: IncomingMessage, res: ServerResponse) => Promise<void>> {
  const domain = config.webappBaseUrl.replace(/^https?:\/\//, "").split("/")[0];
  const path = config.webhook.path || "/telegram-webhook";
  const secretToken = config.webhook.secretToken || undefined;
  const webhookUrl = `${config.webappBaseUrl.startsWith("https") ? "https" : "http"}://${domain}${path}`;
  const handler = await bot.createWebhook({
    domain: domain,
    path,
    secret_token: secretToken,
  });
  return handler as (req: IncomingMessage, res: ServerResponse) => Promise<void>;
}
