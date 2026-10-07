import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  openDB: vi.fn(),
  sqliteAvailable: true,
  sqliteExecute: vi.fn(),
  sqliteQuery: vi.fn(),
  sqliteBatch: vi.fn(),
  ramStoreSetDocument: vi.fn(),
  ramStoreLoadDocuments: vi.fn(),
}));

vi.mock('idb', () => ({ openDB: mocks.openDB }));
vi.mock('../sqliteSession', () => ({
  getCurrentSessionUser: () => ({ ownerId: 'owner-test' }),
}));
vi.mock('../ramStore', () => ({
  ramStore: {
    setDocument: mocks.ramStoreSetDocument,
    loadDocuments: mocks.ramStoreLoadDocuments,
    getDocument: vi.fn(),
  },
}));
vi.mock('../nativeSqlite', () => ({
  nativeSqlite: {
    isAndroidAvailable: () => false,
    isAvailable: () => mocks.sqliteAvailable,
    execute: mocks.sqliteExecute,
    query: mocks.sqliteQuery,
    batch: mocks.sqliteBatch,
  },
}));

import { localDb } from '../localDb/localDatabase';

describe('Windows local database persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', { chrome: { webview: {} }, dispatchEvent: vi.fn() });
    mocks.sqliteAvailable = true;
    mocks.sqliteExecute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 });
    mocks.sqliteBatch.mockResolvedValue({ success: true });
  });

  it('uses Windows SQLite as the primary write without duplicating every record to IndexedDB', async () => {
    await localDb.saveDoc('customers', 'customer-1', {
      id: 'customer-1',
      ownerId: 'owner-test',
      name: 'New customer',
    });

    expect(mocks.sqliteExecute).toHaveBeenCalledOnce();
    expect(mocks.openDB).not.toHaveBeenCalled();
  });

  it('falls back to IndexedDB when the Windows SQLite write fails', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    mocks.sqliteExecute.mockRejectedValueOnce(new Error('SQLite bridge unavailable'));
    mocks.openDB.mockResolvedValue({
      put,
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await localDb.saveDoc('customers', 'customer-2', {
      id: 'customer-2',
      ownerId: 'owner-test',
      name: 'Fallback customer',
    });

    expect(mocks.openDB).toHaveBeenCalledOnce();
    expect(put).toHaveBeenCalledWith('customers', expect.objectContaining({
      id: 'customer-2',
      name: 'Fallback customer',
      sync_status: 0,
    }));
  });

  it('loads compact SQLite rows while preserving sync and owner fields', async () => {
    const record = {
      id: 'customer-3',
      ownerId: 'owner-test',
      name: 'Cached customer',
      sync_status: 1,
      updated_at: 1234,
    };
    mocks.sqliteQuery.mockResolvedValueOnce([{
      data_json: JSON.stringify(record),
      ownerId: 'owner-test',
      sync_status: 1,
      updated_at: 1234,
      is_deleted: 0,
    }]);

    const docs = await localDb.getAllDocs('customers', 'owner-test');

    expect(mocks.sqliteQuery).toHaveBeenCalledWith(
      'SELECT data_json, ownerId, sync_status, updated_at, is_deleted FROM customers WHERE ownerId = ?',
      ['owner-test'],
    );
    expect(docs).toEqual([expect.objectContaining(record)]);
    expect(mocks.ramStoreLoadDocuments).toHaveBeenCalledWith('customers', docs, true);
  });

  it('counts local records with a single owner-scoped SQLite query', async () => {
    mocks.sqliteQuery.mockResolvedValueOnce([{ count: 12 }]);

    const stats = await localDb.getLocalDataStats('owner-test');

    expect(stats).toEqual({ recordCount: 12, estimatedBytes: 12 * 850 });
    expect(mocks.sqliteQuery).toHaveBeenCalledOnce();
    expect(mocks.sqliteQuery.mock.calls[0][0]).toContain('FROM customers WHERE ownerId = ?');
  });

  it('counts pending rows without reading full record payloads', async () => {
    mocks.sqliteQuery.mockResolvedValueOnce([{ count: 4 }]);

    await expect(localDb.getUnsyncedCount('owner-test')).resolves.toBe(4);

    expect(mocks.sqliteQuery).toHaveBeenCalledOnce();
    expect(mocks.sqliteQuery.mock.calls[0][0]).toContain('COUNT(*) FROM generic_documents');
  });

  it('does not treat a Windows SQLite read failure as an empty sync queue', async () => {
    const error = new Error('SQLite read failed');
    mocks.sqliteQuery.mockRejectedValueOnce(error);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(localDb.getUnsyncedPayload('owner-test')).rejects.toBe(error);

    expect(mocks.openDB).not.toHaveBeenCalled();
  });

  it('does not mark Windows rows synced when the SQLite update fails', async () => {
    mocks.sqliteBatch.mockRejectedValueOnce(new Error('SQLite update failed'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(localDb.markAsSynced('customers', ['customer-1'], 'owner-test'))
      .rejects.toThrow('Không thể cập nhật trạng thái đồng bộ trong SQLite trên Windows.');

    expect(mocks.openDB).not.toHaveBeenCalled();
  });

  it('does not duplicate Windows remote sync writes into IndexedDB', async () => {
    await localDb.upsertRemoteChanges({
      customers: [{ id: 'remote-customer', ownerId: 'owner-test', name: 'Remote customer' }],
    }, 'owner-test');

    expect(mocks.sqliteBatch).toHaveBeenCalledOnce();
    expect(mocks.openDB).not.toHaveBeenCalled();
  });

  it('does not report Windows remote changes saved when the SQLite batch fails', async () => {
    mocks.sqliteBatch.mockRejectedValueOnce(new Error('SQLite batch failed'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(localDb.upsertRemoteChanges({
      customers: [{ id: 'remote-customer', ownerId: 'owner-test', name: 'Remote customer' }],
    }, 'owner-test')).rejects.toThrow('SQLite batch failed');

    expect(mocks.openDB).not.toHaveBeenCalled();
    expect(mocks.ramStoreLoadDocuments).not.toHaveBeenCalled();
  });
});
