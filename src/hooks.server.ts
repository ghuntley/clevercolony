import type { Handle } from '@sveltejs/kit';
import { readSessionId } from '$lib/server/auth';
import { isSessionRevoked } from '$lib/server/db';
import { optionalEnv } from '$lib/server/env';
import { isUnprotectedPath } from '$lib/server/route-protection';

export const handle: Handle = async ({ event, resolve }) => {
	let sessionId: string | null = null;

	const sessionSecret = optionalEnv(event.platform?.env?.APP_SESSION_SECRET, 'APP_SESSION_SECRET');
	if (sessionSecret) {
		sessionId = await readSessionId(event.cookies, sessionSecret);
	}
	if (sessionId && event.platform?.env?.DB) {
		const revoked = await isSessionRevoked(event.platform.env.DB, sessionId);
		if (revoked) {
			sessionId = null;
		}
	}

	event.locals.sessionId = sessionId;
	event.locals.authenticated = Boolean(sessionId);

	if (!isUnprotectedPath(event.url.pathname) && !event.locals.authenticated) {
		if (event.url.pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Authentication required' }), {
				status: 401,
				headers: {
					'content-type': 'application/json'
				}
			});
		}

		return Response.redirect(new URL('/login', event.url), 303);
	}

	return resolve(event);
};
