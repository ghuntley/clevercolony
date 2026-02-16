import { ok } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return ok({
		status: 'ok',
		timestamp: Date.now()
	});
};
