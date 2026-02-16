import process from 'node:process';
import { runSmokeProbes } from './smoke-probes.mjs';

function getBaseUrlFromEnv() {
	const raw = process.env.SMOKE_BASE_URL?.trim();
	if (!raw) {
		throw new Error('SMOKE_BASE_URL is required (example: https://your-pages-domain.example).');
	}
	const parsed = new URL(raw);
	parsed.pathname = '';
	parsed.search = '';
	parsed.hash = '';
	return parsed.toString().replace(/\/$/, '');
}

async function run() {
	const baseUrl = getBaseUrlFromEnv();
	const password = process.env.SMOKE_PASSWORD?.trim() || undefined;
	const cookieSecurityPolicy = baseUrl.startsWith('https://') ? 'secure' : 'insecure';
	await runSmokeProbes({
		baseUrl,
		password,
		cookieSecurityPolicy
	});
	console.log(`Deployed smoke checks passed for ${baseUrl}.`);
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
