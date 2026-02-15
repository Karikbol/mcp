import { FastifyRequest, FastifyReply } from "fastify";
import { logger } from "../logger.js";

const SENSITIVE_PARAMS = ["token", "password", "secret", "api_key", "authorization"];

function maskParams(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_PARAMS.some((s) => lower.includes(s))) {
      out[k] = "***MASKED***";
    } else {
      out[k] = typeof v === "object" && v ? maskParams(v) : v;
    }
  }
  return out;
}

export function createAuditContext() {
  return {
    toolName: null as string | null,
    params: null as unknown,
    userId: null as string | null,
    ip: null as string | null,
    startTime: Date.now(),
  };
}

export function auditLog(
  ctx: ReturnType<typeof createAuditContext>,
  status: "ok" | "error",
  result?: unknown
) {
  const latencyMs = Date.now() - ctx.startTime;
  logger.info(
    {
      tool: ctx.toolName,
      params: ctx.params ? maskParams(ctx.params) : undefined,
      userId: ctx.userId,
      ip: ctx.ip,
      status,
      latencyMs,
      result: status === "error" ? result : undefined,
    },
    "Audit"
  );
}
