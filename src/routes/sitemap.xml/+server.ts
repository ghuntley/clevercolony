import { buildSitemapXml } from '$lib/server/sitemap';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const body = buildSitemapXml(url.origin);
	return new Response(body, {
		status: 200,
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
};
