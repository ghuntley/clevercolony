import process from 'node:process';
import { applyLocalD1Migrations } from './local-d1.mjs';
import { startPreviewServer, stopPreviewServer } from './preview-runtime.mjs';
import { runSmokeProbes } from './smoke-probes.mjs';
import {
	PREVIEW_TEST_PASSWORD,
	PREVIEW_TEST_SESSION_SECRET,
	buildPasswordHash
} from './test-auth-credentials.mjs';

async function run() {
	await applyLocalD1Migrations();

	const testPassword = PREVIEW_TEST_PASSWORD;
	const testPasswordHash = buildPasswordHash(testPassword);
	const preview = await startPreviewServer({
		extraEnv: {
			APP_ACCESS_PASSWORD_HASH: testPasswordHash,
			APP_SESSION_SECRET: PREVIEW_TEST_SESSION_SECRET
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
