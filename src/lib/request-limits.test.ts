import { describe, expect, it } from 'vitest';
import { isPromptWithinLimit, MAX_IMAGE_PROMPT_CHARS, MAX_TEXT_PROMPT_CHARS } from './request-limits';

describe('request limits', () => {
	it('defines reasonable prompt limits', () => {
		expect(MAX_TEXT_PROMPT_CHARS).toBeGreaterThan(MAX_IMAGE_PROMPT_CHARS);
		expect(MAX_IMAGE_PROMPT_CHARS).toBeGreaterThan(1000);
	});

	it('checks prompt length boundaries', () => {
		expect(isPromptWithinLimit('hello', 5)).toBe(true);
		expect(isPromptWithinLimit('hello!', 5)).toBe(false);
	});
});
