import path from "node:path";
import fs from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../config.js";
import { logger } from "../logger.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const execAsync = promisify(exec);

const basePath = config.vpsFsBasePath;
const shellTimeoutMs = config.vpsShellTimeoutSec * 1000;

/** Resolve path relative to base; throw if outside base (path traversal). */
function resolveSafe(relativeOrAbsolute: string): string {
  const normalized = path.normalize(relativeOrAbsolute);
  const resolved = path.isAbsolute(normalized)
    ? path.resolve(normalized)
    : path.resolve(basePath, normalized);
  const baseResolved = path.resolve(basePath);
  if (resolved !== baseResolved && !resolved.startsWith(baseResolved + path.sep)) {
    throw new Error(`Path outside allowed base ${basePath}: ${relativeOrAbsolute}`);
  }
  return resolved;
}

function ok(text: string, isError = false): CallToolResult {
  return {
    content: [{ type: "text" as const, text }],
    isError,
  };
}

export async function fsList(params: { path?: string }): Promise<CallToolResult> {
  try {
    const dir = params.path ? resolveSafe(params.path) : basePath;
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) {
      return ok(JSON.stringify({ error: "Not a directory", path: dir }, null, 2), true);
    }
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const list = entries.map((e) => ({
      name: e.name,
      type: e.isDirectory() ? "dir" : "file",
    }));
    return ok(
      JSON.stringify(
        { path: dir, basePath, entries: list },
        null,
        2
      )
    );
  } catch (err) {
    logger.warn({ err, path: params.path }, "vps fs.list");
    return ok(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2),
      true
    );
  }
}

export async function fsCopy(params: { source: string; destination: string }): Promise<CallToolResult> {
  try {
    const src = resolveSafe(params.source);
    const dest = resolveSafe(params.destination);
    const srcStat = await fs.stat(src);
    if (srcStat.isDirectory()) {
      await fs.cp(src, dest, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(dest), { recursive: true }).catch(() => {});
      await fs.copyFile(src, dest);
    }
    return ok(
      JSON.stringify({ ok: true, source: src, destination: dest }, null, 2)
    );
  } catch (err) {
    logger.warn({ err, source: params.source, destination: params.destination }, "vps fs.copy");
    return ok(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2),
      true
    );
  }
}

export async function fsMove(params: { source: string; destination: string }): Promise<CallToolResult> {
  try {
    const src = resolveSafe(params.source);
    const dest = resolveSafe(params.destination);
    await fs.mkdir(path.dirname(dest), { recursive: true }).catch(() => {});
    await fs.rename(src, dest);
    return ok(
      JSON.stringify({ ok: true, source: src, destination: dest }, null, 2)
    );
  } catch (err) {
    logger.warn({ err, source: params.source, destination: params.destination }, "vps fs.move");
    return ok(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2),
      true
    );
  }
}

export async function shellExec(params: { command: string; cwd?: string }): Promise<CallToolResult> {
  try {
    const cwd = params.cwd ? resolveSafe(params.cwd) : basePath;
    const dirStat = await fs.stat(cwd).catch(() => null);
    if (!dirStat?.isDirectory()) {
      return ok(JSON.stringify({ error: "cwd is not a directory", cwd }, null, 2), true);
    }
    const { stdout, stderr } = await execAsync(params.command, {
      cwd,
      timeout: shellTimeoutMs,
      maxBuffer: 1024 * 1024,
    });
    return ok(
      JSON.stringify(
        { ok: true, cwd, stdout: stdout.trimEnd(), stderr: stderr?.trimEnd() ?? "" },
        null,
        2
      )
    );
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; killed?: boolean };
    logger.warn({ err, command: params.command }, "vps shell.exec");
    const msg = e instanceof Error ? e.message : String(e);
    const stdout = (e.stdout as string) ?? "";
    const stderr = (e.stderr as string) ?? "";
    return ok(
      JSON.stringify(
        { error: msg, killed: e.killed === true, stdout: stdout.trimEnd(), stderr: stderr.trimEnd() },
        null,
        2
      ),
      true
    );
  }
}
