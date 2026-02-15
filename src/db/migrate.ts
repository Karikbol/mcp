import { query } from "./client.js";
import { logger } from "../logger.js";

const MIGRATIONS = [
  {
    name: "001_init",
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        tg_id BIGINT UNIQUE NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        price DECIMAL(12,2) NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        service_id INTEGER REFERENCES services(id),
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        payload_json JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS provider_requests (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        provider VARCHAR(255) NOT NULL,
        request_json JSONB,
        response_json JSONB,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      INSERT INTO services (name, price, is_active) VALUES
        ('Basic', 10.00, true),
        ('Pro', 25.00, true),
        ('Enterprise', 100.00, true)
      ON CONFLICT DO NOTHING;
    `,
  },
];

async function run() {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  for (const m of MIGRATIONS) {
    const existing = await query(
      "SELECT 1 FROM _migrations WHERE name = $1",
      [m.name]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      logger.info({ migration: m.name }, "Already applied");
      continue;
    }
    await query(m.up);
    await query("INSERT INTO _migrations (name) VALUES ($1)", [m.name]);
    logger.info({ migration: m.name }, "Applied");
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
