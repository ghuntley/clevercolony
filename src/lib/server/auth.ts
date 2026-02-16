import { error, redirect, type Cookies, type RequestEvent } from '@sveltejs/kit';
import { requireEnv } from './env';
import { signHmac, verifyHmac, verifyPasswordHash } from './crypto';

const SESSION_COOKIE = 'clever_colony_session';

interface SessionPayload {
	sid: string;
	iat: number;
}

function randomId(): string {
	return crypto.randomUUID();
}

function encodePayload(payload: SessionPayload): string {
	return btoa(JSON.stringify(payload))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

function decodePayload(raw: string): SessionPayload | null {
	try {
		const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((raw.length + 3) % 4);
		const decoded = atob(padded);
		const parsed = JSON.parse(decoded) as SessionPayload;
		if (!parsed.sid || !parsed.iat) return null;
		return parsed;
	} catch {
		return null;
	}
}

export async function createSessionCookieValue(secret: string): Promise<{ value: string; sid: string }> {
	const payload: SessionPayload = {
		sid: randomId(),
		iat: Date.now()
	};
	const payloadRaw = encodePayload(payload);
	const signature = await signHmac(payloadRaw, secret);
	return {
		value: `${payloadRaw}.${signature}`,
		sid: payload.sid
	};
}

export function shouldUseSecureCookies(requestUrl: URL): boolean {
	return requestUrl.protocol === 'https:';
}

export async function setSessionCookie(
	cookies: Cookies,
	secret: string,
	options?: {
		secure?: boolean;
	}
): Promise<string> {
	const session = await createSessionCookieValue(secret);
	cookies.set(SESSION_COOKIE, session.value, {
		path: '/',
		httpOnly: true,
		secure: options?.secure ?? true,
		sameSite: 'lax'
	});
	return session.sid;
}

export function clearSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, {
		path: '/'
	});
}

export async function readSessionId(cookies: Cookies, secret: string): Promise<string | null> {
	const raw = cookies.get(SESSION_COOKIE);
	if (!raw) return null;
	const [payloadRaw, signature] = raw.split('.');
	if (!payloadRaw || !signature) return null;
	const isValid = await verifyHmac(payloadRaw, signature, secret);
	if (!isValid) return null;
	const payload = decodePayload(payloadRaw);
	return payload?.sid ?? null;
}

export async function validatePasswordAgainstEnv(
	password: string,
	env: App.Platform['env']
): Promise<boolean> {
	const hash = requireEnv(env.APP_ACCESS_PASSWORD_HASH, 'APP_ACCESS_PASSWORD_HASH');
	return verifyPasswordHash(password, hash);
}

export function requireAuthenticated(event: RequestEvent) {
	if (!event.locals.authenticated) {
		throw redirect(303, '/login');
	}
}

export function requireSessionSecret(env: App.Platform['env']) {
	return requireEnv(env.APP_SESSION_SECRET, 'APP_SESSION_SECRET');
}

export function assertAuthenticatedApi(event: RequestEvent) {
	if (!event.locals.authenticated || !event.locals.sessionId) {
		throw error(401, 'Authentication required');
	}
}
