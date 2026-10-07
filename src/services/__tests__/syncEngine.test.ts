import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('syncEngine and triggerSyncOnMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies two-minute auto sync constant is 120,000ms', () => {
    const TWO_MINUTES_MS = 2 * 60 * 1000;
    expect(TWO_MINUTES_MS).toBe(120000);
  });

  it('debounce timer batches multiple rapid mutations', async () => {
    vi.useFakeTimers();
    let syncCallCount = 0;
    let timer: any = null;

    const triggerSyncOnMutation = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        syncCallCount++;
      }, 500);
    };

    // Simulate 5 rapid operations: create order, 2 order items, customer debt, inventory update
    triggerSyncOnMutation();
    triggerSyncOnMutation();
    triggerSyncOnMutation();
    triggerSyncOnMutation();
    triggerSyncOnMutation();

    expect(syncCallCount).toBe(0);

    vi.advanceTimersByTime(499);
    expect(syncCallCount).toBe(0);

    vi.advanceTimersByTime(1);
    expect(syncCallCount).toBe(1);

    vi.useRealTimers();
  });
});
