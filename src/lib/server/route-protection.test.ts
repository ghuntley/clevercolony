import { describe, expect, it } from 'vitest';
import { isUnprotectedPath } from './route-protection';

describe('isUnprotectedPath', () => {
	it('allows login route and static assets', () => {
		expect(isUnprotectedPath('/login')).toBe(true);
		expect(isUnprotectedPath('/_app/immutable/chunk.js')).toBe(true);
		expect(isUnprotectedPath('/_app/version.json')).toBe(true);
		expect(isUnprotectedPath('/favicon.ico')).toBe(true);
		expect(isUnprotectedPath('/robots.txt')).toBe(true);
		expect(isUnprotectedPath('/sitemap.xml')).toBe(true);
		expect(isUnprotectedPath('/manifest.webmanifest')).toBe(true);
		expect(isUnprotectedPath('/site.webmanifest')).toBe(true);
	});

	it('allows auth and health APIs without session', () => {
		expect(isUnprotectedPath('/api/auth')).toBe(true);
		expect(isUnprotectedPath('/api/auth/login')).toBe(true);
		expect(isUnprotectedPath('/api/auth/logout')).toBe(true);
		expect(isUnprotectedPath('/api/health')).toBe(true);
	});

	it('keeps business APIs protected', () => {
		expect(isUnprotectedPath('/')).toBe(false);
		expect(isUnprotectedPath('/api/chat')).toBe(false);
		expect(isUnprotectedPath('/api/audit')).toBe(false);
		expect(isUnprotectedPath('/api/conversations')).toBe(false);
		expect(isUnprotectedPath('/api/authz/login')).toBe(false);
		expect(isUnprotectedPath('/api/healthcheck')).toBe(false);
		expect(isUnprotectedPath('/api/health/ready')).toBe(false);
		expect(isUnprotectedPath('/favicon-admin')).toBe(false);
		expect(isUnprotectedPath('/robots.txt/extra')).toBe(false);
		expect(isUnprotectedPath('/sitemap.xml/extra')).toBe(false);
		expect(isUnprotectedPath('/manifest.webmanifest/extra')).toBe(false);
		expect(isUnprotectedPath('/site.webmanifest/extra')).toBe(false);
		expect(isUnprotectedPath('/_app')).toBe(false);
		expect(isUnprotectedPath('/_appx/version.json')).toBe(false);
	});
});
