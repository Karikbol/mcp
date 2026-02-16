import { z } from "zod";
import { query } from "../db/client.js";
import { config } from "../config.js";
import { complete } from "../llm/router.js";
import { logger } from "../logger.js";
import * as vpsFs from "./vpsFs.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

function ok(text: string, isError = false): CallToolResult {
  return {
    content: [
      { type: "text" as const, text },
    ],
    isError,
  };
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("Timeout")), 5000)
        ),
      ]);
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

export const toolHandlers = {
  health: async (): Promise<CallToolResult> => {
    return ok("OK");
  },

  "services.list": async (): Promise<CallToolResult> => {
    const r = await query(
      "SELECT id, name, price, is_active FROM services WHERE is_active = true ORDER BY id"
    );
    return ok(JSON.stringify(r.rows, null, 2));
  },

  "orders.create": async (params: {
    service_id: number;
    user_id: number;
    payload?: Record<string, unknown>;
  }): Promise<CallToolResult> => {
    const { service_id, user_id, payload } = params;
    const r = await query(
      `INSERT INTO orders (user_id, service_id, status, payload_json)
       VALUES ($1, $2, 'pending', $3)
       RETURNING id, user_id, service_id, status, created_at`,
      [user_id, service_id, payload ? JSON.stringify(payload) : null]
    );
    const row = r.rows[0];
    return ok(
      JSON.stringify(
        { id: row.id, user_id: row.user_id, service_id: row.service_id, status: row.status, created_at: row.created_at },
        null,
        2
      )
    );
  },

  "orders.status": async (params: { id: number }): Promise<CallToolResult> => {
    const r = await query(
      "SELECT id, user_id, service_id, status, payload_json, created_at, updated_at FROM orders WHERE id = $1",
      [params.id]
    );
    if (!r.rows[0]) return ok('{"error":"Order not found"}', true);
    return ok(JSON.stringify(r.rows[0], null, 2));
  },

  "providers.quote": async (params: {
    order_id?: number;
    provider?: string;
  }): Promise<CallToolResult> => {
    const result = await withRetry(async () => {
      await new Promise((r) => setTimeout(r, 100));
      return {
        provider: params.provider ?? "emulated",
        order_id: params.order_id ?? null,
        quote: { amount: 99.99, currency: "USD", expires_at: new Date(Date.now() + 3600000).toISOString() },
      };
    });
    return ok(JSON.stringify(result, null, 2));
  },

  "admin.ai_chat": async (params: {
    message: string;
    user_id: string;
  }): Promise<CallToolResult> => {
    if (!params.user_id || !config.adminIds.includes(params.user_id)) {
      return ok('{"error":"Forbidden: admin only. Pass user_id from ADMIN_IDS."}', true);
    }
    try {
      const resp = await complete(params.message);
      return ok(
        JSON.stringify(
          { content: resp.content, model: resp.model, latencyMs: resp.latencyMs },
          null,
          2
        )
      );
    } catch (e) {
      logger.error({ err: e }, "admin.ai_chat LLM error");
      return ok(JSON.stringify({ error: String(e) }), true);
    }
  },

  "vps.fs_list": (params: { path?: string }) => vpsFs.fsList(params),
  "vps.fs_copy": (params: { source: string; destination: string }) => vpsFs.fsCopy(params),
  "vps.fs_move": (params: { source: string; destination: string }) => vpsFs.fsMove(params),
  "vps.shell_exec": (params: { command: string; cwd?: string }) => vpsFs.shellExec(params),
};

export const toolSchemas = {
  health: { _: z.object({}) },
  "services.list": { _: z.object({}) },
  "orders.create": {
    service_id: z.number(),
    user_id: z.number(),
    payload: z.record(z.unknown()).optional(),
  },
  "orders.status": { id: z.number() },
  "providers.quote": {
    order_id: z.number().optional(),
    provider: z.string().optional(),
  },
  "admin.ai_chat": { message: z.string(), user_id: z.string() },
  "vps.fs_list": { path: z.string().optional() },
  "vps.fs_copy": { source: z.string(), destination: z.string() },
  "vps.fs_move": { source: z.string(), destination: z.string() },
  "vps.shell_exec": { command: z.string(), cwd: z.string().optional() },
} as const;
