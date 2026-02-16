import { clearSessionCookie } from '$lib/server/auth';
import { ok } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	clearSessionCookie(cookies);
	return ok({ authenticated: false });
};
