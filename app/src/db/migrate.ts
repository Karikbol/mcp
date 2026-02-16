import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { query } from "./client.js";
import { logger } from "../logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function getMigrationsDir(): Promise<string> {
  // From app/src/db -> ../../.. = repo root; from app/dist/db -> ../../.. = repo root
  const rootMigrations = join(__dirname, "../../../migrations");
  const appMigrations = join(__dirname, "../../migrations");
  try {
    await readdir(rootMigrations);
    return rootMigrations;
  } catch {
    return appMigrations;
  }
}

async function run() {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const dir = await getMigrationsDir();
  const files = (await readdir(dir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const name = file.replace(/\.sql$/, "");
    const existing = await query("SELECT 1 FROM _migrations WHERE name = $1", [name]);
    if (existing.rowCount && existing.rowCount > 0) {
      logger.info({ migration: name }, "Already applied");
      continue;
    }
    const sql = await readFile(join(dir, file), "utf-8");
    await query(sql);
    await query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
    logger.info({ migration: name }, "Applied");
  }
}

run()
  .then(() => {
    logger.info("Migrations done");
    process.exit(0);
  })
  .catch((err) => {
    logger.error({ err }, "Migration failed");
    process.exit(1);
  });
