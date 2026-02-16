import { pbkdf2Sync, randomBytes } from 'node:crypto';

export const PREVIEW_TEST_PASSWORD = 'preview-smoke-password';
export const PREVIEW_TEST_SESSION_SECRET = 'preview-smoke-session-secret';

function toBase64Url(bytes) {
	return Buffer.from(bytes)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

export function buildPasswordHash(password = PREVIEW_TEST_PASSWORD, iterations = 210_000) {
	const salt = randomBytes(16);
	const digest = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
	return `pbkdf2_sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(digest)}`;
}
