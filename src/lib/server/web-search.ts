import type { Citation } from '$lib/types';
import { runSerperSearch } from './serper';

export type WebSearchStatus = 'disabled' | 'missing_api_key' | 'ok' | 'error';

export interface WebSearchResult {
	status: WebSearchStatus;
	citations: Citation[];
}

interface MaybeRunWebSearchInput {
	enabled: boolean;
	query: string;
	apiKey?: string;
	maxResults?: number;
	searchFn?: typeof runSerperSearch;
}

export async function maybeRunWebSearch(input: MaybeRunWebSearchInput): Promise<WebSearchResult> {
	if (!input.enabled) {
		return { status: 'disabled', citations: [] };
	}

	const key = input.apiKey?.trim();
	if (!key) {
		return { status: 'missing_api_key', citations: [] };
	}

	try {
		const searchFn = input.searchFn ?? runSerperSearch;
		const citations = await searchFn({
			apiKey: key,
			query: input.query,
			num: input.maxResults ?? 5
		});
		return { status: 'ok', citations };
	} catch {
		return { status: 'error', citations: [] };
	}
}
