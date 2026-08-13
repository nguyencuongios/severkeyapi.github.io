-- Key Server database schema (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Admin sessions. Only a hash of the session token is ever stored.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash   TEXT PRIMARY KEY,
  username     TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS packages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id             TEXT UNIQUE NOT NULL,          -- server-generated public identifier, e.g. pkg_ab12cd34
  name               TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  key_name           TEXT NOT NULL DEFAULT '',
  version            TEXT NOT NULL DEFAULT '1.0.0',
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance')),
  allow_free_login   BOOLEAN NOT NULL DEFAULT false,
  get_real_uid_ios   BOOLEAN NOT NULL DEFAULT false,
  contact_link       TEXT NOT NULL DEFAULT '',
  update_link        TEXT NOT NULL DEFAULT '',
  notify_message     TEXT NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Plaintext keys are NEVER stored. Only an HMAC hash (for lookup) and a
-- short prefix (for the admin to visually identify the key) are kept.
CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id   UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_prefix   TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  device_hash  TEXT,                                 -- HMAC of bound device UID, NULL until first verify
  max_uses     INTEGER NOT NULL DEFAULT 1,
  used_count   INTEGER NOT NULL DEFAULT 0,
  note         TEXT NOT NULL DEFAULT '',
  revoked      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_keys_package ON api_keys (package_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys (key_hash);

CREATE TABLE IF NOT EXISTS key_messages (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id    UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  text      TEXT NOT NULL,
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_key_messages_key ON key_messages (key_id);

-- Banned devices, identified only by HMAC hash (never the raw UID).
CREATE TABLE IF NOT EXISTS banned_devices (
  device_hash    TEXT PRIMARY KEY,
  device_label   TEXT,
  banned_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
