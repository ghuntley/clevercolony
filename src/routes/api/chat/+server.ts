import { assertAuthenticatedApi } from '$lib/server/auth';
import { logAuditEvent } from '$lib/server/audit';
import { addMessage, listMemories, listMessages, maybeAutoTitleConversationFromMessage } from '$lib/server/db';
import { getEnv, requireEnv } from '$lib/server/env';
import { DEFAULT_TEXT_MODEL, getModelById } from '$lib/server/models';
import { generateTextResponse } from '$lib/server/providers';
import { runSerperSearch } from '$lib/server/serper';
import { createTextSseStream } from '$lib/server/sse';
import { error, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const body = (await event.request.json().catch(() => ({}))) as {
		conversationId?: string;
		text?: string;
		provider?: 'zai' | 'cloudflare-ai';
		model?: string;
		webSearchEnabled?: boolean;
	};

	const conversationId = body.conversationId?.trim();
	const text = body.text?.trim();
	if (!conversationId) {
		throw error(400, 'conversationId is required');
	}
	if (!text) {
		throw error(400, 'text is required');
	}

	const selectedModelId = body.model ?? DEFAULT_TEXT_MODEL.id;
	const model = getModelById(selectedModelId);
	if (!model || model.modality !== 'text') {
		throw error(400, 'Invalid text model');
	}
	const provider = body.provider ?? model.provider;

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
			webSearchEnabled: Boolean(body.webSearchEnabled)
		},
		promptText: text
	});

	let citations: Awaited<ReturnType<typeof runSerperSearch>> = [];
	if (body.webSearchEnabled) {
		citations = await runSerperSearch({
			apiKey: requireEnv(env.SERPER_API_KEY, 'SERPER_API_KEY'),
			query: text,
			num: 5
		});
	}

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
			provider
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
			hasDiagram: Boolean(response.diagram)
		}
	});

	const stream = createTextSseStream({
		text: response.text,
		metadata: {
			messageId: assistantMessage.id,
			citations,
			diagram: response.diagram
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
