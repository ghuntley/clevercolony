import { error } from '@sveltejs/kit';
import type { Citation } from '$lib/types';

interface SerperResult {
	title?: string;
	link?: string;
	snippet?: string;
	source?: string;
}

interface SerperResponse {
	organic?: SerperResult[];
	knowledgeGraph?: {
		title?: string;
		description?: string;
		website?: string;
	};
	peopleAlsoAsk?: SerperResult[];
	relatedSearches?: { query?: string }[];
}

export async function runSerperSearch(input: {
	apiKey: string;
	query: string;
	gl?: string;
	hl?: string;
	num?: number;
}): Promise<Citation[]> {
	const payload = {
		q: input.query,
		gl: input.gl ?? 'us',
		hl: input.hl ?? 'en',
		num: Math.min(Math.max(input.num ?? 5, 1), 10),
		autocorrect: true,
		page: 1
	};

	const response = await fetch('https://google.serper.dev/search', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'X-API-KEY': input.apiKey
		},
		body: JSON.stringify(payload)
	});

	if (!response.ok) {
		throw error(response.status, 'Serper search request failed');
	}

	const data = (await response.json()) as SerperResponse;
	const citations: Citation[] = [];

	if (data.knowledgeGraph?.title && data.knowledgeGraph.website) {
		citations.push({
			title: data.knowledgeGraph.title,
			url: data.knowledgeGraph.website,
			snippet: data.knowledgeGraph.description ?? '',
			source: 'knowledgeGraph'
		});
	}

	for (const item of data.organic ?? []) {
		if (!item.title || !item.link) continue;
		citations.push({
			title: item.title,
			url: item.link,
			snippet: item.snippet ?? '',
			source: item.source ?? 'organic'
		});
	}

	return citations.slice(0, payload.num);
}
