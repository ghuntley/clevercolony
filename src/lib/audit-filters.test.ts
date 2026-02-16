import { describe, expect, it } from 'vitest';
import type { AuditEvent } from '$lib/types';
import { collectAuditActionTypes, filterAuditEvents } from './audit-filters';

const BASE_TIME = Date.parse('2026-02-16T00:00:00.000Z');

const EVENTS: AuditEvent[] = [
	{
		id: 'evt_1',
		createdAt: BASE_TIME,
		actorSessionId: 'sess_1',
		conversationId: 'conv_alpha',
		actionType: 'prompt.submit',
		payload: {},
		promptText: 'hello',
		prevHash: 'GENESIS',
		eventHash: 'hash1'
	},
	{
		id: 'evt_2',
		createdAt: BASE_TIME + 24 * 60 * 60 * 1000,
		actorSessionId: 'sess_1',
		conversationId: 'conv_beta',
		actionType: 'memory.update',
		payload: {},
		promptText: null,
		prevHash: 'hash1',
		eventHash: 'hash2'
	},
	{
		id: 'evt_3',
		createdAt: BASE_TIME + 2 * 24 * 60 * 60 * 1000,
		actorSessionId: 'sess_2',
		conversationId: 'conv_alpha',
		actionType: 'tool.web_search',
		payload: {},
		promptText: null,
		prevHash: 'hash2',
		eventHash: 'hash3'
	}
];

describe('collectAuditActionTypes', () => {
	it('returns sorted unique action type list', () => {
		expect(collectAuditActionTypes(EVENTS)).toEqual(['memory.update', 'prompt.submit', 'tool.web_search']);
	});
});

describe('filterAuditEvents', () => {
	it('filters by action type', () => {
		const filtered = filterAuditEvents(EVENTS, {
			actionType: 'prompt.submit',
			conversationQuery: '',
			dateFrom: '',
			dateTo: ''
		});
		expect(filtered.map((event) => event.id)).toEqual(['evt_1']);
	});

	it('filters by conversation id substring', () => {
		const filtered = filterAuditEvents(EVENTS, {
			actionType: '',
			conversationQuery: 'beta',
			dateFrom: '',
			dateTo: ''
		});
		expect(filtered.map((event) => event.id)).toEqual(['evt_2']);
	});

	it('filters by date range inclusively', () => {
		const filtered = filterAuditEvents(EVENTS, {
			actionType: '',
			conversationQuery: '',
			dateFrom: '2026-02-17',
			dateTo: '2026-02-17'
		});
		expect(filtered.map((event) => event.id)).toEqual(['evt_2']);
	});
});
