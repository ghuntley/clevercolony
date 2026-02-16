import { describe, expect, it } from 'vitest';
import { isUnprotectedPath } from './route-protection';

describe('isUnprotectedPath', () => {
	it('allows login route and static assets', () => {
		expect(isUnprotectedPath('/login')).toBe(true);
		expect(isUnprotectedPath('/_app/immutable/chunk.js')).toBe(true);
		expect(isUnprotectedPath('/favicon.ico')).toBe(true);
		expect(isUnprotectedPath('/robots.txt')).toBe(true);
	});

	it('allows auth and health APIs without session', () => {
		expect(isUnprotectedPath('/api/auth/login')).toBe(true);
		expect(isUnprotectedPath('/api/auth/logout')).toBe(true);
		expect(isUnprotectedPath('/api/health')).toBe(true);
	});

	it('keeps business APIs protected', () => {
		expect(isUnprotectedPath('/')).toBe(false);
		expect(isUnprotectedPath('/api/chat')).toBe(false);
		expect(isUnprotectedPath('/api/audit')).toBe(false);
		expect(isUnprotectedPath('/api/conversations')).toBe(false);
	});
});
