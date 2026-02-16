import type { AuditEvent } from '$lib/types';

export interface AuditFilterCriteria {
	actionType: string;
	conversationQuery: string;
	dateFrom: string;
	dateTo: string;
}

export function collectAuditActionTypes(events: AuditEvent[]): string[] {
	return [...new Set(events.map((event) => event.actionType))].sort((left, right) =>
		left.localeCompare(right)
	);
}

export function filterAuditEvents(events: AuditEvent[], criteria: AuditFilterCriteria): AuditEvent[] {
	const actionType = criteria.actionType.trim().toLowerCase();
	const conversationQuery = criteria.conversationQuery.trim().toLowerCase();
	const fromMs = criteria.dateFrom ? Date.parse(criteria.dateFrom) : null;
	const toMs = criteria.dateTo ? Date.parse(criteria.dateTo) : null;

	return events.filter((event) => {
		if (actionType && event.actionType.toLowerCase() !== actionType) {
			return false;
		}
		if (conversationQuery) {
			const conversation = (event.conversationId ?? '').toLowerCase();
			if (!conversation.includes(conversationQuery)) {
				return false;
			}
		}
		if (fromMs !== null && Number.isFinite(fromMs) && event.createdAt < fromMs) {
			return false;
		}
		if (toMs !== null && Number.isFinite(toMs)) {
			const inclusiveTo = toMs + 24 * 60 * 60 * 1000 - 1;
			if (event.createdAt > inclusiveTo) {
				return false;
			}
		}
		return true;
	});
}
