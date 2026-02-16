import { assertAuthenticatedApi } from '$lib/server/auth';
import { countAuditEvents, listAuditEvents, verifyAuditChain } from '$lib/server/db';
import { getEnv } from '$lib/server/env';
import { ok } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);

	const requestedLimit = Number(event.url.searchParams.get('limit') ?? 50);
	const requestedOffset = Number(event.url.searchParams.get('offset') ?? 0);
	const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 50, 1), 200);
	const offset = Math.max(Number.isFinite(requestedOffset) ? requestedOffset : 0, 0);
	const actionType = event.url.searchParams.get('actionType');
	const conversationId = event.url.searchParams.get('conversationId');
	const includeVerification = event.url.searchParams.get('verify') === '1';

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
