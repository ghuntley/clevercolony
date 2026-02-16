import { assertAuthenticatedApi } from '$lib/server/auth';
import { logAuditEvent } from '$lib/server/audit';
import { createMemory, deleteMemory, listMemories, updateMemory } from '$lib/server/db';
import { getEnv } from '$lib/server/env';
import { created, ok } from '$lib/server/http';
import { error, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const conversationId = event.url.searchParams.get('conversationId');
	const memories = await listMemories(env.DB, {
		conversationId
	});
	return ok({ memories });
};

export const POST: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const body = (await event.request.json().catch(() => ({}))) as {
		scope?: 'global' | 'conversation';
		conversationId?: string | null;
		content?: string;
		tags?: string[];
		score?: number;
	};
	const content = body.content?.trim();
	if (!content) {
		throw error(400, 'Memory content is required');
	}

	const memory = await createMemory(env.DB, {
		id: crypto.randomUUID(),
		scope: body.scope ?? 'global',
		conversationId: body.scope === 'conversation' ? body.conversationId ?? null : null,
		content,
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
	const body = (await event.request.json().catch(() => ({}))) as {
		id?: string;
		content?: string;
		tags?: string[];
		score?: number;
	};
	if (!body.id) {
		throw error(400, 'Memory id is required');
	}

	const updated = await updateMemory(env.DB, {
		id: body.id,
		content: body.content?.trim(),
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
	const id = event.url.searchParams.get('id');
	if (!id) {
		throw error(400, 'Memory id is required');
	}
	await deleteMemory(env.DB, id);

	await logAuditEvent({
		db: env.DB,
		sessionId: event.locals.sessionId!,
		actionType: 'memory.delete',
		payload: { id }
	});
	return ok({ deleted: true });
};
