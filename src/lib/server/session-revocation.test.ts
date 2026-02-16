import { describe, expect, it, vi } from 'vitest';
import { isSessionRevoked, revokeSession } from './db';

describe('session revocation persistence', () => {
	it('records revoked sessions with a timestamp', async () => {
		const run = vi.fn().mockResolvedValue({});
		const bind = vi.fn().mockReturnValue({ run });
		const prepare = vi.fn().mockReturnValue({ bind });
		const db = { prepare } as unknown as D1Database;

		await revokeSession(db, 'session-123');

		expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO revoked_sessions'));
		expect(bind).toHaveBeenCalledWith('session-123', expect.any(Number));
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('returns true when a session revocation exists', async () => {
		const first = vi.fn().mockResolvedValue({ session_id: 'session-123' });
		const bind = vi.fn().mockReturnValue({ first });
		const prepare = vi.fn().mockReturnValue({ bind });
		const db = { prepare } as unknown as D1Database;

		await expect(isSessionRevoked(db, 'session-123')).resolves.toBe(true);
	});

	it('returns false when session revocation does not exist', async () => {
		const first = vi.fn().mockResolvedValue(null);
		const bind = vi.fn().mockReturnValue({ first });
		const prepare = vi.fn().mockReturnValue({ bind });
		const db = { prepare } as unknown as D1Database;

		await expect(isSessionRevoked(db, 'session-456')).resolves.toBe(false);
	});
});
