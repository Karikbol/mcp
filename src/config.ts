import "dotenv/config";

const maskSecret = (s: string | undefined): string =>
  s ? (s.length > 8 ? s.slice(0, 4) + "***" + s.slice(-4) : "***") : "";

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "3100", 10),
  mcpBearerToken: process.env.MCP_BEARER_TOKEN ?? "",
  adminIds: (process.env.ADMIN_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  database: {
    url: process.env.DATABASE_URL ?? "postgresql://mcp:mcp_password@localhost:5432/mcp_db",
  },

  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  },

  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    model: process.env.OLLAMA_MODEL ?? "deepseek-r1:1.5b",
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    /** Use only OpenAI (no Ollama). Default true for VPS with limited RAM. */
    only: process.env.OPENAI_ONLY !== "false",
    model: process.env.OPENAI_MODEL ?? process.env.OPENAI_FALLBACK_MODEL ?? "gpt-4o-mini",
    fallbackEnabled: process.env.OPENAI_FALLBACK_ENABLED === "true",
    fallbackModel: process.env.OPENAI_FALLBACK_MODEL ?? "gpt-4o-mini",
  },

  rateLimit: {
    ipPerMin: parseInt(process.env.RATE_LIMIT_IP_PER_MIN ?? "60", 10),
    userPerDay: parseInt(process.env.RATE_LIMIT_USER_PER_DAY ?? "200", 10),
  },

  /** Base path for VPS fs/shell tools. All operations restricted to this directory. Mount host path in Docker. */
  vpsFsBasePath: process.env.VPS_FS_BASE_PATH ?? "/www/wwwroot/telegrambot",
  /** Max timeout for shell.exec (seconds). */
  vpsShellTimeoutSec: Math.min(120, Math.max(5, parseInt(process.env.VPS_SHELL_TIMEOUT_SEC ?? "60", 10) || 60)),
} as const;

/** Safe for logging - masks secrets */
export const configSafe = {
  ...config,
  mcpBearerToken: maskSecret(config.mcpBearerToken),
  openai: {
    ...config.openai,
    apiKey: maskSecret(config.openai.apiKey),
  },
};
