import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

async function findAvailablePort() {
	const server = createServer();
	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	const address = server.address();
	if (!address || typeof address === 'string') {
		server.close();
		throw new Error('Unable to determine available local port for preview checks.');
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

async function waitForPreviewServer(child, baseUrl, timeoutMs) {
	const retryDelayMs = 500;
	const maxAttempts = Math.max(1, Math.ceil(timeoutMs / retryDelayMs));
	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
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

		await delay(retryDelayMs);
	}

	throw new Error('Timed out waiting for preview server to accept requests.');
}

export async function startPreviewServer(options = {}) {
	const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
	const previewPort = await findAvailablePort();
	const baseUrl = `http://127.0.0.1:${previewPort}`;
	const preview = spawn(
		npmCommand,
		['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'],
		{
			stdio: 'inherit',
			env: {
				...process.env,
				CI: '1',
				...(options.extraEnv ?? {})
			}
		}
	);
	await waitForPreviewServer(preview, baseUrl, options.readinessTimeoutMs ?? 20_000);
	return {
		child: preview,
		baseUrl,
		port: previewPort
	};
}

export async function stopPreviewServer(child) {
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
