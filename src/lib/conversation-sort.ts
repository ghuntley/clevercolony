import type { Conversation } from '$lib/types';

export function sortConversations(conversations: Conversation[]): Conversation[] {
	return [...conversations].sort((left, right) => {
		if (left.isPinned !== right.isPinned) {
			return Number(right.isPinned) - Number(left.isPinned);
		}
		return right.updatedAt - left.updatedAt;
	});
}
