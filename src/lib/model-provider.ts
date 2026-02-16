import type { ProviderId } from '$lib/types';

export function isProviderCompatibleWithModel(
	requestedProvider: ProviderId | undefined,
	modelProvider: ProviderId
): boolean {
	if (!requestedProvider) return true;
	return requestedProvider === modelProvider;
}
