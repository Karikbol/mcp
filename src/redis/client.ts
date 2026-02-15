import { createRequire } from "node:module";
import { config } from "../config.js";
import { logger } from "../logger.js";

const require = createRequire(import.meta.url);
const Redis = require("ioredis");

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 100, 3000)),
});

redis.on("error", (err: Error) => logger.error({ err }, "Redis error"));
redis.on("connect", () => logger.debug("Redis connected"));

export async function closeRedis(): Promise<void> {
  await redis.quit();
}
