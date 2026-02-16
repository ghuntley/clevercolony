import type { ModelDefinition } from '$lib/types';

export const MODEL_REGISTRY: ModelDefinition[] = [
	{
		id: 'glm-4.7',
		provider: 'zai',
		label: 'GLM 4.7',
		preset: 'balanced',
		modality: 'text'
	},
	{
		id: '@cf/meta/llama-3.1-8b-instruct',
		provider: 'cloudflare-ai',
		label: 'Llama 3.1 8B',
		preset: 'fast',
		modality: 'text'
	},
	{
		id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
		provider: 'cloudflare-ai',
		label: 'Llama 3.3 70B',
		preset: 'reasoning',
		modality: 'text'
	},
	{
		id: 'glm-image',
		provider: 'zai',
		label: 'GLM Image',
		preset: 'image-quality',
		modality: 'image'
	},
	{
		id: '@cf/black-forest-labs/flux-1-schnell',
		provider: 'cloudflare-ai',
		label: 'FLUX Schnell',
		preset: 'image-fast',
		modality: 'image'
	}
];

export const DEFAULT_TEXT_MODEL = MODEL_REGISTRY.find((model) => model.modality === 'text' && model.preset === 'balanced')!;
export const DEFAULT_IMAGE_MODEL = MODEL_REGISTRY.find(
	(model) => model.modality === 'image' && model.provider === 'zai'
)!;

export function getModelById(modelId: string) {
	return MODEL_REGISTRY.find((model) => model.id === modelId);
}

export function getModelsByModality(modality: 'text' | 'image') {
	return MODEL_REGISTRY.filter((model) => model.modality === modality);
}
