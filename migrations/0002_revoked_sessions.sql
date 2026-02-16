PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS revoked_sessions (
	session_id TEXT PRIMARY KEY,
	revoked_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revoked_sessions_revoked_at ON revoked_sessions(revoked_at DESC);
