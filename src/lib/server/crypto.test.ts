import { describe, expect, it } from 'vitest';
import { generateAuditHash, verifyPasswordHash } from './crypto';

function toBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

async function makeStoredHash(password: string, iterations = 210_000): Promise<string> {
	const salt = new Uint8Array(Array.from({ length: 16 }, (_, index) => index + 1));
	const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
		'deriveBits'
	]);
	const derived = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			hash: 'SHA-256',
			iterations,
			salt
		},
		keyMaterial,
		256
	);
	const digest = new Uint8Array(derived);
	return `pbkdf2_sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(digest)}`;
}

describe('verifyPasswordHash', () => {
	it('accepts a valid password for pbkdf2_sha256 hash', async () => {
		const password = 'correct horse battery staple';
		const stored = await makeStoredHash(password);

		await expect(verifyPasswordHash(password, stored)).resolves.toBe(true);
	});

	it('rejects invalid passwords and malformed hashes', async () => {
		const password = 'hunter2';
		const stored = await makeStoredHash(password);

		await expect(verifyPasswordHash('wrong password', stored)).resolves.toBe(false);
		await expect(verifyPasswordHash(password, 'not-a-valid-hash')).resolves.toBe(false);
	});

	it('rejects weak iteration counts', async () => {
		const password = 'safe password';
		const stored = await makeStoredHash(password, 10_000);

		await expect(verifyPasswordHash(password, stored)).resolves.toBe(false);
	});
});

describe('generateAuditHash', () => {
	it('is deterministic for identical input', async () => {
		const input = {
			prevHash: 'GENESIS',
			id: 'evt_1',
			createdAt: 12345,
			actorSessionId: 'sess_1',
			conversationId: 'conv_1',
			actionType: 'prompt.submit',
			payloadJson: '{"a":1}',
			promptText: 'hello'
		};

		const first = await generateAuditHash(input);
		const second = await generateAuditHash(input);
		expect(first).toEqual(second);
	});

	it('changes when payload changes', async () => {
		const base = await generateAuditHash({
			prevHash: 'GENESIS',
			id: 'evt_1',
			createdAt: 12345,
			actorSessionId: 'sess_1',
			conversationId: 'conv_1',
			actionType: 'prompt.submit',
			payloadJson: '{"a":1}',
			promptText: 'hello'
		});

		const changed = await generateAuditHash({
			prevHash: 'GENESIS',
			id: 'evt_1',
			createdAt: 12345,
			actorSessionId: 'sess_1',
			conversationId: 'conv_1',
			actionType: 'prompt.submit',
			payloadJson: '{"a":2}',
			promptText: 'hello'
		});

		expect(changed).not.toEqual(base);
	});
});
