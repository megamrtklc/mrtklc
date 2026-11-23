-- Persistent signing secret; survives Worker deployments without extra dashboard secrets.
CREATE TABLE IF NOT EXISTS admin_app_secrets (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  secret_value TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
