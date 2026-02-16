const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

export function fromBase64Url(input: string): Uint8Array {
	const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

export async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
	return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}

export async function importHmacKey(secret: string) {
	return crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

export async function signHmac(payload: string, secret: string): Promise<string> {
	const key = await importHmacKey(secret);
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
	return toBase64Url(new Uint8Array(signature));
}

export async function verifyHmac(payload: string, signature: string, secret: string): Promise<boolean> {
	const key = await importHmacKey(secret);
	return crypto.subtle.verify(
		'HMAC',
		key,
		fromBase64Url(signature) as unknown as BufferSource,
		encoder.encode(payload)
	);
}

/**
 * Hash format:
 *   pbkdf2_sha256$<iterations>$<salt-base64url>$<digest-base64url>
 */
export async function verifyPasswordHash(inputPassword: string, storedHash: string): Promise<boolean> {
	const [algorithm, iterationsRaw, saltRaw, digestRaw] = storedHash.split('$');
	if (algorithm !== 'pbkdf2_sha256' || !iterationsRaw || !saltRaw || !digestRaw) {
		return false;
	}

	const iterations = Number(iterationsRaw);
	if (!Number.isFinite(iterations) || iterations < 100_000) {
		return false;
	}

	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(inputPassword),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			hash: 'SHA-256',
			iterations,
			salt: fromBase64Url(saltRaw) as unknown as BufferSource
		},
		keyMaterial,
		256
	);
	const derivedBytes = new Uint8Array(derivedBits);
	const expectedBytes = fromBase64Url(digestRaw);

	if (expectedBytes.length !== derivedBytes.length) {
		return false;
	}

	let diff = 0;
	for (let index = 0; index < expectedBytes.length; index += 1) {
		diff |= expectedBytes[index] ^ derivedBytes[index];
	}
	return diff === 0;
}

export async function generateAuditHash(input: {
	prevHash: string;
	id: string;
	createdAt: number;
	actorSessionId: string;
	conversationId: string | null;
	actionType: string;
	payloadJson: string;
	promptText: string | null;
}): Promise<string> {
	const canonical = JSON.stringify({
		prevHash: input.prevHash,
		id: input.id,
		createdAt: input.createdAt,
		actorSessionId: input.actorSessionId,
		conversationId: input.conversationId,
		actionType: input.actionType,
		payloadJson: input.payloadJson,
		promptText: input.promptText
	});
	return sha256Hex(canonical);
}

export function decodeBase64(data: string): Uint8Array {
	const raw = atob(data);
	const bytes = new Uint8Array(raw.length);
	for (let index = 0; index < raw.length; index += 1) {
		bytes[index] = raw.charCodeAt(index);
	}
	return bytes;
}

export function decodeUtf8(bytes: Uint8Array): string {
	return decoder.decode(bytes);
}
