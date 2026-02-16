PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS conversations (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	is_pinned INTEGER NOT NULL DEFAULT 0,
	provider TEXT NOT NULL,
	model TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
	id TEXT PRIMARY KEY,
	conversation_id TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
	content_type TEXT NOT NULL CHECK (content_type IN ('text', 'image', 'diagram')),
	content TEXT NOT NULL,
	metadata_json TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memories (
	id TEXT PRIMARY KEY,
	scope TEXT NOT NULL CHECK (scope IN ('global', 'conversation')),
	conversation_id TEXT,
	content TEXT NOT NULL,
	tags_json TEXT,
	score REAL NOT NULL DEFAULT 1.0,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS image_assets (
	id TEXT PRIMARY KEY,
	conversation_id TEXT NOT NULL,
	message_id TEXT NOT NULL,
	storage_key TEXT NOT NULL UNIQUE,
	content_type TEXT NOT NULL,
	provider TEXT NOT NULL,
	model TEXT NOT NULL,
	size_bytes INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
	FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_events (
	id TEXT PRIMARY KEY,
	created_at INTEGER NOT NULL,
	actor_session_id TEXT NOT NULL,
	conversation_id TEXT,
	action_type TEXT NOT NULL,
	payload_json TEXT NOT NULL,
	prompt_text TEXT,
	prev_hash TEXT NOT NULL,
	event_hash TEXT NOT NULL UNIQUE,
	FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_pinned_updated ON conversations(is_pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_memories_scope_updated ON memories(scope, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_conversation_updated ON memories(conversation_id, updated_at DESC);
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
