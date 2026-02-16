import { created } from '$lib/server/http';
import { getEnv } from '$lib/server/env';
import {
	requireSessionSecret,
	setSessionCookie,
	shouldUseSecureCookies,
	validatePasswordAgainstEnv
} from '$lib/server/auth';
import { logAuditEvent } from '$lib/server/audit';
import { loginRequestSchema, parseJsonBody } from '$lib/server/validation';
import { error, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async (event) => {
	const env = getEnv(event);
	const body = await parseJsonBody(event.request, loginRequestSchema);
	const password = body.password;

	const isValid = await validatePasswordAgainstEnv(password, env);
	if (!isValid) {
		throw error(401, 'Invalid credentials');
	}

	const secret = requireSessionSecret(env);
	const sid = await setSessionCookie(event.cookies, secret, {
		secure: shouldUseSecureCookies(event.url)
	});
	await logAuditEvent({
		db: env.DB,
		sessionId: sid,
		actionType: 'auth.login',
		payload: {
			success: true
		}
	});

	return created({
		authenticated: true
	});
};
