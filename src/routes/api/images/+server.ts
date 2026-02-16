import { assertAuthenticatedApi } from '$lib/server/auth';
import { logAuditEvent } from '$lib/server/audit';
import { isProviderCompatibleWithModel } from '$lib/model-provider';
import { MAX_IMAGE_PROMPT_CHARS, isPromptWithinLimit } from '$lib/request-limits';
import { addMessage, createImageAsset, getConversationById } from '$lib/server/db';
import { getEnv } from '$lib/server/env';
import { DEFAULT_IMAGE_MODEL, getModelById } from '$lib/server/models';
import { generateImage } from '$lib/server/providers';
import { created } from '$lib/server/http';
import { error, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const body = (await event.request.json().catch(() => ({}))) as {
		conversationId?: string;
		prompt?: string;
		provider?: 'zai' | 'cloudflare-ai';
		model?: string;
	};
	const prompt = body.prompt?.trim();
	if (!body.conversationId) {
		throw error(400, 'conversationId is required');
	}
	if (!prompt) {
		throw error(400, 'prompt is required');
	}
	if (!isPromptWithinLimit(prompt, MAX_IMAGE_PROMPT_CHARS)) {
		throw error(400, `prompt exceeds ${MAX_IMAGE_PROMPT_CHARS} characters`);
	}
	const conversation = await getConversationById(env.DB, body.conversationId);
	if (!conversation) {
		throw error(404, 'Conversation not found');
	}

	const selectedModelId = body.model ?? DEFAULT_IMAGE_MODEL.id;
	const model = getModelById(selectedModelId);
	if (!model || model.modality !== 'image') {
		throw error(400, 'Invalid image model');
	}
	if (!isProviderCompatibleWithModel(body.provider, model.provider)) {
		throw error(400, 'Provider does not match selected model');
	}
	const provider = model.provider;
	const image = await generateImage({
		context: { env },
		provider,
		model: model.id,
		prompt
	});

	const imageId = crypto.randomUUID();
	const messageId = crypto.randomUUID();
	const storageKey = `images/${body.conversationId}/${imageId}.png`;
	await env.MEDIA_BUCKET.put(storageKey, image.bytes, {
		httpMetadata: {
			contentType: image.contentType
		},
		customMetadata: {
			conversationId: body.conversationId,
			messageId,
			provider,
			model: model.id
		}
	});

	await createImageAsset(env.DB, {
		id: imageId,
		conversationId: body.conversationId,
		messageId,
		storageKey,
		contentType: image.contentType,
		provider,
		model: model.id,
		sizeBytes: image.bytes.byteLength
	});

	const message = await addMessage(env.DB, {
		id: messageId,
		conversationId: body.conversationId,
		role: 'assistant',
		contentType: 'image',
		content: `Generated image for: ${prompt}`,
		metadata: {
			imageId,
			url: `/api/images/${imageId}`,
			provider,
			model: model.id
		}
	});

	await logAuditEvent({
		db: env.DB,
		sessionId: event.locals.sessionId!,
		conversationId: body.conversationId,
		actionType: 'image.generate',
		payload: {
			imageId,
			model: model.id,
			provider,
			conversationTitle: conversation.title
		},
		promptText: prompt
	});

	return created({
		imageId,
		message
	});
};
