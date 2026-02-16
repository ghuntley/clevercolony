import type { ModelDefinition } from '$lib/types';

const PRESET_COST_LABELS: Record<ModelDefinition['preset'], '$' | '$$' | '$$$'> = {
	fast: '$',
	balanced: '$$',
	reasoning: '$$$',
	'image-fast': '$',
	'image-quality': '$$'
};

const PRESET_HINTS: Record<ModelDefinition['preset'], string> = {
	fast: 'low latency',
	balanced: 'balanced quality',
	reasoning: 'high reasoning',
	'image-fast': 'fast image',
	'image-quality': 'high quality image'
};

export function getModelCostLabel(preset: ModelDefinition['preset']): '$' | '$$' | '$$$' {
	return PRESET_COST_LABELS[preset];
}

export function getModelHint(preset: ModelDefinition['preset']): string {
	return PRESET_HINTS[preset];
}

export function getModelOptionLabel(model: ModelDefinition): string {
	return `${getModelCostLabel(model.preset)} · ${model.label} · ${model.provider} · ${getModelHint(model.preset)}`;
}
