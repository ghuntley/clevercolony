const DEFAULT_AUTO_TITLES = new Set(['', 'new chat', 'new conversation']);

export function deriveConversationTitle(input: string, maxLength = 72): string {
	const normalized = input.replace(/\s+/g, ' ').trim();
	if (!normalized) return '';
	if (normalized.length <= maxLength) return normalized;

	const cutoff = Math.max(1, maxLength - 1);
	return `${normalized.slice(0, cutoff).trimEnd()}…`;
}

export function shouldAutoTitleConversation(currentTitle: string): boolean {
	return DEFAULT_AUTO_TITLES.has(currentTitle.trim().toLowerCase());
}
