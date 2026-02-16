import { assertAuthenticatedApi } from '$lib/server/auth';
import { getImageAsset } from '$lib/server/db';
import { getEnv } from '$lib/server/env';
import { error, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
	assertAuthenticatedApi(event);
	const env = getEnv(event);
	const imageId = event.params.imageId;
	if (!imageId) {
		throw error(400, 'imageId is required');
	}
	const asset = await getImageAsset(env.DB, imageId);
	if (!asset) {
		throw error(404, 'Image not found');
	}
	const object = await env.MEDIA_BUCKET.get(asset.storage_key);
	if (!object) {
		throw error(404, 'Image object not found');
	}
	const headers = new Headers();
	headers.set('content-type', asset.content_type);
	headers.set('cache-control', 'private, max-age=3600');
	return new Response(object.body, {
		status: 200,
		headers
	});
};
