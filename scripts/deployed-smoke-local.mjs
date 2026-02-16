import { spawn } from 'node:child_process';
import process from 'node:process';
import { applyLocalD1Migrations } from './local-d1.mjs';
import { startPreviewServer, stopPreviewServer } from './preview-runtime.mjs';
import {
	PREVIEW_TEST_PASSWORD,
	PREVIEW_TEST_SESSION_SECRET,
	buildPasswordHash
} from './test-auth-credentials.mjs';

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

	const testPassword = PREVIEW_TEST_PASSWORD;
	const preview = await startPreviewServer({
		extraEnv: {
			APP_ACCESS_PASSWORD_HASH: buildPasswordHash(testPassword),
			APP_SESSION_SECRET: PREVIEW_TEST_SESSION_SECRET
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
