import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  api: {
    createDocument: vi.fn(),
    setDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
    batchWrite: vi.fn(),
    getCollection: vi.fn(),
  },
  ramStore: {
    getDocument: vi.fn(),
    setDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
    isCollectionInitialized: vi.fn(),
    loadDocuments: vi.fn(),
    markCollectionInitialized: vi.fn(),
    query: vi.fn(),
  },
  localDb: {
    getAllDocs: vi.fn(),
    getCachedDocsFromIndexedDb: vi.fn(),
    saveDoc: vi.fn(),
    markAsSynced: vi.fn(),
    removeDoc: vi.fn(),
  },
  platform: {
    isNative: false,
    isAndroid: false,
  },
  syncEngine: {
    syncNow: vi.fn().mockResolvedValue({ success: true, pushed: 0, pulled: 0 }),
    triggerSyncOnMutation: vi.fn(),
    updatePendingCount: vi.fn(),
  },
}));

vi.mock('../apiClient', () => mocks.api);
vi.mock('../ramStore', () => ({ ramStore: mocks.ramStore }));
vi.mock('../localDb/localDatabase', () => ({ localDb: mocks.localDb }));
vi.mock('../syncEngine', () => ({ syncEngine: mocks.syncEngine }));
vi.mock('../../utils/platform', () => ({
  isNativeApp: () => mocks.platform.isNative,
  isAndroidNativeApp: () => mocks.platform.isAndroid,
}));

import { addDoc, deleteDoc, FakeCollectionRef, FakeDocRef, getDocs, updateDoc } from '../fakeFirestore';

