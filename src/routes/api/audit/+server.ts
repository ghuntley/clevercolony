import { assertAuthenticatedApi } from '$lib/server/auth';
import { countAuditEvents, listAuditEvents, verifyAuditChain } from '$lib/server/db';
import { getEnv } from '$lib/server/env';
import { ok } from '$lib/server/http';
import { auditQuerySchema, parseSearchParams } from '$lib/server/validation';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);

	const query = parseSearchParams(event.url.searchParams, auditQuerySchema);
	const { limit, offset, actionType, conversationId, conversationQuery } = query;
	const includeVerification = query.verify;
	const createdFrom = query.dateFrom ? Date.parse(`${query.dateFrom}T00:00:00.000Z`) : undefined;
	const createdTo = query.dateTo ? Date.parse(`${query.dateTo}T23:59:59.999Z`) : undefined;
	if (query.dateFrom && Number.isNaN(createdFrom)) {
		throw error(400, 'dateFrom is invalid');
	}
	if (query.dateTo && Number.isNaN(createdTo)) {
		throw error(400, 'dateTo is invalid');
	}

	const events = await listAuditEvents(env.DB, {
		limit,
		offset,
		actionType,
		conversationId,
		conversationQuery,
		createdFrom,
		createdTo
	});
	const totalCount = await countAuditEvents(env.DB, {
		actionType,
		conversationId,
		conversationQuery,
		createdFrom,
		createdTo
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
