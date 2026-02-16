import { MAX_IMAGE_PROMPT_CHARS, MAX_TEXT_PROMPT_CHARS } from '../request-limits';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { MAX_MERMAID_LENGTH } from './mermaid';

const providerSchema = z.enum(['zai', 'cloudflare-ai']);

const conversationIdSchema = z.string().trim().min(1, 'conversationId is required');
const modelSchema = z.string().trim().min(1, 'model cannot be empty').optional();
const titleSchema = z.string().trim().min(1, 'title cannot be empty').max(120, 'title is too long');
const tagSchema = z.string().trim().min(1, 'tags cannot contain empty values').max(64, 'tag is too long');
const tagsSchema = z.array(tagSchema).max(16, 'too many tags').optional();
const scoreSchema = z.number().finite().min(0, 'score must be at least 0').max(10, 'score must be at most 10');
const memoryContentSchema = z
	.string()
	.trim()
	.min(1, 'Memory content is required')
	.max(4000, 'Memory content is too long');
const optionalConversationIdSchema = z.string().trim().min(1, 'conversationId cannot be empty').max(128).nullable().optional();
const resourceIdSchema = z.string().trim().min(1, 'id is required').max(128, 'id is too long');
const pathParamValueSchema = z.string().trim().min(1).max(128, 'path parameter is too long');
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
	if (!isoDatePattern.test(value)) return false;
	const [yearText, monthText, dayText] = value.split('-');
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
	if (month < 1 || month > 12 || day < 1 || day > 31) return false;
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const dateParam = (label: 'dateFrom' | 'dateTo') =>
	z
		.string()
		.trim()
		.regex(isoDatePattern, `${label} must be YYYY-MM-DD`)
		.refine((value) => isValidIsoDate(value), `${label} is not a valid calendar date`);

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

export const createConversationRequestSchema = z.object({
	title: titleSchema.optional(),
	provider: providerSchema.optional(),
	model: modelSchema
});

export const updateConversationRequestSchema = z
	.object({
		title: titleSchema.optional(),
		isPinned: z.boolean().optional(),
		model: modelSchema,
		provider: providerSchema.optional()
	})
	.refine(
		(input) =>
			input.title !== undefined ||
			input.isPinned !== undefined ||
			input.model !== undefined ||
			input.provider !== undefined,
		{
			message: 'No updatable fields provided'
		}
	);

export const createMemoryRequestSchema = z
	.object({
		scope: z.enum(['global', 'conversation']).optional(),
		conversationId: optionalConversationIdSchema,
		content: memoryContentSchema,
		tags: tagsSchema,
		score: scoreSchema.optional()
	})
	.refine((input) => input.scope !== 'conversation' || Boolean(input.conversationId), {
		message: 'conversationId is required for conversation memory'
	});

export const updateMemoryRequestSchema = z
	.object({
		id: z.string().trim().min(1, 'Memory id is required'),
		content: memoryContentSchema.optional(),
		tags: tagsSchema,
		score: scoreSchema.optional()
	})
	.refine((input) => input.content !== undefined || input.tags !== undefined || input.score !== undefined, {
		message: 'No memory updates provided'
	});

export const loginRequestSchema = z.object({
	password: z.string().trim().min(1, 'Password is required').max(256, 'Password is too long')
});

export const webSearchToolRequestSchema = z.object({
	query: z.string().trim().min(1, 'Search query is required').max(500, 'Search query is too long'),
	gl: z.string().trim().regex(/^[a-z]{2}$/i, 'gl must be 2 letters').optional(),
	hl: z.string().trim().regex(/^[a-z]{2}(?:-[a-z]{2})?$/i, 'hl must be language code').optional(),
	num: z.number().int().min(1, 'num must be at least 1').max(10, 'num must be at most 10').optional(),
	conversationId: optionalConversationIdSchema
});

export const mermaidToolRequestSchema = z.object({
	source: z
		.string()
		.trim()
		.min(1, 'Mermaid source is required')
		.max(MAX_MERMAID_LENGTH, `Mermaid source exceeds ${MAX_MERMAID_LENGTH} characters`),
	conversationId: optionalConversationIdSchema,
	title: z.string().trim().min(1, 'title cannot be empty').max(120, 'title is too long').optional()
});

const numberParam = (fallback: number, min: number, max: number, label: string) =>
	z.preprocess(
		(value) => {
			if (value === null || value === undefined || value === '') return fallback;
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : NaN;
		},
		z
			.number()
			.int(`${label} must be an integer`)
			.min(min, `${label} must be >= ${min}`)
			.max(max, `${label} must be <= ${max}`)
	);

export const auditQuerySchema = z.object({
	limit: numberParam(50, 1, 200, 'limit'),
	offset: numberParam(0, 0, 100_000, 'offset'),
	actionType: z.string().trim().min(1, 'actionType cannot be empty').max(120, 'actionType is too long').optional(),
	conversationId: z.string().trim().min(1, 'conversationId cannot be empty').max(128, 'conversationId is too long').optional(),
	conversationQuery: z
		.string()
		.trim()
		.min(1, 'conversationQuery cannot be empty')
		.max(128, 'conversationQuery is too long')
		.optional(),
	dateFrom: dateParam('dateFrom').optional(),
	dateTo: dateParam('dateTo').optional(),
	verify: z.preprocess((value) => value === '1', z.boolean())
}).refine((input) => {
	if (!input.dateFrom || !input.dateTo) return true;
	return input.dateFrom <= input.dateTo;
}, {
	message: 'dateFrom must be before or equal to dateTo'
});

export const memoryListQuerySchema = z.object({
	conversationId: z.string().trim().min(1, 'conversationId cannot be empty').max(128, 'conversationId is too long').optional()
});

export const memoryDeleteQuerySchema = z.object({
	id: resourceIdSchema
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

export function parseSearchParams<TSchema extends z.ZodTypeAny>(
	searchParams: URLSearchParams,
	schema: TSchema
): z.infer<TSchema> {
	const values = Object.fromEntries(searchParams.entries());
	const parsed = schema.safeParse(values);
	if (!parsed.success) {
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid query parameters');
	}
	return parsed.data;
}

export function parsePathParam(value: string | undefined, paramName: string): string {
	const parsed = pathParamValueSchema.safeParse(value);
	if (!parsed.success) {
		if (value === undefined) {
			throw error(400, `${paramName} is required`);
		}
		throw error(400, parsed.error.issues[0]?.message ?? `Invalid ${paramName}`);
	}
	return parsed.data;
}
