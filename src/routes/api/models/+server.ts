import { ok } from '$lib/server/http';
import { MODEL_REGISTRY } from '$lib/server/models';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return ok({
		models: MODEL_REGISTRY
	});
};
