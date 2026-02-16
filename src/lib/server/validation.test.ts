import { describe, expect, it } from 'vitest';
import {
	chatRequestSchema,
	createConversationRequestSchema,
	imageRequestSchema,
	parseJsonBody,
	updateConversationRequestSchema
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
});
