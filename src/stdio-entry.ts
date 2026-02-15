#!/usr/bin/env node
/**
 * Stdio entrypoint for local Cursor testing.
 * Usage: node dist/stdio-entry.js (or npx tsx src/stdio-entry.ts)
 */
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp/server.js";

async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP stdio server running (Ctrl+C to exit)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
