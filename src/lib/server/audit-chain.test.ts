import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AuditChainEntry } from './audit-chain';
import { computeAuditEventHash, verifyAuditChainEntries } from './audit-chain';

interface RawEventInput {
	id: string;
	createdAt: number;
	actorSessionId: string;
	conversationId: string | null;
	actionType: string;
	payloadJson: string;
	promptText: string | null;
}

async function buildChain(rawEvents: RawEventInput[]): Promise<AuditChainEntry[]> {
	const entries: AuditChainEntry[] = [];
	let prevHash = 'GENESIS';

	for (const raw of rawEvents) {
		const eventHash = await computeAuditEventHash({
			id: raw.id,
			createdAt: raw.createdAt,
			actorSessionId: raw.actorSessionId,
			conversationId: raw.conversationId,
			actionType: raw.actionType,
			payloadJson: raw.payloadJson,
			promptText: raw.promptText,
			prevHash
		});
		entries.push({
			...raw,
			prevHash,
			eventHash
		});
		prevHash = eventHash;
	}

	return entries;
}

const rawEventArbitrary = fc.record({
	id: fc.uuid(),
	createdAt: fc.integer({ min: 1, max: 9_999_999_999 }),
	actorSessionId: fc.string({ minLength: 1, maxLength: 24 }),
	conversationId: fc.option(fc.uuid(), { nil: null }),
	actionType: fc.constantFrom(
		'prompt.submit',
		'assistant.response',
		'memory.update',
		'conversation.create',
		'tool.web_search'
	),
	payloadJson: fc.json(),
	promptText: fc.option(fc.string({ minLength: 1, maxLength: 120 }), { nil: null })
});

describe('verifyAuditChainEntries (property-based)', () => {
	it('accepts valid generated hash chains', async () => {
		await fc.assert(
			fc.asyncProperty(fc.array(rawEventArbitrary, { minLength: 0, maxLength: 25 }), async (rawEvents) => {
				const chain = await buildChain(rawEvents);
				await expect(verifyAuditChainEntries(chain)).resolves.toBe(true);
			}),
			{ numRuns: 80 }
		);
	});

	it('rejects chain with mutated event hash', async () => {
		await fc.assert(
			fc.asyncProperty(fc.array(rawEventArbitrary, { minLength: 1, maxLength: 25 }), async (rawEvents) => {
				const chain = await buildChain(rawEvents);
				chain[0] = {
					...chain[0],
					eventHash: `${chain[0].eventHash}-mutated`
				};
				await expect(verifyAuditChainEntries(chain)).resolves.toBe(false);
			}),
			{ numRuns: 80 }
		);
	});

	it('rejects chain with broken prevHash linkage', async () => {
		await fc.assert(
			fc.asyncProperty(fc.array(rawEventArbitrary, { minLength: 2, maxLength: 25 }), async (rawEvents) => {
				const chain = await buildChain(rawEvents);
				chain[1] = {
					...chain[1],
					prevHash: 'BROKEN_LINK'
				};
				await expect(verifyAuditChainEntries(chain)).resolves.toBe(false);
			}),
			{ numRuns: 80 }
		);
	});
});
