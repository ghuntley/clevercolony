import type { AuditEvent, ChatMessage, Conversation, MemoryRecord } from '$lib/types';
import { computeAuditEventHash, verifyAuditChainEntries } from '$lib/server/audit-chain';

interface ConversationRow {
	id: string;
	title: string;
	is_pinned: number;
	provider: string;
	model: string;
	created_at: number;
	updated_at: number;
}

interface MessageRow {
	id: string;
	conversation_id: string;
	role: string;
	content_type: string;
	content: string;
	metadata_json: string | null;
	created_at: number;
	updated_at: number;
}

interface MemoryRow {
	id: string;
	scope: string;
	conversation_id: string | null;
	content: string;
	tags_json: string | null;
	score: number;
	created_at: number;
	updated_at: number;
}

interface AuditEventRow {
	id: string;
	created_at: number;
	actor_session_id: string;
	conversation_id: string | null;
	action_type: string;
	payload_json: string;
	prompt_text: string | null;
	prev_hash: string;
	event_hash: string;
}

interface ImageAssetRow {
	id: string;
	conversation_id: string;
	message_id: string;
	storage_key: string;
	content_type: string;
	provider: string;
	model: string;
	size_bytes: number;
	created_at: number;
}

function parseJson<T>(input: string | null, fallback: T): T {
	if (!input) return fallback;
	try {
		return JSON.parse(input) as T;
	} catch {
		return fallback;
	}
}

