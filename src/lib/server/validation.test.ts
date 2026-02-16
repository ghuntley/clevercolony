import { describe, expect, it } from 'vitest';
import { chatRequestSchema, imageRequestSchema, parseJsonBody } from './validation';

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
});
