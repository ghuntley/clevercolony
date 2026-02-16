import { assertAuthenticatedApi } from '$lib/server/auth';
import { logAuditEvent } from '$lib/server/audit';
import { createMemory, deleteMemory, getConversationById, getMemoryById, listMemories, updateMemory } from '$lib/server/db';
import { getEnv } from '$lib/server/env';
import { created, ok } from '$lib/server/http';
import {
	createMemoryRequestSchema,
	memoryDeleteQuerySchema,
	memoryListQuerySchema,
	parseJsonBody,
	parseSearchParams,
	updateMemoryRequestSchema
} from '$lib/server/validation';
import { error, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const query = parseSearchParams(event.url.searchParams, memoryListQuerySchema);
	const conversationId = query.conversationId;
	if (conversationId) {
		const conversation = await getConversationById(env.DB, conversationId);
		if (!conversation) {
			throw error(404, 'Conversation not found');
		}
	}
	const memories = await listMemories(env.DB, {
		conversationId
	});
	return ok({ memories });
};

export const POST: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const body = await parseJsonBody(event.request, createMemoryRequestSchema);
	const scope = body.scope ?? 'global';
	const conversationId = scope === 'conversation' ? body.conversationId ?? null : null;
	if (conversationId) {
		const conversation = await getConversationById(env.DB, conversationId);
		if (!conversation) {
			throw error(404, 'Conversation not found');
		}
	}

	const memory = await createMemory(env.DB, {
		id: crypto.randomUUID(),
		scope,
		conversationId,
		content: body.content,
		tags: body.tags ?? [],
		score: body.score ?? 1
	});

	await logAuditEvent({
		db: env.DB,
		sessionId: event.locals.sessionId!,
		conversationId: memory.conversationId,
		actionType: 'memory.create',
		payload: {
			scope: memory.scope,
			tags: memory.tags,
			score: memory.score
		}
	});

	return created({ memory });
};

export const PATCH: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const body = await parseJsonBody(event.request, updateMemoryRequestSchema);

	const updated = await updateMemory(env.DB, {
		id: body.id,
		content: body.content,
		tags: body.tags,
		score: body.score
	});
	if (!updated) {
		throw error(404, 'Memory not found');
	}

	await logAuditEvent({
		db: env.DB,
		sessionId: event.locals.sessionId!,
		conversationId: updated.conversationId,
		actionType: 'memory.update',
		payload: {
			id: updated.id,
			tags: updated.tags,
			score: updated.score
		}
	});

	return ok({ memory: updated });
};

export const DELETE: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const query = parseSearchParams(event.url.searchParams, memoryDeleteQuerySchema);
	const existing = await getMemoryById(env.DB, query.id);
	if (!existing) {
		throw error(404, 'Memory not found');
	}
	await deleteMemory(env.DB, query.id);

	await logAuditEvent({
		db: env.DB,
		sessionId: event.locals.sessionId!,
		conversationId: existing.conversationId,
		actionType: 'memory.delete',
		payload: {
			id: existing.id,
			scope: existing.scope
		}
	});
	return ok({ deleted: true });
};
