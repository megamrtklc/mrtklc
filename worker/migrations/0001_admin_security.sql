-- Durable security state for the single-administrator console.
CREATE TABLE IF NOT EXISTS admin_credentials (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 310000,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  session_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON admin_sessions(revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS admin_login_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempted_username TEXT NOT NULL DEFAULT '',
  succeeded INTEGER NOT NULL,
  occurred_at INTEGER NOT NULL,
  ip_hash TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_admin_login_events_time ON admin_login_events(occurred_at DESC);

CREATE TABLE IF NOT EXISTS admin_security_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  login_limit INTEGER NOT NULL DEFAULT 5,
  login_window_seconds INTEGER NOT NULL DEFAULT 60,
  session_ttl_seconds INTEGER NOT NULL DEFAULT 7200,
  updated_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO admin_security_settings
  (id, login_limit, login_window_seconds, session_ttl_seconds, updated_at)
VALUES (1, 5, 60, 7200, unixepoch());
