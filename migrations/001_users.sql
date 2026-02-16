-- Users: registration and recovery state
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  tg_id BIGINT UNIQUE NOT NULL,
  tg_id_prev BIGINT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_e164 TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client',
  recovered_flag BOOLEAN NOT NULL DEFAULT false,
  recovered_at TIMESTAMPTZ NULL,
  recovered_count INT NOT NULL DEFAULT 0,
  recovery_locked_until TIMESTAMPTZ NULL,
  last_seen_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_tg_id ON users(tg_id);
CREATE INDEX IF NOT EXISTS idx_users_phone_e164 ON users(phone_e164);

-- updated_at is maintained by application on UPDATE
