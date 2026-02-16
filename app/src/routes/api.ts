import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { registerUser, registerBodySchema } from "../api/register.js";
import { getLoginUser } from "../api/login.js";
import {
  requestOtp,
  verifyOtpStep,
  verifyPinAndRecover,
} from "../api/recover.js";
import { getSession } from "../db/authSessions.js";
import { findByToken } from "../db/recoveryTokens.js";
import { log as auditLog } from "../db/auditLog.js";
import { checkRateLimit } from "../services/rateLimit.js";

type SendToAdmin = (message: string) => Promise<void>;

function ensureTgUser(request: FastifyRequest): request is FastifyRequest & { tgUser: { id: number; username?: string } } {
  return request.tgUser != null && typeof request.tgUser.id === "number";
}

export async function registerApiRoutes(
  app: FastifyInstance,
  sendToAdmin: SendToAdmin
): Promise<void> {
  app.post<{ Body: unknown }>("/api/register", async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
    if (!ensureTgUser(request)) return reply.code(403).send({ error: "Open this page inside Telegram." });
    const rl = checkRateLimit(request.tgUser.id, false);
    if (!rl.allowed) {
      await auditLog("rate_limit_exceeded", { tgId: request.tgUser.id, meta: { route: "register" } });
      return reply.code(429).send({ error: "Too many requests" });
    }
    const parsed = registerBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation", message: parsed.error.flatten().formErrors.join(" ") });
    }
    const sessionId = parsed.data.session ?? parsed.data.session_id;
    if (!sessionId) return reply.code(400).send({ error: "validation", message: "session required" });
    const session = await getSession(sessionId);
    if (!session || session.purpose !== "register" || session.tg_id == null) {
      return reply.code(401).send({ error: "session_invalid" });
    }
    if (session.tg_id !== request.tgUser.id) {
      return reply.code(401).send({ error: "session_invalid" });
    }
    const result = await registerUser(parsed.data);
    if (result.ok) return reply.send({ success: true });
    if (result.error === "session_invalid") return reply.code(401).send({ error: "session_invalid" });
    if (result.error === "phone_exists") return reply.code(409).send({ error: "phone_exists", message: "Номер телефона уже зарегистрирован." });
    return reply.code(400).send({ error: result.error, message: result.message });
  });

  app.get<{ Querystring: { session?: string } }>("/api/login", async (request, reply) => {
    if (!ensureTgUser(request)) return reply.code(403).send({ error: "Open this page inside Telegram." });
    const rl = checkRateLimit(request.tgUser.id, false);
    if (!rl.allowed) {
      await auditLog("rate_limit_exceeded", { tgId: request.tgUser.id, meta: { route: "login" } });
      return reply.code(429).send({ error: "Too many requests" });
    }
    const sessionId = request.query?.session;
    if (!sessionId) return reply.code(400).send({ error: "session_required" });
    const session = await getSession(sessionId);
    if (!session || session.purpose !== "login" || session.tg_id == null) {
      return reply.code(401).send({ error: "session_invalid" });
    }
    if (session.tg_id !== request.tgUser.id) {
      return reply.code(401).send({ error: "session_invalid" });
    }
    const result = await getLoginUser(sessionId);
    if (!result.ok) return reply.code(401).send({ error: result.error });
    return reply.send(result.user);
  });

  const neutralOtpResponse = { message: "Если данные верны — код отправлен." };

  app.post<{ Body: { token?: string; phone_e164?: string } }>(
    "/api/recover/request-otp",
    async (request, reply) => {
      if (!ensureTgUser(request)) return reply.code(403).send({ error: "Open this page inside Telegram." });
      const rl = checkRateLimit(request.tgUser.id, true);
      if (!rl.allowed) {
        await auditLog("rate_limit_exceeded", { tgId: request.tgUser.id, meta: { route: "recover/request-otp" } });
        return reply.code(429).send({ error: "Too many requests" });
      }
      const { token, phone_e164 } = request.body ?? {};
      if (!token || !phone_e164) return reply.code(400).send({ error: "token and phone_e164 required" });
      const tokenRow = await findByToken(token);
      if (!tokenRow || tokenRow.bound_tg_id !== request.tgUser!.id) {
        return reply.code(401).send({ error: "token_invalid" });
      }
      const result = await requestOtp(token, phone_e164, sendToAdmin);
      if (result.ok) return reply.send(neutralOtpResponse);
      if (result.error === "token_invalid") return reply.code(401).send({ error: "token_invalid" });
      return reply.send(neutralOtpResponse);
    }
  );

  app.post<{ Body: { token?: string; phone_e164?: string; otp?: string; code?: string } }>(
    "/api/recover/verify-otp",
    async (request, reply) => {
      if (!ensureTgUser(request)) return reply.code(403).send({ error: "Open this page inside Telegram." });
      const rl = checkRateLimit(request.tgUser.id, true);
      if (!rl.allowed) {
        await auditLog("rate_limit_exceeded", { tgId: request.tgUser.id, meta: { route: "recover/verify-otp" } });
        return reply.code(429).send({ error: "Too many requests" });
      }
      const body = request.body ?? {};
      const { token, phone_e164 } = body;
      const otp = (body as { otp?: string }).otp ?? (body as { code?: string }).code;
      if (!token || !phone_e164 || !otp) return reply.code(400).send({ error: "token, phone_e164 and otp required" });
      const tokenRow = await findByToken(token);
      if (!tokenRow || tokenRow.bound_tg_id !== request.tgUser!.id) {
        return reply.code(401).send({ error: "token_invalid" });
      }
      const result = await verifyOtpStep(token, phone_e164, otp, sendToAdmin);
      if (result.ok) return reply.send({ success: true });
      if (result.error === "token_invalid") return reply.code(401).send({ error: "token_invalid" });
      if (result.error === "attempts_exceeded") return reply.code(403).send({ error: "attempts_exceeded", message: "Обратитесь к администратору." });
      return reply.code(400).send({ error: "wrong_code", message: "Неверный код" });
    }
  );

  app.post<{ Body: { token?: string; phone_e164?: string; pin?: string } }>(
    "/api/recover/verify-pin",
    async (request, reply) => {
      if (!ensureTgUser(request)) return reply.code(403).send({ error: "Open this page inside Telegram." });
      const rl = checkRateLimit(request.tgUser.id, true);
      if (!rl.allowed) {
        await auditLog("rate_limit_exceeded", { tgId: request.tgUser.id, meta: { route: "recover/verify-pin" } });
        return reply.code(429).send({ error: "Too many requests" });
      }
      const { token, phone_e164, pin } = request.body ?? {};
      if (!token || !phone_e164 || !pin) return reply.code(400).send({ error: "token, phone_e164 and pin required" });
      const tokenRow = await findByToken(token);
      if (!tokenRow || tokenRow.bound_tg_id !== request.tgUser!.id) {
        return reply.code(401).send({ error: "token_invalid" });
      }
      const result = await verifyPinAndRecover(token, phone_e164, pin, sendToAdmin);
      if (result.ok) return reply.send({ success: true });
      if (result.error === "token_invalid" || result.error === "phone_not_found") return reply.code(401).send({ error: "generic", message: "Ошибка. Обратитесь к администратору." });
      if (result.error === "attempts_exceeded" || result.error === "recovery_locked") return reply.code(403).send({ error: "attempts_exceeded", message: "Обратитесь к администратору." });
      return reply.code(400).send({ error: "wrong_pin", message: "Неверный PIN" });
    }
  );
}
