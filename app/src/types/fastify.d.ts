import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    tgUser?: { id: number; username?: string };
  }
}
