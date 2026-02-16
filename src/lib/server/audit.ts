import { appendAuditEvent } from '$lib/server/db';

export async function logAuditEvent(input: {
	db: D1Database;
	sessionId: string;
	conversationId?: string | null;
	actionType: string;
	payload?: Record<string, unknown>;
	promptText?: string | null;
}) {
	return appendAuditEvent(input.db, {
		id: crypto.randomUUID(),
		actorSessionId: input.sessionId,
		conversationId: input.conversationId ?? null,
		actionType: input.actionType,
		payload: input.payload ?? {},
		promptText: input.promptText ?? null
	});
}
