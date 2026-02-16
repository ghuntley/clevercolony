import { describe, expect, it } from 'vitest';
import { getModelCostLabel, getModelHint, getModelOptionLabel } from './model-presentation';

describe('model presentation helpers', () => {
	it('maps model presets to cost labels', () => {
		expect(getModelCostLabel('fast')).toBe('$');
		expect(getModelCostLabel('balanced')).toBe('$$');
		expect(getModelCostLabel('reasoning')).toBe('$$$');
		expect(getModelCostLabel('image-fast')).toBe('$');
		expect(getModelCostLabel('image-quality')).toBe('$$');
	});

	it('maps model presets to human-readable hints', () => {
		expect(getModelHint('fast')).toBe('low latency');
		expect(getModelHint('image-quality')).toBe('high quality image');
	});

	it('formats complete option labels', () => {
		expect(
			getModelOptionLabel({
				id: 'glm-4.7',
				provider: 'zai',
				label: 'GLM 4.7',
				preset: 'balanced',
				modality: 'text'
			})
		).toBe('$$ · GLM 4.7 · zai · balanced quality');
	});
});
