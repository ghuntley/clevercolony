import { error } from '@sveltejs/kit';

function resolveProcessEnv(name: string): string | undefined {
	if (typeof process === 'undefined') return undefined;
	return process.env?.[name];
}

export function requireEnv(value: string | undefined, name: string): string {
	const resolved = value ?? resolveProcessEnv(name);
	if (!resolved) {
		throw error(500, `Missing required environment variable: ${name}`);
	}

	return resolved;
}

export function optionalEnv(value: string | undefined, name: string): string | undefined {
	return value ?? resolveProcessEnv(name);
}

export function getEnv(event: { platform: App.Platform | undefined }) {
	if (!event.platform?.env) {
		throw error(500, 'Cloudflare platform bindings are unavailable in this environment.');
	}

	return event.platform.env;
}
