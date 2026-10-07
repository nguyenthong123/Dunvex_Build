import { describe, expect, it } from 'vitest';
import { formatAuditLogDate } from './NexusLogsTab';

describe('formatAuditLogDate', () => {
	it('formats ISO date strings returned by the server', () => {
		expect(formatAuditLogDate('2026-10-03T03:04:16.000Z')).not.toBe('---');
	});

	it('formats Firestore timestamp values', () => {
		expect(formatAuditLogDate({ seconds: 1790996656, nanoseconds: 0 })).not.toBe('---');
	});

	it('returns a placeholder for invalid dates', () => {
		expect(formatAuditLogDate('not-a-date')).toBe('---');
	});
});
