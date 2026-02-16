import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

import { config } from "./config.js";
import { logger } from "./logger.js";
import { closePool } from "./db/client.js";
import { createBot, createWebhookHandler } from "./bot/index.js";
import { registerApiRoutes } from "./routes/api.js";
import { registerWebappRoutes } from "./routes/webapp.js";
import { LicenseGuard } from "./license.js";
import { requireTelegram } from "./middleware/requireTelegram.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

async function sendToAdmin(_message: string): Promise<void> {
  if (config.adminIds.length === 0) return;
  try {
    const { Telegraf } = await import("telegraf");
    const bot = new Telegraf(config.botToken);
    for (const chatId of config.adminIds) {
      await bot.telegram.sendMessage(chatId, _message).catch(() => {});
    }
  } catch (_) {}
}

async function main() {
  const ok = await LicenseGuard.validate();
  if (!ok) {
    logger.warn("License validation failed; continuing in stub mode");
  }

  const app = Fastify({
    logger: false,
    bodyLimit: 64 * 1024,
    connectionTimeout: 10_000,
    requestTimeout: 10_000,
  });

  app.addHook("preHandler", async (request, reply) => {
    await requireTelegram(request, reply);
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Frame-Options", "SAMEORIGIN");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' https://telegram.org; connect-src 'self'; style-src 'self' 'unsafe-inline';"
    );
    return payload;
  });

  await app.register(fastifyCors, {
    origin: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-telegram-init-data"],
  });

  await registerWebappRoutes(app);
  await registerApiRoutes(app, sendToAdmin);

  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: "/",
  });

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  const bot = createBot();

  if (config.webhook.enabled && config.webhook.path) {
    const webhookHandler = await createWebhookHandler(bot);
    app.all(config.webhook.path, async (request, reply) => {
      await webhookHandler(request.raw, reply.raw);
    });
    logger.info({ path: config.webhook.path }, "Webhook registered");
  } else {
    bot.launch().then(() => logger.info("Bot polling started")).catch((err) => logger.error({ err }, "Bot launch failed"));
  }

  await app.listen({ port: config.port, host: "0.0.0.0" });
  logger.info({ port: config.port }, "Telegram Bot Platform listening");
}

process.on("SIGINT", async () => {
  await closePool();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await closePool();
  process.exit(0);
});

main().catch((err) => {
  logger.error({ err }, "Startup failed");
  process.exit(1);
});
