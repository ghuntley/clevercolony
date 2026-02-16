import { afterEach, describe, expect, it, vi } from 'vitest';
import { runSerperSearch } from './serper';

const mockFetch = vi.fn<typeof fetch>();

describe('runSerperSearch', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		mockFetch.mockReset();
	});

	it('maps serper response into normalized citations', async () => {
		mockFetch.mockResolvedValue(
			new Response(
				JSON.stringify({
					knowledgeGraph: {
						title: 'Example KG',
						description: 'Knowledge graph description',
						website: 'https://example.com/kg'
					},
					organic: [
						{
							title: 'Result 1',
							link: 'https://example.com/1',
							snippet: 'Snippet 1',
							source: 'news'
						},
						{
							title: 'Result 2',
							link: 'https://example.com/2',
							snippet: 'Snippet 2'
						}
					]
				}),
				{ status: 200 }
			)
		);
		vi.stubGlobal('fetch', mockFetch);

		const citations = await runSerperSearch({
			apiKey: 'serper-key',
			query: 'latest svelte',
			num: 3
		});

		expect(citations).toEqual([
			{
				title: 'Example KG',
				url: 'https://example.com/kg',
				snippet: 'Knowledge graph description',
				source: 'knowledgeGraph'
			},
			{
				title: 'Result 1',
				url: 'https://example.com/1',
				snippet: 'Snippet 1',
				source: 'news'
			},
			{
				title: 'Result 2',
				url: 'https://example.com/2',
				snippet: 'Snippet 2',
				source: 'organic'
			}
		]);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toBe('https://google.serper.dev/search');
		expect(init?.method).toBe('POST');
		expect((init?.headers as Record<string, string>)['X-API-KEY']).toBe('serper-key');
	});

	it('throws on non-ok responses', async () => {
		mockFetch.mockResolvedValue(new Response('bad request', { status: 400 }));
		vi.stubGlobal('fetch', mockFetch);

		await expect(
			runSerperSearch({
				apiKey: 'serper-key',
				query: 'query'
			})
		).rejects.toMatchObject({
			status: 400,
			body: { message: 'Serper search request failed' }
		});
	});
});