describe('fakeFirestore web writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.platform.isNative = false;
    mocks.ramStore.isCollectionInitialized.mockReturnValue(false);
    mocks.ramStore.query.mockReturnValue([]);
    mocks.localDb.getAllDocs.mockResolvedValue([]);
    mocks.localDb.getCachedDocsFromIndexedDb.mockResolvedValue([]);
    vi.stubGlobal('navigator', { onLine: true });
  });

  it('waits for the server and rejects a create when the server write fails', async () => {
    const error = new Error('Server write failed');
    mocks.api.createDocument.mockRejectedValueOnce(error);

    await expect(addDoc(new FakeCollectionRef('orders'), { customerName: 'Test' }))
      .rejects.toBe(error);

    expect(mocks.api.createDocument).toHaveBeenCalledOnce();
    expect(mocks.ramStore.deleteDocument).toHaveBeenCalledWith('orders', expect.any(String), false);
  });

  it('restores the previous record when an update is rejected by the server', async () => {
    const previous = { id: 'order-1', status: 'Draft' };
    const error = new Error('Server update failed');
    mocks.ramStore.getDocument.mockReturnValue(previous);
    mocks.api.updateDocument.mockRejectedValueOnce(error);

    await expect(updateDoc(new FakeDocRef('orders', 'order-1'), { status: 'Closed' }))
      .rejects.toBe(error);

    expect(mocks.ramStore.setDocument).toHaveBeenCalledWith('orders', 'order-1', previous);
  });

  it('restores a deleted record when the server rejects the delete', async () => {
    const previous = { id: 'order-1', status: 'Draft' };
    const error = new Error('Server delete failed');
    mocks.ramStore.getDocument.mockReturnValue(previous);
    mocks.api.deleteDocument.mockRejectedValueOnce(error);

    await expect(deleteDoc(new FakeDocRef('orders', 'order-1'))).rejects.toBe(error);

    expect(mocks.ramStore.setDocument).toHaveBeenCalledWith('orders', 'order-1', previous);
  });

  it('rejects writes while offline before changing the in-memory collection', async () => {
    vi.stubGlobal('navigator', { onLine: false });

    await expect(addDoc(new FakeCollectionRef('orders'), { customerName: 'Test' }))
      .rejects.toThrow('Thao tác chưa được lưu lên máy chủ');

    expect(mocks.ramStore.setDocument).not.toHaveBeenCalled();
    expect(mocks.api.createDocument).not.toHaveBeenCalled();
  });

  it('saves native customer creates locally without waiting for a VPS write', async () => {
    mocks.platform.isNative = true;
    mocks.localDb.saveDoc.mockResolvedValue(undefined);

    const docRef = await addDoc(new FakeCollectionRef('customers'), {
      id: 'customer-local-1',
      ownerId: 'owner-1',
      name: 'Khách hàng mới',
    });

    expect(docRef.id).toEqual(expect.any(String));
    expect(mocks.localDb.saveDoc).toHaveBeenCalledWith(
      'customers',
      docRef.id,
      expect.objectContaining({ ownerId: 'owner-1', name: 'Khách hàng mới' }),
      0,
    );
    expect(mocks.syncEngine.triggerSyncOnMutation).toHaveBeenCalledOnce();
    expect(mocks.api.createDocument).not.toHaveBeenCalled();
  });

  it('rejects a native create when local persistence fails', async () => {
    const error = new Error('Local storage failed');
    mocks.platform.isNative = true;
    mocks.localDb.saveDoc.mockRejectedValueOnce(error);

    await expect(addDoc(new FakeCollectionRef('customers'), { ownerId: 'owner-1', name: 'Test' }))
      .rejects.toBe(error);

    expect(mocks.ramStore.deleteDocument).toHaveBeenCalledWith('customers', expect.any(String), false);
    expect(mocks.syncEngine.triggerSyncOnMutation).not.toHaveBeenCalled();
    expect(mocks.api.createDocument).not.toHaveBeenCalled();
  });

  it('keeps native writes to collections outside VPS sync on the direct API path', async () => {
    mocks.platform.isNative = true;
    mocks.localDb.saveDoc.mockResolvedValue(undefined);
    mocks.api.createDocument.mockResolvedValue('audit-1');

    await addDoc(new FakeCollectionRef('audit_logs'), { ownerId: 'owner-1', action: 'create' });

    expect(mocks.api.createDocument).toHaveBeenCalledOnce();
    expect(mocks.localDb.markAsSynced).toHaveBeenCalledOnce();
  });

  it('shares one local collection read between concurrent Windows startup subscriptions', async () => {
    mocks.platform.isNative = true;
    mocks.localDb.getAllDocs.mockResolvedValue([{ id: 'product-1', ownerId: 'owner-1' }]);
    vi.stubGlobal('window', { chrome: { webview: {} } });

    const products = new FakeCollectionRef('products');
    await Promise.all([getDocs(products), getDocs(products)]);

    expect(mocks.localDb.getAllDocs).toHaveBeenCalledOnce();
    expect(mocks.ramStore.loadDocuments).toHaveBeenCalledOnce();
  });

  it('does not mark a web collection initialized when its initial VPS read fails', async () => {
    const error = new Error('VPS read failed');
    mocks.api.getCollection.mockRejectedValueOnce(error);

    await expect(getDocs(new FakeCollectionRef('orders'))).rejects.toBe(error);

    expect(mocks.ramStore.markCollectionInitialized).not.toHaveBeenCalled();
    expect(mocks.ramStore.query).not.toHaveBeenCalled();
  });

  it('loads Windows data from the primary local database without starting an extra sync', async () => {
    const cachedProduct = { id: 'product-1', ownerId: 'owner-1' };
    mocks.platform.isNative = true;
    mocks.localDb.getAllDocs.mockResolvedValue([cachedProduct]);
    mocks.ramStore.query.mockReturnValue([cachedProduct]);
    vi.stubGlobal('window', { chrome: { webview: {} } });

    const snapshot = await getDocs(new FakeCollectionRef('products'));

    expect(snapshot.docs.map((doc) => doc.id)).toEqual(['product-1']);
    expect(mocks.localDb.getAllDocs).toHaveBeenCalledOnce();
    expect(mocks.localDb.getCachedDocsFromIndexedDb).not.toHaveBeenCalled();
    expect(mocks.api.getCollection).not.toHaveBeenCalled();
    expect(mocks.syncEngine.syncNow).not.toHaveBeenCalled();
  });

  it('does not start another sync from Android collection loading', async () => {
    const localOrder = { id: 'order-1', ownerId: 'owner-1' };
    mocks.platform.isNative = true;
    mocks.platform.isAndroid = true;
    mocks.localDb.getAllDocs.mockResolvedValue([localOrder]);
    mocks.ramStore.query.mockReturnValue([localOrder]);
    vi.stubGlobal('window', { AndroidAppUpdater: {} });

    await getDocs(new FakeCollectionRef('orders'));

    expect(mocks.syncEngine.syncNow).not.toHaveBeenCalled();
  });
});
