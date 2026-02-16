import { describe, expect, it } from 'vitest';
import type { Conversation } from '$lib/types';
import { getConversationRecencyLabel, groupConversationsByRecency } from './conversation-groups';

const NOW = Date.parse('2026-02-16T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function makeConversation(id: string, updatedAt: number): Conversation {
	return {
		id,
		title: id,
		isPinned: false,
		provider: 'zai',
		model: 'glm-4.7',
		createdAt: updatedAt,
		updatedAt
	};
}

describe('getConversationRecencyLabel', () => {
	it('assigns today and yesterday at day boundaries', () => {
		expect(getConversationRecencyLabel(NOW - 1, NOW)).toBe('Today');
		expect(getConversationRecencyLabel(NOW - DAY, NOW)).toBe('Yesterday');
	});

	it('assigns last 7/30 days and older buckets', () => {
		expect(getConversationRecencyLabel(NOW - 6 * DAY, NOW)).toBe('Last 7 Days');
		expect(getConversationRecencyLabel(NOW - 20 * DAY, NOW)).toBe('Last 30 Days');
		expect(getConversationRecencyLabel(NOW - 40 * DAY, NOW)).toBe('Older');
	});
});

describe('groupConversationsByRecency', () => {
	it('groups and keeps expected recency order', () => {
		const groups = groupConversationsByRecency(
			[
				makeConversation('older', NOW - 45 * DAY),
				makeConversation('today', NOW - 5_000),
				makeConversation('week', NOW - 4 * DAY),
				makeConversation('yesterday', NOW - DAY)
			],
			NOW
		);

		expect(groups.map((group) => group.label)).toEqual(['Today', 'Yesterday', 'Last 7 Days', 'Older']);
		expect(groups[0]?.conversations.map((conversation) => conversation.id)).toEqual(['today']);
		expect(groups[3]?.conversations.map((conversation) => conversation.id)).toEqual(['older']);
	});
});
