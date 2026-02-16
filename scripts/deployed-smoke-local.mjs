import { spawn } from 'node:child_process';
import process from 'node:process';
import { startPreviewServer, stopPreviewServer } from './preview-runtime.mjs';

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
	const preview = await startPreviewServer();

	try {
		await runNodeScript('scripts/deployed-smoke.mjs', {
			...process.env,
			SMOKE_BASE_URL: preview.baseUrl
		});
		console.log('Local deployed-smoke runner checks passed (unauthenticated probes).');
	} finally {
		await stopPreviewServer(preview.child);
	}
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
