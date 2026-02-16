// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: {
				DB: D1Database;
				MEDIA_BUCKET: R2Bucket;
				AI: Ai;
				ZAI_API_KEY?: string;
				SERPER_API_KEY?: string;
				APP_ACCESS_PASSWORD_HASH?: string;
				APP_SESSION_SECRET?: string;
				CF_ACCOUNT_ID?: string;
				CF_API_TOKEN?: string;
			};
			cf?: IncomingRequestCfProperties;
			ctx: ExecutionContext;
		}

		interface Locals {
			authenticated: boolean;
			sessionId: string | null;
		}
	}
}

export {};
