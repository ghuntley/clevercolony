import { error } from '@sveltejs/kit';
import type { DiagramPayload } from '$lib/types';

export const MAX_MERMAID_LENGTH = 24_000;

export function normalizeMermaidSource(source: string): DiagramPayload {
	const cleaned = source.trim();
	if (!cleaned) {
		throw error(400, 'Mermaid source cannot be empty');
	}
	if (cleaned.length > MAX_MERMAID_LENGTH) {
		throw error(400, `Mermaid source exceeds ${MAX_MERMAID_LENGTH} characters`);
	}
	return {
		diagramType: 'mermaid',
		mermaidSource: cleaned
	};
}

export function extractMermaidBlock(content: string): DiagramPayload | null {
	const match = content.match(/```mermaid\s*([\s\S]*?)```/i);
	if (!match?.[1]) {
		return null;
	}
	return normalizeMermaidSource(match[1]);
}
