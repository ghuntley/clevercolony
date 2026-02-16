import { describe, expect, it } from 'vitest';
import { isProviderCompatibleWithModel } from './model-provider';

describe('isProviderCompatibleWithModel', () => {
	it('accepts undefined provider as compatible', () => {
		expect(isProviderCompatibleWithModel(undefined, 'zai')).toBe(true);
	});

	it('accepts matching providers', () => {
		expect(isProviderCompatibleWithModel('zai', 'zai')).toBe(true);
		expect(isProviderCompatibleWithModel('cloudflare-ai', 'cloudflare-ai')).toBe(true);
	});

	it('rejects mismatched provider and model', () => {
		expect(isProviderCompatibleWithModel('zai', 'cloudflare-ai')).toBe(false);
		expect(isProviderCompatibleWithModel('cloudflare-ai', 'zai')).toBe(false);
	});
});
