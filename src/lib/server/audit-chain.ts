import { generateAuditHash } from './crypto';

export interface AuditChainEntry {
	id: string;
	createdAt: number;
	actorSessionId: string;
	conversationId: string | null;
	actionType: string;
	payloadJson: string;
	promptText: string | null;
	prevHash: string;
	eventHash: string;
}

export async function computeAuditEventHash(input: Omit<AuditChainEntry, 'eventHash'>): Promise<string> {
	return generateAuditHash({
		prevHash: input.prevHash,
		id: input.id,
		createdAt: input.createdAt,
		actorSessionId: input.actorSessionId,
		conversationId: input.conversationId,
		actionType: input.actionType,
		payloadJson: input.payloadJson,
		promptText: input.promptText
	});
}

export async function verifyAuditChainEntries(
	entries: AuditChainEntry[],
	options?: { genesisHash?: string }
): Promise<boolean> {
	let previousHash = options?.genesisHash ?? 'GENESIS';
	for (const entry of entries) {
		if (entry.prevHash !== previousHash) {
			return false;
		}

		const recomputed = await computeAuditEventHash({
			id: entry.id,
			createdAt: entry.createdAt,
			actorSessionId: entry.actorSessionId,
			conversationId: entry.conversationId,
			actionType: entry.actionType,
			payloadJson: entry.payloadJson,
			promptText: entry.promptText,
			prevHash: entry.prevHash
		});

		if (recomputed !== entry.eventHash) {
			return false;
		}
		previousHash = entry.eventHash;
	}

	return true;
}
