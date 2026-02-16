import { assertAuthenticatedApi } from '$lib/server/auth';
import { countAuditEvents, listAuditEvents, verifyAuditChain } from '$lib/server/db';
import { getEnv } from '$lib/server/env';
import { ok } from '$lib/server/http';
import { auditQuerySchema, parseSearchParams } from '$lib/server/validation';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);

	const query = parseSearchParams(event.url.searchParams, auditQuerySchema);
	const { limit, offset, actionType, conversationId } = query;
	const includeVerification = query.verify;

	const events = await listAuditEvents(env.DB, {
		limit,
		offset,
		actionType,
		conversationId
	});
	const totalCount = await countAuditEvents(env.DB, {
		actionType,
		conversationId
	});

	let chainValid: boolean | undefined;
	if (includeVerification) {
		chainValid = await verifyAuditChain(env.DB);
	}

	return ok({
		events,
		chainValid,
		limit,
		offset,
		totalCount,
		hasMore: offset + events.length < totalCount
	});
};
