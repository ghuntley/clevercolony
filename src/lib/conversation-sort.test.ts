import { describe, expect, it } from 'vitest';
import type { Conversation } from '$lib/types';
import { sortConversations } from './conversation-sort';

function conversation(input: Partial<Conversation> & Pick<Conversation, 'id'>): Conversation {
	return {
		id: input.id,
		title: input.title ?? input.id,
		isPinned: input.isPinned ?? false,
		provider: input.provider ?? 'zai',
		model: input.model ?? 'glm-4.7',
		createdAt: input.createdAt ?? input.updatedAt ?? Date.now(),
		updatedAt: input.updatedAt ?? Date.now()
	};
}

describe('sortConversations', () => {
	it('orders pinned conversations before regular', () => {
		const sorted = sortConversations([
			conversation({ id: 'a', isPinned: false, updatedAt: 3 }),
			conversation({ id: 'b', isPinned: true, updatedAt: 1 }),
			conversation({ id: 'c', isPinned: false, updatedAt: 5 })
		]);

		expect(sorted.map((item) => item.id)).toEqual(['b', 'c', 'a']);
	});

	it('orders by updatedAt descending inside same pin group', () => {
		const sorted = sortConversations([
			conversation({ id: 'old', isPinned: true, updatedAt: 10 }),
			conversation({ id: 'new', isPinned: true, updatedAt: 20 }),
			conversation({ id: 'mid', isPinned: true, updatedAt: 15 })
		]);

		expect(sorted.map((item) => item.id)).toEqual(['new', 'mid', 'old']);
	});
});
