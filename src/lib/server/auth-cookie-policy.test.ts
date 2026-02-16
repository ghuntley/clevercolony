import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { setSessionCookie, shouldUseSecureCookies } from './auth';

function createCookieSpy(): {
	cookies: Cookies;
	calls: Array<{ name: string; value: string; options: Parameters<Cookies['set']>[2] }>;
} {
	const calls: Array<{ name: string; value: string; options: Parameters<Cookies['set']>[2] }> = [];
	const cookies = {
		get: () => undefined,
		getAll: () => [],
		set: (name: string, value: string, options: Parameters<Cookies['set']>[2]) => {
			calls.push({ name, value, options });
		},
		delete: () => {},
		serialize: () => ''
	} satisfies Cookies;

	return { cookies, calls };
}

describe('shouldUseSecureCookies', () => {
	it('returns true for https urls', () => {
		expect(shouldUseSecureCookies(new URL('https://clever-colony.example'))).toBe(true);
	});

	it('returns false for http urls', () => {
		expect(shouldUseSecureCookies(new URL('http://localhost:5173'))).toBe(false);
	});
});

describe('setSessionCookie', () => {
	it('uses secure cookies by default', async () => {
		const { cookies, calls } = createCookieSpy();
		await setSessionCookie(cookies, 'secret-key');
		expect(calls).toHaveLength(1);
		expect(calls[0]?.name).toBe('clever_colony_session');
		expect(calls[0]?.options?.secure).toBe(true);
	});

	it('supports opting out of secure cookies for local http dev', async () => {
		const { cookies, calls } = createCookieSpy();
		await setSessionCookie(cookies, 'secret-key', { secure: false });
		expect(calls).toHaveLength(1);
		expect(calls[0]?.options?.secure).toBe(false);
	});
});
