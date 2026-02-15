import pino from "pino";
import { config } from "./config.js";

const SENSITIVE_KEYS = [
  "token",
  "password",
  "secret",
  "api_key",
  "apikey",
  "authorization",
  "bearer",
];

function maskObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_KEYS.some((sk) => lower.includes(sk))) {
      out[k] = typeof v === "string" ? "***MASKED***" : "***MASKED***";
    } else if (v && typeof v === "object" && !Array.isArray(v) && v !== null) {
      out[k] = maskObject(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export const logger = pino({
  level: config.nodeEnv === "production" ? "info" : "debug",
  transport:
    config.nodeEnv === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true } },
  serializers: {
    req: (req: { headers?: Record<string, string>; body?: unknown }) => {
      const headers = { ...req.headers };
      if (headers.authorization) headers.authorization = "Bearer ***MASKED***";
      return {
        method: (req as Record<string, unknown>).method,
        url: (req as Record<string, unknown>).url,
        headers,
        body: req.body
          ? maskObject(req.body as Record<string, unknown>)
          : undefined,
      };
    },
  },
});
