import { assertAuthenticatedApi } from '$lib/server/auth';
import { logAuditEvent } from '$lib/server/audit';
import { getEnv } from '$lib/server/env';
import { ok } from '$lib/server/http';
import { normalizeMermaidSource } from '$lib/server/mermaid';
import { error, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const body = (await event.request.json().catch(() => ({}))) as {
		source?: string;
		conversationId?: string | null;
		title?: string;
	};
	if (!body.source) {
		throw error(400, 'Mermaid source is required');
	}

	const diagram = normalizeMermaidSource(body.source);
	if (body.title?.trim()) {
		diagram.title = body.title.trim();
	}

	await logAuditEvent({
		db: env.DB,
		sessionId: event.locals.sessionId!,
		conversationId: body.conversationId ?? null,
		actionType: 'tool.mermaid',
		payload: {
			length: diagram.mermaidSource.length,
			title: diagram.title ?? null
		}
	});

	return ok({
		diagram
	});
};
