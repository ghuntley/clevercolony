import { created } from '$lib/server/http';
import { getEnv } from '$lib/server/env';
import { setSessionCookie, requireSessionSecret, validatePasswordAgainstEnv } from '$lib/server/auth';
import { error, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async (event) => {
	const env = getEnv(event);
	const body = await event.request.json().catch(() => ({})) as { password?: string };
	const password = body.password?.trim() ?? '';
	if (!password) {
		throw error(400, 'Password is required');
	}

	const isValid = await validatePasswordAgainstEnv(password, env);
	if (!isValid) {
		throw error(401, 'Invalid credentials');
	}

	const secret = requireSessionSecret(env);
	const sid = await setSessionCookie(event.cookies, secret);

	return created({
		authenticated: true,
		sessionId: sid
	});
};
