import { assertAuthenticatedApi } from '$lib/server/auth';
import { logAuditEvent } from '$lib/server/audit';
import { isProviderCompatibleWithModel } from '$lib/model-provider';
import { createConversation, listConversations } from '$lib/server/db';
import { getEnv } from '$lib/server/env';
import { DEFAULT_TEXT_MODEL, getModelById } from '$lib/server/models';
import { createConversationRequestSchema, parseJsonBody } from '$lib/server/validation';
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
	const body = await parseJsonBody(event.request, createConversationRequestSchema);
	const modelId = body.model ?? DEFAULT_TEXT_MODEL.id;
	const model = getModelById(modelId);
	if (!model || model.modality !== 'text') {
		throw error(400, 'Invalid text model');
	}
	if (!isProviderCompatibleWithModel(body.provider, model.provider)) {
		throw error(400, 'Provider does not match selected model');
	}
	const conversation = await createConversation(env.DB, {
		id: crypto.randomUUID(),
		title: body.title ?? 'New chat',
		provider: model.provider,
		model: model.id
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
