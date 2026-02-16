import { spawn } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const BASE_URL = 'http://127.0.0.1:4173';
const PREVIEW_ARGS = ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'];

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

async function waitForPreviewServer(child) {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		if (child.exitCode !== null) {
			throw new Error(`Preview server exited unexpectedly with code ${child.exitCode}`);
		}

		try {
			const response = await fetch(`${BASE_URL}/api/health`);
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
	const preview = spawn(npmCommand, PREVIEW_ARGS, {
		stdio: 'inherit',
		env: { ...process.env, CI: '1' }
	});

	try {
		await waitForPreviewServer(preview);

		const healthResponse = await fetch(`${BASE_URL}/api/health`);
		assert(healthResponse.status === 200, `Expected /api/health 200, got ${healthResponse.status}`);
		const healthBody = await healthResponse.json();
		assert(healthBody.status === 'ok', 'Expected /api/health payload status=ok');
		assert(
			typeof healthBody.timestamp === 'number' && Number.isFinite(healthBody.timestamp),
			'Expected /api/health payload to include numeric timestamp'
		);

		const rootResponse = await fetch(`${BASE_URL}/`, { redirect: 'manual' });
		assert(rootResponse.status === 303, `Expected / to redirect with 303, got ${rootResponse.status}`);
		const location = rootResponse.headers.get('location') ?? '';
		assert(location.endsWith('/login'), `Expected / redirect location to end with /login, got "${location}"`);

		const modelsResponse = await fetch(`${BASE_URL}/api/models`, { redirect: 'manual' });
		assert(
			modelsResponse.status === 401,
			`Expected unauthenticated /api/models to return 401, got ${modelsResponse.status}`
		);

		console.log('Preview smoke checks passed.');
	} finally {
		await stopPreviewServer(preview);
	}
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
