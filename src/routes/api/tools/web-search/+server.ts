import { assertAuthenticatedApi } from '$lib/server/auth';
import { logAuditEvent } from '$lib/server/audit';
import { getEnv, requireEnv } from '$lib/server/env';
import { ok } from '$lib/server/http';
import { runSerperSearch } from '$lib/server/serper';
import { error, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const body = (await event.request.json().catch(() => ({}))) as {
		query?: string;
		gl?: string;
		hl?: string;
		num?: number;
		conversationId?: string | null;
	};
	const query = body.query?.trim();
	if (!query) {
		throw error(400, 'Search query is required');
	}

	const citations = await runSerperSearch({
		apiKey: requireEnv(env.SERPER_API_KEY, 'SERPER_API_KEY'),
		query,
		gl: body.gl,
		hl: body.hl,
		num: body.num
	});

	await logAuditEvent({
		db: env.DB,
		sessionId: event.locals.sessionId!,
		conversationId: body.conversationId ?? null,
		actionType: 'tool.web_search',
		payload: {
			query,
			resultCount: citations.length
		}
	});

	return ok({
		query,
		citations
	});
};
