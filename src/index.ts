import Fastify from "fastify";
import cors from "@fastify/cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./mcp/server.js";
import { bearerAuth } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { complete } from "./llm/router.js";
import { closePool } from "./db/client.js";
import { closeRedis } from "./redis/client.js";

const app = Fastify({ logger: false });

await app.register(cors, {
  origin: config.nodeEnv === "production" ? false : true,
  allowedHeaders: ["Content-Type", "Authorization", "Mcp-Session-Id", "X-MCP-User-Id"],
});

app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

app.get("/metrics", async () => {
  return {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  };
});

app.post<{
  Body: { message?: string };
}>(
  "/internal/chat",
  { preHandler: [bearerAuth, rateLimit] },
  async (request, reply) => {
    const userId = request.headers["x-mcp-user-id"] as string | undefined;
    if (!userId || !config.adminIds.includes(userId)) {
      return reply.code(403).send({ error: "Forbidden: admin only" });
    }
    const { message } = request.body ?? {};
    if (!message || typeof message !== "string") {
      return reply.code(400).send({ error: "message required" });
    }
    try {
      const resp = await complete(message);
      return { content: resp.content, model: resp.model, latencyMs: resp.latencyMs };
    } catch (e) {
      logger.error({ err: e }, "internal/chat error");
      return reply.code(500).send({ error: String(e) });
    }
  }
);

app.all("/mcp", { preHandler: [bearerAuth, rateLimit] }, async (request, reply) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  transport.onerror = (err) => logger.error({ err }, "MCP transport error");

  await server.connect(transport);

  const req = request.raw;
  const res = reply.raw;
  const body = request.method === "POST" ? (request.body as unknown) : undefined;

  await transport.handleRequest(req, res, body);

  res.on("close", () => {
    transport.close();
    server.close();
  });
});

async function main() {
  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
    logger.info({ port: config.port }, "MCP server listening");
  } catch (err) {
    logger.error({ err }, "Failed to start");
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  await app.close();
  await closePool();
  await closeRedis();
  process.exit(0);
});

main();
