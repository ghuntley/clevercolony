import { assertAuthenticatedApi } from '$lib/server/auth';
import { logAuditEvent } from '$lib/server/audit';
import { isProviderCompatibleWithModel } from '$lib/model-provider';
import { deleteConversation, listMessages, updateConversation } from '$lib/server/db';
import { getEnv } from '$lib/server/env';
import { getModelById } from '$lib/server/models';
import { parseJsonBody, updateConversationRequestSchema } from '$lib/server/validation';
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
	const body = await parseJsonBody(event.request, updateConversationRequestSchema);
	let nextModel = body.model;
	let nextProvider = body.provider;

	if (body.model) {
		const model = getModelById(body.model);
		if (!model) {
			throw error(400, 'Invalid model');
		}
		if (!isProviderCompatibleWithModel(body.provider, model.provider)) {
			throw error(400, 'Provider does not match selected model');
		}
		nextModel = model.id;
		nextProvider = model.provider;
	} else if (body.provider) {
		throw error(400, 'provider cannot be changed without model');
	}

	const updated = await updateConversation(env.DB, {
		id: conversationId,
		title: body.title,
		isPinned: body.isPinned,
		model: nextModel,
		provider: nextProvider
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
