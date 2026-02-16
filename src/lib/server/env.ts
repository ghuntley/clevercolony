import { error } from '@sveltejs/kit';

export function requireEnv(value: string | undefined, name: string): string {
	if (!value) {
		throw error(500, `Missing required environment variable: ${name}`);
	}

	return value;
}

export function getEnv(event: { platform: App.Platform | undefined }) {
	if (!event.platform?.env) {
		throw error(500, 'Cloudflare platform bindings are unavailable in this environment.');
	}

	return event.platform.env;
}
