import { assertAuthenticatedApi } from '$lib/server/auth';
import { logAuditEvent } from '$lib/server/audit';
import { deleteConversation, listMessages, updateConversation } from '$lib/server/db';
import { getEnv } from '$lib/server/env';
import { ok } from '$lib/server/http';
import { error, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const conversationId = event.params.conversationId;
	if (!conversationId) {
		throw error(400, 'conversationId is required');
	}
	const messages = await listMessages(env.DB, conversationId);
	return ok({ conversationId, messages });
};

export const PATCH: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const conversationId = event.params.conversationId;
	if (!conversationId) {
		throw error(400, 'conversationId is required');
	}
	const body = (await event.request.json().catch(() => ({}))) as {
		title?: string;
		isPinned?: boolean;
		model?: string;
		provider?: string;
	};
	const updated = await updateConversation(env.DB, {
		id: conversationId,
		title: body.title?.trim(),
		isPinned: body.isPinned,
		model: body.model,
		provider: body.provider
	});
	if (!updated) {
		throw error(404, 'Conversation not found');
	}

	await logAuditEvent({
		db: env.DB,
		sessionId: event.locals.sessionId!,
		conversationId,
		actionType: 'conversation.update',
		payload: body
	});

	return ok({ conversation: updated });
};

export const DELETE: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const conversationId = event.params.conversationId;
	if (!conversationId) {
		throw error(400, 'conversationId is required');
	}
	await deleteConversation(env.DB, conversationId);

	await logAuditEvent({
		db: env.DB,
		sessionId: event.locals.sessionId!,
		conversationId,
		actionType: 'conversation.delete',
		payload: {}
	});

	return ok({ deleted: true });
};
