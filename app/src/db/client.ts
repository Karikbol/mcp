import pg from "pg";
import { config } from "../config.js";
import { logger } from "../logger.js";

const pool = new pg.Pool({
  connectionString: config.database.url,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err: Error) => logger.error({ err }, "Postgres pool error"));

export async function query(text: string, params?: unknown[]): Promise<pg.QueryResult> {
  return pool.query(text, params);
}

export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect();
}

export async function closePool(): Promise<void> {
  await pool.end();
}
