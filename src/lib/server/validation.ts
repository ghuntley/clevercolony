import { MAX_IMAGE_PROMPT_CHARS, MAX_TEXT_PROMPT_CHARS } from '../request-limits';
import { error } from '@sveltejs/kit';
import { z } from 'zod';

const providerSchema = z.enum(['zai', 'cloudflare-ai']);

const conversationIdSchema = z.string().trim().min(1, 'conversationId is required');
const modelSchema = z.string().trim().min(1, 'model cannot be empty').optional();

export const chatRequestSchema = z.object({
	conversationId: conversationIdSchema,
	text: z
		.string()
		.trim()
		.min(1, 'text is required')
		.max(MAX_TEXT_PROMPT_CHARS, `text exceeds ${MAX_TEXT_PROMPT_CHARS} characters`),
	provider: providerSchema.optional(),
	model: modelSchema,
	webSearchEnabled: z.boolean().optional()
});

export const imageRequestSchema = z.object({
	conversationId: conversationIdSchema,
	prompt: z
		.string()
		.trim()
		.min(1, 'prompt is required')
		.max(MAX_IMAGE_PROMPT_CHARS, `prompt exceeds ${MAX_IMAGE_PROMPT_CHARS} characters`),
	provider: providerSchema.optional(),
	model: modelSchema
});

export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
	request: Request,
	schema: TSchema
): Promise<z.infer<TSchema>> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const parsed = schema.safeParse(body);
	if (!parsed.success) {
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid request body');
	}
	return parsed.data;
}
