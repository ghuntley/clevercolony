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

function getRequestTimeoutMsFromEnv() {
	const raw = process.env.SMOKE_REQUEST_TIMEOUT_MS?.trim();
	if (!raw) return undefined;
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed < 1_000 || parsed > 120_000) {
		throw new Error('SMOKE_REQUEST_TIMEOUT_MS must be an integer between 1000 and 120000.');
	}
	return parsed;
}

async function run() {
	const baseUrl = getBaseUrlFromEnv();
	const password = process.env.SMOKE_PASSWORD?.trim() || undefined;
	const cookieSecurityPolicy = baseUrl.startsWith('https://') ? 'secure' : 'insecure';
	const requestTimeoutMs = getRequestTimeoutMsFromEnv();
	await runSmokeProbes({
		baseUrl,
		password,
		cookieSecurityPolicy,
		requestTimeoutMs,
		includeCredentialChecks: Boolean(password)
	});
	console.log(`Deployed smoke checks passed for ${baseUrl}.`);
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
