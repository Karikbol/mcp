import type { FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config.js";
import { verifyTelegramInitData } from "../services/telegramAuth.js";

const FORBIDDEN_MSG = { error: "Open this page inside Telegram." };

function getInitData(request: FastifyRequest): string | null {
  const header = request.headers["x-telegram-init-data"];
  if (typeof header === "string" && header.length > 0) return header;
  const body = request.body as { initData?: string } | undefined;
  if (body?.initData && typeof body.initData === "string") return body.initData;
  return null;
}

function isTelegramUserAgent(request: FastifyRequest): boolean {
  const ua = request.headers["user-agent"] ?? "";
  return typeof ua === "string" && ua.toLowerCase().includes("telegram");
}

export async function requireTelegram(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const url = request.url ?? "";
  const webhookPath = config.webhook.path ?? "/telegram-webhook";
  if (url.startsWith(webhookPath) || url === webhookPath) {
    return;
  }

  const isWebapp = url.startsWith("/webapp/");
  const isApi = url.startsWith("/api/");
  if (!isWebapp && !isApi) {
    return;
  }

  const initData = getInitData(request);

  if (initData) {
    const result = verifyTelegramInitData(initData, config.botToken);
    if (!result.valid) {
      return reply.code(403).send(FORBIDDEN_MSG);
    }
    request.tgUser = { id: result.user.id, username: result.user.username };
    return;
  }

  if (isApi) {
    return reply.code(403).send(FORBIDDEN_MSG);
  }

  if (isWebapp && !isTelegramUserAgent(request)) {
    return reply.code(403).send(FORBIDDEN_MSG);
  }
}
