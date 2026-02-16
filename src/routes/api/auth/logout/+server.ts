import { clearSessionCookie } from '$lib/server/auth';
import { ok } from '$lib/server/http';
import { getEnv } from '$lib/server/env';
import { logAuditEvent } from '$lib/server/audit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const env = getEnv(event);
	if (event.locals.sessionId) {
		await logAuditEvent({
			db: env.DB,
			sessionId: event.locals.sessionId,
			actionType: 'auth.logout',
			payload: {
				success: true
			}
		});
	}

	clearSessionCookie(event.cookies);
	return ok({ authenticated: false });
};
