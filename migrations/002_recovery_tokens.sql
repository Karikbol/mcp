-- One-time recovery tokens issued by admin
CREATE TABLE IF NOT EXISTS recovery_tokens (
  id BIGSERIAL PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  bound_tg_id BIGINT NOT NULL,
  issued_by_admin_tg_id BIGINT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_tokens_token_hash ON recovery_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_recovery_tokens_bound_tg_id ON recovery_tokens(bound_tg_id);
CREATE INDEX IF NOT EXISTS idx_recovery_tokens_expires_at ON recovery_tokens(expires_at);
