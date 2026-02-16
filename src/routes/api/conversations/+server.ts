import { assertAuthenticatedApi } from '$lib/server/auth';
import { logAuditEvent } from '$lib/server/audit';
import { createConversation, listConversations } from '$lib/server/db';
import { getEnv } from '$lib/server/env';
import { DEFAULT_TEXT_MODEL } from '$lib/server/models';
import { created, ok } from '$lib/server/http';
import { error, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const conversations = await listConversations(env.DB);
	return ok({ conversations });
};

export const POST: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const body = (await event.request.json().catch(() => ({}))) as {
		title?: string;
		provider?: string;
		model?: string;
	};
	const conversation = await createConversation(env.DB, {
		id: crypto.randomUUID(),
		title: body.title?.trim() || 'New chat',
		provider: body.provider ?? DEFAULT_TEXT_MODEL.provider,
		model: body.model ?? DEFAULT_TEXT_MODEL.id
	});

	if (!event.locals.sessionId) {
		throw error(500, 'Session state is not initialized');
	}
	await logAuditEvent({
		db: env.DB,
		sessionId: event.locals.sessionId,
		conversationId: conversation.id,
		actionType: 'conversation.create',
		payload: {
			title: conversation.title,
			model: conversation.model,
			provider: conversation.provider
		}
	});

	return created({ conversation });
};
