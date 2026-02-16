import { assertAuthenticatedApi } from '$lib/server/auth';
import { logAuditEvent } from '$lib/server/audit';
import { isProviderCompatibleWithModel } from '$lib/model-provider';
import {
	addMessage,
	getConversationById,
	listMemories,
	listMessages,
	maybeAutoTitleConversationFromMessage
} from '$lib/server/db';
import { getEnv } from '$lib/server/env';
import { DEFAULT_TEXT_MODEL, getModelById } from '$lib/server/models';
import { generateTextResponse } from '$lib/server/providers';
import { createTextSseStream } from '$lib/server/sse';
import { chatRequestSchema, parseJsonBody } from '$lib/server/validation';
import { maybeRunWebSearch } from '$lib/server/web-search';
import { error, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const body = await parseJsonBody(event.request, chatRequestSchema);
	const conversationId = body.conversationId;
	const text = body.text;
	const conversation = await getConversationById(env.DB, conversationId);
	if (!conversation) {
		throw error(404, 'Conversation not found');
	}

	const selectedModelId = body.model ?? DEFAULT_TEXT_MODEL.id;
	const model = getModelById(selectedModelId);
	if (!model || model.modality !== 'text') {
		throw error(400, 'Invalid text model');
	}
	if (!isProviderCompatibleWithModel(body.provider, model.provider)) {
		throw error(400, 'Provider does not match selected model');
	}
	const provider = model.provider;

	const userMessage = await addMessage(env.DB, {
		id: crypto.randomUUID(),
		conversationId,
		role: 'user',
		contentType: 'text',
		content: text,
		metadata: {
			webSearchEnabled: Boolean(body.webSearchEnabled),
			model: selectedModelId,
			provider
		}
	});

	const autoTitle = await maybeAutoTitleConversationFromMessage(env.DB, {
		conversationId,
		messageId: userMessage.id,
		messageText: text
	});
	if (autoTitle) {
		await logAuditEvent({
			db: env.DB,
			sessionId: event.locals.sessionId!,
			conversationId,
			actionType: 'conversation.autotitle',
			payload: {
				title: autoTitle,
				sourceMessageId: userMessage.id
			}
		});
	}

	await logAuditEvent({
		db: env.DB,
		sessionId: event.locals.sessionId!,
		conversationId,
		actionType: 'prompt.submit',
		payload: {
			model: selectedModelId,
			provider,
			webSearchEnabled: Boolean(body.webSearchEnabled),
			conversationTitle: conversation.title
		},
		promptText: text
	});

	const webSearchResult = await maybeRunWebSearch({
		enabled: Boolean(body.webSearchEnabled),
		apiKey: env.SERPER_API_KEY,
		query: text,
		maxResults: 5
	});
	const citations = webSearchResult.citations;

	const messageHistory = await listMessages(env.DB, conversationId);
	const memories = await listMemories(env.DB, { conversationId });
	const response = await generateTextResponse({
		context: { env },
		provider,
		model: selectedModelId,
		messages: messageHistory,
		memories: memories.slice(0, 12),
		citations
	});

	const assistantMessage = await addMessage(env.DB, {
		id: crypto.randomUUID(),
		conversationId,
		role: 'assistant',
		contentType: 'text',
		content: response.text,
		metadata: {
			citations,
			model: selectedModelId,
			provider,
			webSearchStatus: webSearchResult.status
		}
	});

	if (response.diagram) {
		await addMessage(env.DB, {
			id: crypto.randomUUID(),
			conversationId,
			role: 'assistant',
			contentType: 'diagram',
			content: response.diagram.mermaidSource,
			metadata: response.diagram as unknown as Record<string, unknown>
		});
	}

	await logAuditEvent({
		db: env.DB,
		sessionId: event.locals.sessionId!,
		conversationId,
		actionType: 'assistant.response',
		payload: {
			assistantMessageId: assistantMessage.id,
			citationCount: citations.length,
			hasDiagram: Boolean(response.diagram),
			webSearchStatus: webSearchResult.status
		}
	});

	const stream = createTextSseStream({
		text: response.text,
		metadata: {
			messageId: assistantMessage.id,
			citations,
			diagram: response.diagram,
			webSearchStatus: webSearchResult.status
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream; charset=utf-8',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive'
		}
	});
};
