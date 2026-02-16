import { json } from '@sveltejs/kit';

export function ok<T>(data: T, init?: ResponseInit) {
	return json(data, {
		status: 200,
		...init
	});
}

export function created<T>(data: T) {
	return json(data, { status: 201 });
}
