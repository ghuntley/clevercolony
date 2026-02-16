PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS audit_events_next (
	id TEXT PRIMARY KEY,
	created_at INTEGER NOT NULL,
	actor_session_id TEXT NOT NULL,
	conversation_id TEXT,
	action_type TEXT NOT NULL,
	payload_json TEXT NOT NULL,
	prompt_text TEXT,
	prev_hash TEXT NOT NULL,
	event_hash TEXT NOT NULL UNIQUE
);

INSERT INTO audit_events_next (
	id,
	created_at,
	actor_session_id,
	conversation_id,
	action_type,
	payload_json,
	prompt_text,
	prev_hash,
	event_hash
)
SELECT
	id,
	created_at,
	actor_session_id,
	conversation_id,
	action_type,
	payload_json,
	prompt_text,
	prev_hash,
	event_hash
FROM audit_events;

DROP TABLE audit_events;

ALTER TABLE audit_events_next RENAME TO audit_events;

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_created ON audit_events(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_conversation_created ON audit_events(conversation_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_audit_events_prevent_update
BEFORE UPDATE ON audit_events
BEGIN
	SELECT RAISE(ABORT, 'audit_events is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_events_prevent_delete
BEFORE DELETE ON audit_events
BEGIN
	SELECT RAISE(ABORT, 'audit_events is append-only');
END;

PRAGMA foreign_keys = ON;
