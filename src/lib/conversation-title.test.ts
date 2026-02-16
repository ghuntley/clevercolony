import { describe, expect, it } from 'vitest';
import { deriveConversationTitle, shouldAutoTitleConversation } from './conversation-title';

describe('deriveConversationTitle', () => {
	it('normalizes whitespace and trims newlines', () => {
		expect(deriveConversationTitle('  hello\n\nworld\tfrom  colony  ')).toBe('hello world from colony');
	});

	it('truncates long titles with ellipsis', () => {
		expect(deriveConversationTitle('A'.repeat(120), 12)).toBe('AAAAAAAAAAA…');
	});
});

describe('shouldAutoTitleConversation', () => {
	it('allows default placeholder titles', () => {
		expect(shouldAutoTitleConversation('New chat')).toBe(true);
		expect(shouldAutoTitleConversation(' new conversation ')).toBe(true);
		expect(shouldAutoTitleConversation('')).toBe(true);
	});

	it('does not override user-defined titles', () => {
		expect(shouldAutoTitleConversation('Launch plan notes')).toBe(false);
	});
});
