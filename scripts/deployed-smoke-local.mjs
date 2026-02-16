import { spawn } from 'node:child_process';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import process from 'node:process';
import { applyLocalD1Migrations } from './local-d1.mjs';
import { startPreviewServer, stopPreviewServer } from './preview-runtime.mjs';

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

async function runNodeScript(scriptPath, env) {
	const child = spawn(process.execPath, [scriptPath], {
		stdio: 'inherit',
		env
	});
	const exitCode = await new Promise((resolve, reject) => {
		child.once('error', reject);
		child.once('exit', resolve);
	});
	if (exitCode !== 0) {
		throw new Error(`${scriptPath} exited with code ${exitCode}`);
	}
}

async function run() {
	await applyLocalD1Migrations();

	const testPassword = 'preview-smoke-password';
	const preview = await startPreviewServer({
		extraEnv: {
			APP_ACCESS_PASSWORD_HASH: buildPasswordHash(testPassword),
			APP_SESSION_SECRET: 'preview-smoke-session-secret'
		}
	});

	try {
		await runNodeScript('scripts/deployed-smoke.mjs', {
			...process.env,
			SMOKE_BASE_URL: preview.baseUrl
		});
		await runNodeScript('scripts/deployed-smoke.mjs', {
			...process.env,
			SMOKE_BASE_URL: preview.baseUrl,
			SMOKE_PASSWORD: testPassword
		});
		console.log('Local deployed-smoke runner checks passed (unauthenticated + authenticated probes).');
	} finally {
		await stopPreviewServer(preview.child);
	}
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
