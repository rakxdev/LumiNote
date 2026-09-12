-- LumiNote D1 schema. user_id is reserved for multi-user (TOTP) later;
-- the personal app writes everything under the default 'local' user.

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local',
  kind TEXT NOT NULL CHECK (kind IN ('note', 'clip', 'transcript')),
  text TEXT NOT NULL,
  source_device TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_notes_list
  ON notes(user_id, kind, pinned DESC, created_at DESC);

-- Key/value settings for future app-level state (TOTP secret, recovery codes).
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
