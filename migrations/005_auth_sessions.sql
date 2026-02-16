-- WebApp auth sessions: session_id -> tg_id binding (tg_id may be null before register)
CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id UUID PRIMARY KEY,
  tg_id BIGINT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'login', 'recover')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
