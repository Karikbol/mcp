import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toolHandlers } from "../tools/index.js";
import { createAuditContext, auditLog } from "../middleware/audit.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

function userIdFromParams(params: unknown): string | null {
  const p = params as { user_id?: string | number };
  if (p?.user_id != null) return String(p.user_id);
  return null;
}

export function createMcpServer() {
  const server = new McpServer(
    { name: "telegram-bot-mcp", version: "1.0.0" },
    { capabilities: { logging: {} } }
  );

  const wrapTool = <T>(name: string, handler: (params: T) => Promise<CallToolResult>) => {
    return async (params: unknown): Promise<CallToolResult> => {
      const ctx = createAuditContext();
      ctx.toolName = name;
      ctx.params = params;
      ctx.userId = userIdFromParams(params);

      try {
        const userId = (params as { user_id?: string })?.user_id ?? ctx.userId;
        const result =
          name === "admin.ai_chat"
            ? await toolHandlers["admin.ai_chat"]({ ...(params as { message: string }), user_id: userId ?? "" })
            : await handler(params as T);
        auditLog(ctx, result.isError ? "error" : "ok");
        return result;
      } catch (err) {
        auditLog(ctx, "error", err);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: String(err) }) }],
          isError: true,
        };
      }
    };
  };

  server.registerTool(
    "health",
    {
      description: "Health check - returns OK",
      inputSchema: z.object({}),
    },
    wrapTool("health", toolHandlers.health)
  );

  server.registerTool(
    "services_list",
    {
      description: "List active services from database",
      inputSchema: z.object({}),
    },
    wrapTool("services.list", toolHandlers["services.list"])
  );

  server.registerTool(
    "orders_create",
    {
      description: "Create a new order",
      inputSchema: z.object({
        service_id: z.number().describe("Service ID"),
        user_id: z.number().describe("User ID"),
        payload: z.record(z.unknown()).optional(),
      }),
    },
    wrapTool("orders.create", toolHandlers["orders.create"])
  );

  server.registerTool(
    "orders_status",
    {
      description: "Get order status by ID",
      inputSchema: z.object({
        id: z.number().describe("Order ID"),
      }),
    },
    wrapTool("orders.status", toolHandlers["orders.status"])
  );

  server.registerTool(
    "providers_quote",
    {
      description: "Get provider quote (emulated with timeout and retry)",
      inputSchema: z.object({
        order_id: z.number().optional(),
        provider: z.string().optional(),
      }),
    },
    wrapTool("providers.quote", toolHandlers["providers.quote"])
  );

  server.registerTool(
    "admin_ai_chat",
    {
      description: "Admin-only: chat with LLM for architecture/planning discussion",
      inputSchema: z.object({
        message: z.string().describe("Message to send to LLM"),
        user_id: z.string().describe("Admin user ID (must be in ADMIN_IDS)"),
      }),
    },
    wrapTool("admin.ai_chat", toolHandlers["admin.ai_chat"])
  );

  server.registerTool(
    "vps_fs_list",
    {
      description: "List files/directories on VPS under allowed base path (e.g. /www/wwwroot/telegrambot)",
      inputSchema: z.object({
        path: z.string().optional().describe("Path relative to base or absolute (must be under VPS_FS_BASE_PATH)"),
      }),
    },
    wrapTool("vps.fs_list", toolHandlers["vps.fs_list"])
  );

  server.registerTool(
    "vps_fs_copy",
    {
      description: "Copy file or directory on VPS. Paths must be under allowed base.",
      inputSchema: z.object({
        source: z.string().describe("Source path (file or directory)"),
        destination: z.string().describe("Destination path"),
      }),
    },
    wrapTool("vps.fs_copy", toolHandlers["vps.fs_copy"])
  );

  server.registerTool(
    "vps_fs_move",
    {
      description: "Move (rename) file or directory on VPS. Paths must be under allowed base.",
      inputSchema: z.object({
        source: z.string().describe("Source path"),
        destination: z.string().describe("Destination path"),
      }),
    },
    wrapTool("vps.fs_move", toolHandlers["vps.fs_move"])
  );

  server.registerTool(
    "vps_shell_exec",
    {
      description: "Run shell command on VPS (cwd = base path or optional cwd). Timeout 60s by default. E.g. ls -la, cp -r MCP ybrjch.qgsm.store, docker compose up -d",
      inputSchema: z.object({
        command: z.string().describe("Shell command to run (e.g. ls -la, docker compose -f docker-compose.telegram.yml up -d)"),
        cwd: z.string().optional().describe("Working directory (relative to base or absolute under base)"),
      }),
    },
    wrapTool("vps.shell_exec", toolHandlers["vps.shell_exec"])
  );

  return server;
}
