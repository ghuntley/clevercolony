import { afterEach, describe, expect, it, vi } from 'vitest';
import { enforceMinimumAuthResponseTime } from './auth';

afterEach(() => {
	vi.useRealTimers();
});

describe('enforceMinimumAuthResponseTime', () => {
	it('waits until the minimum response duration is reached', async () => {
		vi.useFakeTimers();
		const startedAt = Date.now();
		let completed = false;
		const pending = enforceMinimumAuthResponseTime(startedAt, 300).then(() => {
			completed = true;
		});

		await Promise.resolve();
		expect(completed).toBe(false);

		await vi.advanceTimersByTimeAsync(299);
		expect(completed).toBe(false);

		await vi.advanceTimersByTimeAsync(1);
		expect(completed).toBe(true);
		await pending;
	});

	it('returns immediately when minimum duration already elapsed', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(1_000);
		let completed = false;
		await enforceMinimumAuthResponseTime(0, 300).then(() => {
			completed = true;
		});
		expect(completed).toBe(true);
	});
});
