import { spawn } from 'node:child_process';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { runSmokeProbes } from './smoke-probes.mjs';

async function findAvailablePort() {
	const server = createServer();
	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	const address = server.address();
	if (!address || typeof address === 'string') {
		server.close();
		throw new Error('Unable to determine available local port for preview smoke checks.');
	}
	const port = address.port;
	await new Promise((resolve, reject) => {
		server.close((error) => {
			if (error) reject(error);
			else resolve();
		});
	});
	return port;
}

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

async function waitForPreviewServer(child, baseUrl) {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		if (child.exitCode !== null) {
			throw new Error(`Preview server exited unexpectedly with code ${child.exitCode}`);
		}

		try {
			const response = await fetch(`${baseUrl}/api/health`);
			if (response.ok) {
				return;
			}
		} catch {
			// retry
		}

		await delay(500);
	}

	throw new Error('Timed out waiting for preview server to accept requests.');
}

async function stopPreviewServer(child) {
	if (child.exitCode !== null) return;

	child.kill('SIGTERM');
	await Promise.race([
		new Promise((resolve) => child.once('exit', resolve)),
		delay(5000)
	]);

	if (child.exitCode === null) {
		child.kill('SIGKILL');
		await new Promise((resolve) => child.once('exit', resolve));
	}
}

async function run() {
	const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
	const previewPort = await findAvailablePort();
	const baseUrl = `http://127.0.0.1:${previewPort}`;
	const testPassword = 'preview-smoke-password';
	const testPasswordHash = buildPasswordHash(testPassword);
	const sessionSecret = 'preview-smoke-session-secret';
	const preview = spawn(npmCommand, ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(previewPort)], {
		stdio: 'inherit',
		env: {
			...process.env,
			CI: '1',
			APP_ACCESS_PASSWORD_HASH: testPasswordHash,
			APP_SESSION_SECRET: sessionSecret
		}
	});

	try {
		await waitForPreviewServer(preview, baseUrl);
		await runSmokeProbes({
			baseUrl,
			password: testPassword,
			cookieSecurityPolicy: 'insecure'
		});
		console.log('Preview smoke checks passed.');
	} finally {
		await stopPreviewServer(preview);
	}
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
