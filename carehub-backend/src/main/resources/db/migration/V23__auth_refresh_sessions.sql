ALTER TABLE users
    ADD COLUMN IF NOT EXISTS auth_version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE refresh_tokens
    ALTER COLUMN token DROP NOT NULL;

ALTER TABLE refresh_tokens
    ADD COLUMN IF NOT EXISTS session_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS generation INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS first_login_session BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE refresh_tokens
SET revoked_at = COALESCE(revoked_at, created_at)
WHERE revoked = TRUE
  AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_refresh_tokens_session_id
    ON refresh_tokens (session_id)
    WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_revoked_expiry
    ON refresh_tokens (user_id, revoked, expired_at);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_cleanup
    ON refresh_tokens (revoked, revoked_at, expired_at);
