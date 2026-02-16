import { pbkdf2Sync, randomBytes } from 'node:crypto';
import process from 'node:process';
import { startPreviewServer, stopPreviewServer } from './preview-runtime.mjs';
import { runSmokeProbes } from './smoke-probes.mjs';

function toBase64Url(bytes) {
	return Buffer.from(bytes)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

function buildPasswordHash(password, iterations = 210_000) {
	const salt = randomBytes(16);
	const digest = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
	return `pbkdf2_sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(digest)}`;
}

async function run() {
	const testPassword = 'preview-smoke-password';
	const testPasswordHash = buildPasswordHash(testPassword);
	const sessionSecret = 'preview-smoke-session-secret';
	const preview = await startPreviewServer({
		extraEnv: {
			APP_ACCESS_PASSWORD_HASH: testPasswordHash,
			APP_SESSION_SECRET: sessionSecret
		}
	});

	try {
		await runSmokeProbes({
			baseUrl: preview.baseUrl,
			password: testPassword,
			cookieSecurityPolicy: 'insecure',
			includeCredentialChecks: true
		});
		console.log('Preview smoke checks passed.');
	} finally {
		await stopPreviewServer(preview.child);
	}
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
