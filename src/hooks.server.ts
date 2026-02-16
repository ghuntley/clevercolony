import type { Handle } from '@sveltejs/kit';
import { readSessionId, requireSessionSecret } from '$lib/server/auth';

const UNPROTECTED_PATHS = new Set<string>(['/login']);
const UNPROTECTED_API_PREFIXES = ['/api/auth'];

function isUnprotectedPath(pathname: string): boolean {
	if (UNPROTECTED_PATHS.has(pathname)) return true;
	if (pathname.startsWith('/_app/')) return true;
	if (pathname.startsWith('/favicon')) return true;
	if (pathname === '/robots.txt') return true;
	return UNPROTECTED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

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
