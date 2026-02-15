import { FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config.js";

export async function bearerAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return reply.code(401).send({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Missing or invalid Authorization" },
      id: null,
    });
  }
  const token = auth.slice(7);
  if (token !== config.mcpBearerToken) {
    return reply.code(401).send({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Invalid token" },
      id: null,
    });
  }
}
