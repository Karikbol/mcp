import { FastifyRequest, FastifyReply } from "fastify";
import { redis } from "../redis/client.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

const IP_PREFIX = "rl:ip:";
const USER_PREFIX = "rl:user:";

function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return request.ip ?? "127.0.0.1";
}

function getUserId(request: FastifyRequest): string | null {
  const header = request.headers["x-mcp-user-id"];
  return typeof header === "string" ? header : null;
}

export async function rateLimit(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ip = getClientIp(request);
  const userId = getUserId(request);

  const ipKey = `${IP_PREFIX}${ip}`;
  const ipCount = await redis.incr(ipKey);
  if (ipCount === 1) await redis.expire(ipKey, 60);

  if (ipCount > config.rateLimit.ipPerMin) {
    logger.warn({ ip, ipCount }, "Rate limit exceeded (IP)");
    return reply.code(429).send({
      jsonrpc: "2.0",
      error: { code: -32002, message: "Too many requests (IP limit)" },
      id: null,
    });
  }

  if (userId) {
    const userKey = `${USER_PREFIX}${userId}`;
    const userCount = await redis.incr(userKey);
    if (userCount === 1) await redis.expire(userKey, 86400);

    if (userCount > config.rateLimit.userPerDay) {
      logger.warn({ userId, userCount }, "Rate limit exceeded (user)");
      return reply.code(429).send({
        jsonrpc: "2.0",
        error: { code: -32002, message: "Too many requests (user daily limit)" },
        id: null,
      });
    }
  }
}
