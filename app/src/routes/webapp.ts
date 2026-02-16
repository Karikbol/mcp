import type { FastifyInstance } from "fastify";
import { join } from "path";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../../public");

export async function registerWebappRoutes(app: FastifyInstance): Promise<void> {
  app.get("/webapp/register", async (_request, reply) => {
    const html = await readFile(join(publicDir, "register.html"), "utf-8");
    return reply.type("text/html; charset=utf-8").send(html);
  });
  app.get("/webapp/login", async (_request, reply) => {
    const html = await readFile(join(publicDir, "login.html"), "utf-8");
    return reply.type("text/html; charset=utf-8").send(html);
  });
  app.get("/webapp/recover", async (_request, reply) => {
    const html = await readFile(join(publicDir, "recover.html"), "utf-8");
    return reply.type("text/html; charset=utf-8").send(html);
  });
}
