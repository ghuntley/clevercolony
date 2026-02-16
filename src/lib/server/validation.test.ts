import { describe, expect, it } from 'vitest';
import {
	auditQuerySchema,
	chatRequestSchema,
	createConversationRequestSchema,
	createMemoryRequestSchema,
	imageRequestSchema,
	loginRequestSchema,
	memoryDeleteQuerySchema,
	memoryListQuerySchema,
	parseJsonBody,
	parsePathParam,
	parseSearchParams,
	updateConversationRequestSchema,
	updateMemoryRequestSchema,
	webSearchToolRequestSchema
} from './validation';

describe('parseJsonBody', () => {
	it('rejects invalid json payloads', async () => {
		const request = new Request('http://example.test/chat', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{'
		});
		await expect(parseJsonBody(request, chatRequestSchema)).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid JSON body' }
		});
	});

	it('returns parsed and trimmed payloads', async () => {
		const request = new Request('http://example.test/chat', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				conversationId: '  conv_123  ',
				text: '  hello world  ',
				webSearchEnabled: true
			})
		});
		const payload = await parseJsonBody(request, chatRequestSchema);
		expect(payload).toMatchObject({
			conversationId: 'conv_123',
			text: 'hello world',
			webSearchEnabled: true
		});
	});

	it('rejects schema-invalid payloads', async () => {
		const request = new Request('http://example.test/images', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				conversationId: 'conv_123',
				prompt: ''
			})
		});
		await expect(parseJsonBody(request, imageRequestSchema)).rejects.toMatchObject({
			status: 400,
			body: { message: 'prompt is required' }
		});
	});

	it('rejects empty conversation patch payload', async () => {
		const request = new Request('http://example.test/conversations/id', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({})
		});
		await expect(parseJsonBody(request, updateConversationRequestSchema)).rejects.toMatchObject({
			status: 400,
			body: { message: 'No updatable fields provided' }
		});
	});

	it('accepts valid conversation creation payload', async () => {
		const request = new Request('http://example.test/conversations', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				title: '  Product roadmap  ',
				model: 'glm-4.7'
			})
		});
		const payload = await parseJsonBody(request, createConversationRequestSchema);
		expect(payload).toMatchObject({
			title: 'Product roadmap',
			model: 'glm-4.7'
		});
	});

	it('requires conversationId for conversation-scoped memory', async () => {
		const request = new Request('http://example.test/memories', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				scope: 'conversation',
				content: 'Remember this'
			})
		});
		await expect(parseJsonBody(request, createMemoryRequestSchema)).rejects.toMatchObject({
			status: 400,
			body: { message: 'conversationId is required for conversation memory' }
		});
	});

	it('requires at least one memory update field', async () => {
		const request = new Request('http://example.test/memories', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				id: 'mem_123'
			})
		});
		await expect(parseJsonBody(request, updateMemoryRequestSchema)).rejects.toMatchObject({
			status: 400,
			body: { message: 'No memory updates provided' }
		});
	});

	it('rejects blank password payloads', async () => {
		const request = new Request('http://example.test/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ password: '   ' })
		});
		await expect(parseJsonBody(request, loginRequestSchema)).rejects.toMatchObject({
			status: 400,
			body: { message: 'Password is required' }
		});
	});

	it('validates web search locale codes', async () => {
		const request = new Request('http://example.test/tools/web-search', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				query: 'latest model releases',
				gl: 'USA'
			})
		});
		await expect(parseJsonBody(request, webSearchToolRequestSchema)).rejects.toMatchObject({
			status: 400,
			body: { message: 'gl must be 2 letters' }
		});
	});
});

describe('parseSearchParams', () => {
	it('parses defaults for omitted audit params', () => {
		const parsed = parseSearchParams(new URLSearchParams(), auditQuerySchema);
		expect(parsed).toMatchObject({
			limit: 50,
			offset: 0,
			verify: false
		});
	});

	it('rejects audit date ranges where from > to', () => {
		expect(() =>
			parseSearchParams(
				new URLSearchParams([
					['dateFrom', '2026-02-10'],
					['dateTo', '2026-02-01']
				]),
				auditQuerySchema
			)
		).toThrow();
	});

	it('parses optional audit filter params', () => {
		const parsed = parseSearchParams(
			new URLSearchParams([
				['actionType', 'prompt.submit'],
				['conversationId', 'conv_abc'],
				['conversationQuery', 'conv_'],
				['dateFrom', '2026-02-01'],
				['dateTo', '2026-02-10'],
				['verify', '1']
			]),
			auditQuerySchema
		);
		expect(parsed).toMatchObject({
			actionType: 'prompt.submit',
			conversationId: 'conv_abc',
			conversationQuery: 'conv_',
			dateFrom: '2026-02-01',
			dateTo: '2026-02-10',
			verify: true
		});
	});

	it('rejects invalid audit date formats', () => {
		expect(() =>
			parseSearchParams(new URLSearchParams([['dateFrom', '2026/02/01']]), auditQuerySchema)
		).toThrow();
		try {
			parseSearchParams(new URLSearchParams([['dateFrom', '2026/02/01']]), auditQuerySchema);
		} catch (thrown) {
			expect(thrown).toMatchObject({
				status: 400,
				body: { message: 'dateFrom must be YYYY-MM-DD' }
			});
		}
	});

	it('rejects invalid audit pagination params', () => {
		expect(() => parseSearchParams(new URLSearchParams([['limit', '0']]), auditQuerySchema)).toThrow();
		try {
			parseSearchParams(new URLSearchParams([['limit', '0']]), auditQuerySchema);
		} catch (thrown) {
			expect(thrown).toMatchObject({
				status: 400,
				body: { message: 'limit must be >= 1' }
			});
		}
	});

	it('parses memory list query params', () => {
		const parsed = parseSearchParams(
			new URLSearchParams([['conversationId', 'conv_123']]),
			memoryListQuerySchema
		);
		expect(parsed).toMatchObject({ conversationId: 'conv_123' });
	});

	it('requires memory id in delete query', () => {
		expect(() => parseSearchParams(new URLSearchParams(), memoryDeleteQuerySchema)).toThrow();
	});
});

describe('parsePathParam', () => {
	it('returns valid path parameter values', () => {
		expect(parsePathParam('  convo_123  ', 'conversationId')).toBe('convo_123');
	});

	it('throws on missing values', () => {
		expect(() => parsePathParam(undefined, 'imageId')).toThrow();
	});
});
