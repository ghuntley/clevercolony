import type { Conversation } from '$lib/types';

export const RECENCY_GROUPS = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Older'] as const;

export type ConversationRecencyGroup = (typeof RECENCY_GROUPS)[number];

export interface ConversationGroup {
	label: ConversationRecencyGroup;
	conversations: Conversation[];
}

function startOfLocalDay(timestamp: number): number {
	const date = new Date(timestamp);
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function getConversationRecencyLabel(updatedAt: number, nowMs = Date.now()): ConversationRecencyGroup {
	const dayDiff = Math.floor((startOfLocalDay(nowMs) - startOfLocalDay(updatedAt)) / (24 * 60 * 60 * 1000));

	if (dayDiff <= 0) return 'Today';
	if (dayDiff === 1) return 'Yesterday';
	if (dayDiff <= 7) return 'Last 7 Days';
	if (dayDiff <= 30) return 'Last 30 Days';
	return 'Older';
}

export function groupConversationsByRecency(
	conversations: Conversation[],
	nowMs = Date.now()
): ConversationGroup[] {
	const grouped = new Map<ConversationRecencyGroup, Conversation[]>(
		RECENCY_GROUPS.map((group) => [group, []] satisfies [ConversationRecencyGroup, Conversation[]])
	);

	for (const conversation of conversations) {
		const label = getConversationRecencyLabel(conversation.updatedAt, nowMs);
		grouped.get(label)?.push(conversation);
	}

	return RECENCY_GROUPS.map((label) => ({
		label,
		conversations: grouped.get(label) ?? []
	})).filter((group) => group.conversations.length > 0);
}
