import { error } from '@sveltejs/kit';
import type { ChatMessage, Citation, MemoryRecord, ProviderId } from '$lib/types';
import { decodeBase64 } from '$lib/server/crypto';
import { extractMermaidBlock } from '$lib/server/mermaid';

interface ProviderContext {
	env: App.Platform['env'];
}

function toProviderMessages(messages: ChatMessage[]) {
	return messages.map((message) => ({
		role: message.role,
		content: message.content
	}));
}

function buildSystemContext(input: {
	basePrompt?: string;
	memories: MemoryRecord[];
	citations: Citation[];
}): string | null {
	const sections: string[] = [];
	if (input.basePrompt) {
		sections.push(input.basePrompt);
	}

	if (input.memories.length > 0) {
		const memorySection = input.memories
			.slice(0, 12)
			.map((memory, index) => `${index + 1}. ${memory.content}`)
			.join('\n');
		sections.push(`Memory context:\n${memorySection}`);
	}

	if (input.citations.length > 0) {
		const webContext = input.citations
			.slice(0, 5)
			.map((citation, index) => `${index + 1}. ${citation.title}\nURL: ${citation.url}\nSnippet: ${citation.snippet}`)
			.join('\n\n');
		sections.push(`Web search context:\n${webContext}`);
	}

	if (sections.length === 0) return null;
	return sections.join('\n\n');
}

export async function generateTextResponse(input: {
	context: ProviderContext;
	provider: ProviderId;
	model: string;
	messages: ChatMessage[];
	memories: MemoryRecord[];
	citations: Citation[];
}): Promise<{
	text: string;
	diagram: ReturnType<typeof extractMermaidBlock>;
}> {
	const contextualSystemPrompt = buildSystemContext({
		basePrompt:
			'You are Clever Colony assistant. Be concise and factual. If web context is provided, cite sources in markdown list format.',
		memories: input.memories,
		citations: input.citations
	});

	const upstreamMessages = toProviderMessages(input.messages);
	if (contextualSystemPrompt) {
		upstreamMessages.unshift({
			role: 'system',
			content: contextualSystemPrompt
		});
	}

	if (input.provider === 'zai') {
		const apiKey = input.context.env.ZAI_API_KEY;
		if (!apiKey) {
			throw error(500, 'ZAI_API_KEY is required for ZAI requests');
		}

		const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
			method: 'POST',
			headers: {
				authorization: `Bearer ${apiKey}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				model: input.model,
				messages: upstreamMessages,
				stream: false
			})
		});

		if (!response.ok) {
			throw error(response.status, 'Failed to call ZAI chat provider');
		}
		const data = (await response.json()) as {
			choices?: { message?: { content?: string } }[];
		};
		const text = data.choices?.[0]?.message?.content ?? '';
		return {
			text,
			diagram: extractMermaidBlock(text)
		};
	}

	if (!input.context.env.AI) {
		throw error(500, 'Cloudflare AI binding is not configured');
	}

	const result = (await input.context.env.AI.run(input.model as keyof AiModels, {
		messages: upstreamMessages
	})) as
		| string
		| {
				response?: string;
				result?: { response?: string };
		  };

	const text =
		typeof result === 'string' ? result : result.response ?? result.result?.response ?? 'No response returned.';
	return {
		text,
		diagram: extractMermaidBlock(text)
	};
}

async function fetchImageFromUrl(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
	const response = await fetch(url);
	if (!response.ok) {
		throw error(response.status, 'Failed to download generated image URL');
	}
	const arrayBuffer = await response.arrayBuffer();
	return {
		bytes: new Uint8Array(arrayBuffer),
		contentType: response.headers.get('content-type') ?? 'image/png'
	};
}

export async function generateImage(input: {
	context: ProviderContext;
	provider: ProviderId;
	model: string;
	prompt: string;
}): Promise<{ bytes: Uint8Array; contentType: string }> {
	if (input.provider === 'zai') {
		const apiKey = input.context.env.ZAI_API_KEY;
		if (!apiKey) {
			throw error(500, 'ZAI_API_KEY is required for ZAI image generation');
		}
		const response = await fetch('https://api.z.ai/api/paas/v4/images/generations', {
			method: 'POST',
			headers: {
				authorization: `Bearer ${apiKey}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				model: input.model,
				prompt: input.prompt
			})
		});
		if (!response.ok) {
			throw error(response.status, 'Failed to call ZAI image provider');
		}

		const data = (await response.json()) as {
			data?: Array<{ url?: string; b64_json?: string }>;
		};
		const imageData = data.data?.[0];
		if (!imageData) {
			throw error(502, 'ZAI image generation returned no image data');
		}
		if (imageData.b64_json) {
			return {
				bytes: decodeBase64(imageData.b64_json),
				contentType: 'image/png'
			};
		}
		if (imageData.url) {
			return fetchImageFromUrl(imageData.url);
		}
		throw error(502, 'Unsupported ZAI image payload');
	}

	if (!input.context.env.AI) {
		throw error(500, 'Cloudflare AI binding is not configured');
	}

	const result = (await input.context.env.AI.run(input.model as keyof AiModels, {
		prompt: input.prompt
	})) as
		| ArrayBuffer
		| Uint8Array
		| {
				image?: string;
		  };

	if (result instanceof ArrayBuffer) {
		return {
			bytes: new Uint8Array(result),
			contentType: 'image/png'
		};
	}
	if (result instanceof Uint8Array) {
		return {
			bytes: result,
			contentType: 'image/png'
		};
	}
	if (result?.image) {
		return {
			bytes: decodeBase64(result.image),
			contentType: 'image/png'
		};
	}

	throw error(502, 'Unsupported Cloudflare image payload');
}
