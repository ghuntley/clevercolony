import type { Handle } from '@sveltejs/kit';
import { readSessionId, requireSessionSecret } from '$lib/server/auth';
import { isUnprotectedPath } from '$lib/server/route-protection';

export const handle: Handle = async ({ event, resolve }) => {
	let sessionId: string | null = null;

	if (event.platform?.env?.APP_SESSION_SECRET) {
		const secret = requireSessionSecret(event.platform.env);
		sessionId = await readSessionId(event.cookies, secret);
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
