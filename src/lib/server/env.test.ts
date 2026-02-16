import { afterEach, describe, expect, it } from 'vitest';
import { requireEnv, optionalEnv } from './env';

describe('env helpers', () => {
	const originalAccessHash = process.env.APP_ACCESS_PASSWORD_HASH;

	afterEach(() => {
		if (originalAccessHash === undefined) {
			delete process.env.APP_ACCESS_PASSWORD_HASH;
		} else {
			process.env.APP_ACCESS_PASSWORD_HASH = originalAccessHash;
		}
	});

	it('uses direct binding value when provided', () => {
		process.env.APP_ACCESS_PASSWORD_HASH = 'process-value';
		expect(requireEnv('binding-value', 'APP_ACCESS_PASSWORD_HASH')).toBe('binding-value');
	});

	it('falls back to process env when binding value is missing', () => {
		process.env.APP_ACCESS_PASSWORD_HASH = 'process-value';
		expect(requireEnv(undefined, 'APP_ACCESS_PASSWORD_HASH')).toBe('process-value');
		expect(optionalEnv(undefined, 'APP_ACCESS_PASSWORD_HASH')).toBe('process-value');
	});

	it('throws when required value is unavailable in binding and process env', () => {
		delete process.env.APP_ACCESS_PASSWORD_HASH;
		expect(() => requireEnv(undefined, 'APP_ACCESS_PASSWORD_HASH')).toThrow();
		try {
			requireEnv(undefined, 'APP_ACCESS_PASSWORD_HASH');
		} catch (error) {
			expect(String(error)).toContain('Missing required environment variable: APP_ACCESS_PASSWORD_HASH');
		}
		expect(optionalEnv(undefined, 'APP_ACCESS_PASSWORD_HASH')).toBeUndefined();
	});
});
