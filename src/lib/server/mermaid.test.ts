import { describe, expect, it } from 'vitest';
import { extractMermaidBlock, normalizeMermaidSource } from './mermaid';

describe('normalizeMermaidSource', () => {
	it('trims and preserves valid mermaid source', () => {
		const result = normalizeMermaidSource('   flowchart TD\nA-->B   ');
		expect(result.diagramType).toBe('mermaid');
		expect(result.mermaidSource).toBe('flowchart TD\nA-->B');
	});

	it('throws for empty source', () => {
		expect(() => normalizeMermaidSource('   ')).toThrow();
		try {
			normalizeMermaidSource('   ');
		} catch (thrown) {
			expect(thrown).toMatchObject({ status: 400, body: { message: 'Mermaid source cannot be empty' } });
		}
	});

	it('throws for oversized source', () => {
		expect(() => normalizeMermaidSource('a'.repeat(24_001))).toThrow();
		try {
			normalizeMermaidSource('a'.repeat(24_001));
		} catch (thrown) {
			expect(thrown).toMatchObject({
				status: 400,
				body: { message: 'Mermaid source exceeds 24000 characters' }
			});
		}
	});
});

describe('extractMermaidBlock', () => {
	it('extracts fenced mermaid blocks', () => {
		const content = [
			'Some text before',
			'```mermaid',
			'flowchart TD',
			'A-->B',
			'```',
			'Some text after'
		].join('\n');
		const result = extractMermaidBlock(content);
		expect(result).not.toBeNull();
		expect(result?.mermaidSource).toBe('flowchart TD\nA-->B');
	});

	it('returns null when no mermaid fence exists', () => {
		expect(extractMermaidBlock('No diagram here')).toBeNull();
	});
});
