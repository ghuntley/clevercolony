import { describe, expect, it } from 'vitest';
import { buildAuditFilterWhere } from './audit-query';

describe('buildAuditFilterWhere', () => {
	it('returns an empty clause when filters are omitted', () => {
		const built = buildAuditFilterWhere({});
		expect(built).toEqual({
			whereClause: '',
			bindings: []
		});
	});

	it('binds action and conversation id filters in order', () => {
		const built = buildAuditFilterWhere({
			actionType: 'prompt.submit',
			conversationId: 'conv_123'
		});

		expect(built.whereClause).toBe(' WHERE action_type = ?1 AND conversation_id = ?2');
		expect(built.bindings).toEqual(['prompt.submit', 'conv_123']);
	});

	it('normalizes conversation query to lower-case wildcard search', () => {
		const built = buildAuditFilterWhere({
			conversationQuery: 'AbC'
		});

		expect(built.whereClause).toBe(" WHERE LOWER(COALESCE(conversation_id, '')) LIKE ?1");
		expect(built.bindings).toEqual(['%abc%']);
	});

	it('includes inclusive timestamp bounds when provided', () => {
		const built = buildAuditFilterWhere({
			createdFrom: 1000,
			createdTo: 2000
		});

		expect(built.whereClause).toBe(' WHERE created_at >= ?1 AND created_at <= ?2');
		expect(built.bindings).toEqual([1000, 2000]);
	});

	it('ignores null timestamp bounds', () => {
		const built = buildAuditFilterWhere({
			actionType: 'chat.response',
			createdFrom: null,
			createdTo: null
		});

		expect(built.whereClause).toBe(' WHERE action_type = ?1');
		expect(built.bindings).toEqual(['chat.response']);
	});
});