function toConversation(row: ConversationRow): Conversation {
	return {
		id: row.id,
		title: row.title,
		isPinned: Boolean(row.is_pinned),
		provider: row.provider as Conversation['provider'],
		model: row.model,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function toMessage(row: MessageRow): ChatMessage {
	return {
		id: row.id,
		conversationId: row.conversation_id,
		role: row.role as ChatMessage['role'],
		contentType: row.content_type as ChatMessage['contentType'],
		content: row.content,
		metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function toMemory(row: MemoryRow): MemoryRecord {
	return {
		id: row.id,
		scope: row.scope as MemoryRecord['scope'],
		conversationId: row.conversation_id,
		content: row.content,
		tags: parseJson<string[]>(row.tags_json, []),
		score: row.score,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function toAuditEvent(row: AuditEventRow): AuditEvent {
	return {
		id: row.id,
		createdAt: row.created_at,
		actorSessionId: row.actor_session_id,
		conversationId: row.conversation_id,
		actionType: row.action_type,
		payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
		promptText: row.prompt_text,
		prevHash: row.prev_hash,
		eventHash: row.event_hash
	};
}

export async function listConversations(db: D1Database): Promise<Conversation[]> {
	const result = await db
		.prepare(
			`SELECT id, title, is_pinned, provider, model, created_at, updated_at
       FROM conversations
       ORDER BY is_pinned DESC, updated_at DESC`
		)
		.all<ConversationRow>();
	return (result.results ?? []).map(toConversation);
}

export async function createConversation(
	db: D1Database,
	input: {
		id: string;
		title: string;
		provider: string;
		model: string;
	}
): Promise<Conversation> {
	const now = Date.now();
	await db
		.prepare(
			`INSERT INTO conversations (id, title, provider, model, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5)`
		)
		.bind(input.id, input.title, input.provider, input.model, now)
		.run();

	return {
		id: input.id,
		title: input.title,
		isPinned: false,
		provider: input.provider as Conversation['provider'],
		model: input.model,
		createdAt: now,
		updatedAt: now
	};
}

export async function updateConversation(
	db: D1Database,
	input: {
		id: string;
		title?: string;
		isPinned?: boolean;
		model?: string;
		provider?: string;
	}
) {
	const now = Date.now();
	const current = await db
		.prepare(`SELECT id, title, is_pinned, provider, model, created_at, updated_at FROM conversations WHERE id = ?1`)
		.bind(input.id)
		.first<ConversationRow>();
	if (!current) return null;

	const nextTitle = input.title ?? current.title;
	const nextIsPinned = input.isPinned ?? Boolean(current.is_pinned);
	const nextModel = input.model ?? current.model;
	const nextProvider = input.provider ?? current.provider;
	await db
		.prepare(
			`UPDATE conversations
       SET title = ?2, is_pinned = ?3, model = ?4, provider = ?5, updated_at = ?6
       WHERE id = ?1`
		)
		.bind(input.id, nextTitle, Number(nextIsPinned), nextModel, nextProvider, now)
		.run();

	return {
		id: current.id,
		title: nextTitle,
		isPinned: nextIsPinned,
		model: nextModel,
		provider: nextProvider as Conversation['provider'],
		createdAt: current.created_at,
		updatedAt: now
	} satisfies Conversation;
}

export async function deleteConversation(db: D1Database, conversationId: string): Promise<void> {
	await db.prepare(`DELETE FROM conversations WHERE id = ?1`).bind(conversationId).run();
}

export async function listMessages(db: D1Database, conversationId: string): Promise<ChatMessage[]> {
	const result = await db
		.prepare(
			`SELECT id, conversation_id, role, content_type, content, metadata_json, created_at, updated_at
       FROM messages
       WHERE conversation_id = ?1
       ORDER BY created_at ASC`
		)
		.bind(conversationId)
		.all<MessageRow>();
	return (result.results ?? []).map(toMessage);
}

export async function addMessage(
	db: D1Database,
	input: {
		id: string;
		conversationId: string;
		role: ChatMessage['role'];
		contentType: ChatMessage['contentType'];
		content: string;
		metadata?: Record<string, unknown>;
	}
): Promise<ChatMessage> {
	const now = Date.now();
	await db
		.prepare(
			`INSERT INTO messages (
        id, conversation_id, role, content_type, content, metadata_json, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)`
		)
		.bind(
			input.id,
			input.conversationId,
			input.role,
			input.contentType,
			input.content,
			JSON.stringify(input.metadata ?? {}),
			now
		)
		.run();
	await db
		.prepare(`UPDATE conversations SET updated_at = ?2 WHERE id = ?1`)
		.bind(input.conversationId, now)
		.run();

	return {
		id: input.id,
		conversationId: input.conversationId,
		role: input.role,
		contentType: input.contentType,
		content: input.content,
		metadata: input.metadata ?? {},
		createdAt: now,
		updatedAt: now
	};
}

export async function updateMessage(
	db: D1Database,
	input: {
		id: string;
		content: string;
		metadata?: Record<string, unknown>;
	}
): Promise<void> {
	const now = Date.now();
	await db
		.prepare(`UPDATE messages SET content = ?2, metadata_json = ?3, updated_at = ?4 WHERE id = ?1`)
		.bind(input.id, input.content, JSON.stringify(input.metadata ?? {}), now)
		.run();
}

export async function listMemories(db: D1Database, options?: { conversationId?: string | null }): Promise<MemoryRecord[]> {
	const conversationId = options?.conversationId;
	const result = conversationId
		? await db
				.prepare(
					`SELECT id, scope, conversation_id, content, tags_json, score, created_at, updated_at
           FROM memories
           WHERE scope = 'global' OR conversation_id = ?1
           ORDER BY score DESC, updated_at DESC`
				)
				.bind(conversationId)
				.all<MemoryRow>()
		: await db
				.prepare(
					`SELECT id, scope, conversation_id, content, tags_json, score, created_at, updated_at
           FROM memories
           ORDER BY score DESC, updated_at DESC`
				)
				.all<MemoryRow>();

	return (result.results ?? []).map(toMemory);
}

export async function createMemory(
	db: D1Database,
	input: {
		id: string;
		scope: MemoryRecord['scope'];
		conversationId: string | null;
		content: string;
		tags: string[];
		score?: number;
	}
): Promise<MemoryRecord> {
	const now = Date.now();
	await db
		.prepare(
			`INSERT INTO memories (id, scope, conversation_id, content, tags_json, score, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)`
		)
		.bind(
			input.id,
			input.scope,
			input.conversationId,
			input.content,
			JSON.stringify(input.tags),
			input.score ?? 1,
			now
		)
		.run();

	return {
		id: input.id,
		scope: input.scope,
		conversationId: input.conversationId,
		content: input.content,
		tags: input.tags,
		score: input.score ?? 1,
		createdAt: now,
		updatedAt: now
	};
}

export async function updateMemory(
	db: D1Database,
	input: {
		id: string;
		content?: string;
		tags?: string[];
		score?: number;
	}
): Promise<MemoryRecord | null> {
	const existing = await db
		.prepare(
			`SELECT id, scope, conversation_id, content, tags_json, score, created_at, updated_at
       FROM memories WHERE id = ?1`
		)
		.bind(input.id)
		.first<MemoryRow>();
	if (!existing) return null;

	const now = Date.now();
	const nextContent = input.content ?? existing.content;
	const nextTags = input.tags ?? parseJson<string[]>(existing.tags_json, []);
	const nextScore = input.score ?? existing.score;
	await db
		.prepare(`UPDATE memories SET content = ?2, tags_json = ?3, score = ?4, updated_at = ?5 WHERE id = ?1`)
		.bind(input.id, nextContent, JSON.stringify(nextTags), nextScore, now)
		.run();

	return {
		id: existing.id,
		scope: existing.scope as MemoryRecord['scope'],
		conversationId: existing.conversation_id,
		content: nextContent,
		tags: nextTags,
		score: nextScore,
		createdAt: existing.created_at,
		updatedAt: now
	};
}

export async function deleteMemory(db: D1Database, id: string): Promise<void> {
	await db.prepare(`DELETE FROM memories WHERE id = ?1`).bind(id).run();
}

export async function createImageAsset(
	db: D1Database,
	input: {
		id: string;
		conversationId: string;
		messageId: string;
		storageKey: string;
		contentType: string;
		provider: string;
		model: string;
		sizeBytes: number;
	}
): Promise<void> {
	const now = Date.now();
	await db
		.prepare(
			`INSERT INTO image_assets (
        id, conversation_id, message_id, storage_key, content_type, provider, model, size_bytes, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
		)
		.bind(
			input.id,
			input.conversationId,
			input.messageId,
			input.storageKey,
			input.contentType,
			input.provider,
			input.model,
			input.sizeBytes,
			now
		)
		.run();
}

export async function getImageAsset(db: D1Database, imageId: string): Promise<ImageAssetRow | null> {
	const row = await db
		.prepare(
			`SELECT id, conversation_id, message_id, storage_key, content_type, provider, model, size_bytes, created_at
       FROM image_assets WHERE id = ?1`
		)
		.bind(imageId)
		.first<ImageAssetRow>();
	return row ?? null;
}

export async function listAuditEvents(
	db: D1Database,
	options: {
		limit?: number;
		offset?: number;
		actionType?: string | null;
		conversationId?: string | null;
	}
): Promise<AuditEvent[]> {
	const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
	const offset = Math.max(options.offset ?? 0, 0);

	if (options.actionType && options.conversationId) {
		const result = await db
			.prepare(
				`SELECT id, created_at, actor_session_id, conversation_id, action_type, payload_json, prompt_text, prev_hash, event_hash
         FROM audit_events
         WHERE action_type = ?1 AND conversation_id = ?2
         ORDER BY created_at DESC
         LIMIT ?3 OFFSET ?4`
			)
			.bind(options.actionType, options.conversationId, limit, offset)
			.all<AuditEventRow>();
		return (result.results ?? []).map(toAuditEvent);
	}

	if (options.actionType) {
		const result = await db
			.prepare(
				`SELECT id, created_at, actor_session_id, conversation_id, action_type, payload_json, prompt_text, prev_hash, event_hash
         FROM audit_events
         WHERE action_type = ?1
         ORDER BY created_at DESC
         LIMIT ?2 OFFSET ?3`
			)
			.bind(options.actionType, limit, offset)
			.all<AuditEventRow>();
		return (result.results ?? []).map(toAuditEvent);
	}

	if (options.conversationId) {
		const result = await db
			.prepare(
				`SELECT id, created_at, actor_session_id, conversation_id, action_type, payload_json, prompt_text, prev_hash, event_hash
         FROM audit_events
         WHERE conversation_id = ?1
         ORDER BY created_at DESC
         LIMIT ?2 OFFSET ?3`
			)
			.bind(options.conversationId, limit, offset)
			.all<AuditEventRow>();
		return (result.results ?? []).map(toAuditEvent);
	}

	const result = await db
		.prepare(
			`SELECT id, created_at, actor_session_id, conversation_id, action_type, payload_json, prompt_text, prev_hash, event_hash
       FROM audit_events
       ORDER BY created_at DESC
       LIMIT ?1 OFFSET ?2`
		)
		.bind(limit, offset)
		.all<AuditEventRow>();
	return (result.results ?? []).map(toAuditEvent);
}

export async function appendAuditEvent(
	db: D1Database,
	input: {
		id: string;
		actorSessionId: string;
		conversationId: string | null;
		actionType: string;
		payload: Record<string, unknown>;
		promptText: string | null;
	}
): Promise<AuditEvent> {
	const previous = await db
		.prepare(`SELECT event_hash FROM audit_events ORDER BY created_at DESC LIMIT 1`)
		.first<{ event_hash: string }>();
	const prevHash = previous?.event_hash ?? 'GENESIS';
	const createdAt = Date.now();
	const payloadJson = JSON.stringify(input.payload);
	const eventHash = await computeAuditEventHash({
		prevHash,
		id: input.id,
		createdAt,
		actorSessionId: input.actorSessionId,
		conversationId: input.conversationId,
		actionType: input.actionType,
		payloadJson,
		promptText: input.promptText
	});

	await db
		.prepare(
			`INSERT INTO audit_events (
        id, created_at, actor_session_id, conversation_id, action_type, payload_json, prompt_text, prev_hash, event_hash
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
		)
		.bind(
			input.id,
			createdAt,
			input.actorSessionId,
			input.conversationId,
			input.actionType,
			payloadJson,
			input.promptText,
			prevHash,
			eventHash
		)
		.run();

	return {
		id: input.id,
		createdAt,
		actorSessionId: input.actorSessionId,
		conversationId: input.conversationId,
		actionType: input.actionType,
		payload: input.payload,
		promptText: input.promptText,
		prevHash,
		eventHash
	};
}

export async function verifyAuditChain(db: D1Database): Promise<boolean> {
	const result = await db
		.prepare(
			`SELECT id, created_at, actor_session_id, conversation_id, action_type, payload_json, prompt_text, prev_hash, event_hash
       FROM audit_events
       ORDER BY created_at ASC`
		)
		.all<AuditEventRow>();
	const entries = (result.results ?? []).map((row) => ({
		id: row.id,
		createdAt: row.created_at,
		actorSessionId: row.actor_session_id,
		conversationId: row.conversation_id,
		actionType: row.action_type,
		payloadJson: row.payload_json,
		promptText: row.prompt_text,
		prevHash: row.prev_hash,
		eventHash: row.event_hash
	}));
	return verifyAuditChainEntries(entries);
}
