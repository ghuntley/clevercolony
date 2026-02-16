import { describe, expect, it, vi } from 'vitest';
import { maybeRunWebSearch } from './web-search';

describe('maybeRunWebSearch', () => {
	it('skips search when disabled', async () => {
		const result = await maybeRunWebSearch({
			enabled: false,
			query: 'latest llm news'
		});
		expect(result).toEqual({ status: 'disabled', citations: [] });
	});

	it('skips search when api key missing', async () => {
		const result = await maybeRunWebSearch({
			enabled: true,
			query: 'latest llm news',
			apiKey: ' '
		});
		expect(result).toEqual({ status: 'missing_api_key', citations: [] });
	});

	it('returns citations when search succeeds', async () => {
		const result = await maybeRunWebSearch({
			enabled: true,
			query: 'latest llm news',
			apiKey: 'secret',
			searchFn: vi.fn(async () => [
				{
					title: 'Title',
					url: 'https://example.com',
					snippet: 'summary'
				}
			])
		});
		expect(result.status).toBe('ok');
		expect(result.citations).toHaveLength(1);
	});

	it('falls back gracefully when provider fails', async () => {
		const result = await maybeRunWebSearch({
			enabled: true,
			query: 'latest llm news',
			apiKey: 'secret',
			searchFn: vi.fn(async () => {
				throw new Error('boom');
			})
		});
		expect(result).toEqual({ status: 'error', citations: [] });
	});
});
