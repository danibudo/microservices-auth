CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
--  credentials
-- ─────────────────────────────────────────
CREATE TABLE credentials (
    user_id       UUID         PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    role          VARCHAR(50)  NOT NULL,
    password_hash VARCHAR(255),              -- NULL until onboarding complete
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credentials_email ON credentials(email);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_credentials_updated_at
    BEFORE UPDATE ON credentials
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────
--  tokens
-- ─────────────────────────────────────────
CREATE TYPE token_type AS ENUM ('refresh', 'invite');

CREATE TABLE tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES credentials(user_id) ON DELETE CASCADE,
    type       token_type  NOT NULL,
    token_hash VARCHAR(255) UNIQUE NOT NULL,  -- SHA-256 hex of raw token; never stored in plain
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,                   -- NULL = active; set on use or explicit revocation
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tokens_user_id    ON tokens(user_id);
CREATE INDEX idx_tokens_token_hash ON tokens(token_hash);
CREATE INDEX idx_tokens_expires_at ON tokens(expires_at)
    WHERE revoked_at IS NULL;                 -- partial index: only active tokens need cleanup scans