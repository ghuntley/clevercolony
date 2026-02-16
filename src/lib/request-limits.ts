export const MAX_TEXT_PROMPT_CHARS = 12_000;
export const MAX_IMAGE_PROMPT_CHARS = 4_000;

export function isPromptWithinLimit(prompt: string, limit: number): boolean {
	return prompt.length <= limit;
}
