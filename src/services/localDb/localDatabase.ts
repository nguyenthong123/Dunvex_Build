import { openDB, type IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentSessionUser } from '../sqliteSession';
import { ramStore } from '../ramStore';
import { nativeSqlite, type SQLiteBatchStatement } from '../nativeSqlite';
import type {
  CustomerEntity,
  ProductEntity,
  OrderEntity,
  OrderItemEntity,
  SyncPayload
} from './types';

const DB_NAME = 'dunvex_offline_db';
const DB_VERSION = 3;

function isWindowsNativeApp(): boolean {
  return typeof window !== 'undefined' && (window as any).chrome?.webview !== undefined;
}

function getActiveOwnerId(): string {
  const user = getCurrentSessionUser();
  if (user?.ownerId) return user.ownerId;
  if (user?.uid) return user.uid;
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('dunvex_owner_id') || '';
  }
  return '';
}

function getNativeRecordColumns(collectionName: string): string {
  return ['customers', 'products', 'orders'].includes(collectionName)
    ? 'data_json, ownerId, sync_status, updated_at, is_deleted'
    : 'data_json, ownerId, sync_status, updated_at';
}

function parseSqliteRow(row: any): any {
  if (!row) return null;
  let parsed: any = {};
  if (row.data_json) {
    try {
      parsed = JSON.parse(row.data_json);
    } catch {
      parsed = {};
    }
  }
  const merged = { ...parsed, ...row };
  delete merged.data_json;
  return merged;
}

class LocalDatabase {
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private nativeReadyPromise: Promise<void>;
  private deviceId: string = '';

  constructor() {
    this.nativeReadyPromise = this.initializeNativeStorage().catch((error) => {
      console.error('[LocalDatabase] Android SQLite initialization failed; IndexedDB remains available:', error);
    });
  }

  private async initializeNativeStorage(): Promise<void> {
    if (!nativeSqlite.isAndroidAvailable()) return;

    const db = await this.init();
    await nativeSqlite.initialize();
    const migrationKey = '__indexeddb_to_sqlite_v1__';
    const migrated = await nativeSqlite.query(
      'SELECT key_value FROM app_metadata WHERE key_name = ? LIMIT 1',
      [migrationKey],
    );
    if (migrated.length > 0) return;

    const statements: SQLiteBatchStatement[] = [];
    const coreCollections = ['customers', 'products', 'orders', 'order_items'];
    for (const collectionName of coreCollections) {
      const records = await db.getAll(collectionName as any);
      for (const record of records) {
        const ownerId = record.ownerId || getActiveOwnerId();
        const normalizedRecord = {
          ...record,
          collection: collectionName,
          composite_key: `${collectionName}:${record.id}`,
          ownerId,
          sync_status: record.sync_status ?? 0,
        };
        statements.push(this.createNativeUpsert(collectionName, normalizedRecord, ownerId));
      }
    }

    const genericRecords = await db.getAll('generic_documents');
    for (const record of genericRecords) {
      const ownerId = record.ownerId || getActiveOwnerId();
      const normalizedRecord = {
        ...record,
        collection: record.collection || 'generic',
        composite_key: record.composite_key || `${record.collection || 'generic'}:${record.id}`,
        ownerId,
        sync_status: record.sync_status ?? 0,
      };
      statements.push(
        this.createNativeUpsert(normalizedRecord.collection, normalizedRecord, ownerId),
      );
    }

    const metadata = await db.getAll('app_metadata');
    for (const entry of metadata) {
      statements.push({
        sql: 'INSERT OR REPLACE INTO app_metadata (key_name, key_value) VALUES (?, ?)',
        params: [entry.key_name, entry.key_value],
      });
    }

    statements.push({
      sql: 'INSERT OR REPLACE INTO app_metadata (key_name, key_value) VALUES (?, ?)',
      params: [migrationKey, String(Date.now())],
    });

    for (let offset = 0; offset < statements.length; offset += 100) {
      await nativeSqlite.batch(statements.slice(offset, offset + 100));
    }
    console.info(
      `[LocalDatabase] Migrated ${statements.length - metadata.length - 1} IndexedDB records to Android SQLite`,
    );
  }

  private async init(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // 1. Core tables
          if (!db.objectStoreNames.contains('customers')) {
            const customerStore = db.createObjectStore('customers', { keyPath: 'id' });
            customerStore.createIndex('customer_code', 'customer_code', { unique: false });
            customerStore.createIndex('ownerId', 'ownerId');
            customerStore.createIndex('sync_status', 'sync_status');
            customerStore.createIndex('updated_at', 'updated_at');
            customerStore.createIndex('is_deleted', 'is_deleted');
          }

          if (!db.objectStoreNames.contains('products')) {
            const productStore = db.createObjectStore('products', { keyPath: 'id' });
            productStore.createIndex('product_code', 'product_code', { unique: false });
            productStore.createIndex('ownerId', 'ownerId');
            productStore.createIndex('sync_status', 'sync_status');
            productStore.createIndex('updated_at', 'updated_at');
            productStore.createIndex('is_deleted', 'is_deleted');
          }

          if (!db.objectStoreNames.contains('orders')) {
            const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
            orderStore.createIndex('order_code', 'order_code', { unique: false });
            orderStore.createIndex('ownerId', 'ownerId');
            orderStore.createIndex('customer_id', 'customer_id');
            orderStore.createIndex('sync_status', 'sync_status');
            orderStore.createIndex('image_sync_status', 'image_sync_status');
            orderStore.createIndex('updated_at', 'updated_at');
            orderStore.createIndex('is_deleted', 'is_deleted');
          }

          if (!db.objectStoreNames.contains('order_items')) {
            const itemStore = db.createObjectStore('order_items', { keyPath: 'id' });
            itemStore.createIndex('order_id', 'order_id');
            itemStore.createIndex('ownerId', 'ownerId');
            itemStore.createIndex('product_id', 'product_id');
            itemStore.createIndex('sync_status', 'sync_status');
            itemStore.createIndex('updated_at', 'updated_at');
          }

          if (!db.objectStoreNames.contains('app_metadata')) {
            db.createObjectStore('app_metadata', { keyPath: 'key_name' });
          }

          if (!db.objectStoreNames.contains('generic_documents')) {
            const genericStore = db.createObjectStore('generic_documents', { keyPath: 'composite_key' });
            genericStore.createIndex('collection', 'collection');
            genericStore.createIndex('ownerId', 'ownerId');
            genericStore.createIndex('sync_status', 'sync_status');
            genericStore.createIndex('updated_at', 'updated_at');
          }
        },
      });
    }
    return this.dbPromise;
  }

  // ─── Generic Collection Document Management ───────────────

  private createNativeUpsert(
    collectionName: string,
    record: Record<string, any>,
    ownerId: string,
  ): SQLiteBatchStatement {
    const id = record.id;
    const jsonStr = JSON.stringify(record);
    const syncStatus = record.sync_status ?? 0;
    const updatedAt = record.updated_at || record.updatedAt || Date.now();
    const isDeleted = record.is_deleted ? 1 : 0;

    if (collectionName === 'customers') {
      return {
        sql: `INSERT OR REPLACE INTO customers (id, customer_code, name, phone, address, sync_status, updated_at, is_deleted, ownerId, data_json)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id, record.customer_code || '', record.name || '', record.phone || '',
          record.address || '', syncStatus, updatedAt, isDeleted, ownerId, jsonStr,
        ],
      };
    }
    if (collectionName === 'products') {
      return {
        sql: `INSERT OR REPLACE INTO products (id, product_code, name, unit, base_price, local_image_path, sync_status, updated_at, is_deleted, ownerId, data_json)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id, record.product_code || record.sku || '', record.name || '', record.unit || '',
          record.base_price || record.priceSell || 0, record.local_image_path || null,
          syncStatus, updatedAt, isDeleted, ownerId, jsonStr,
        ],
      };
    }
    if (collectionName === 'orders') {
      return {
        sql: `INSERT OR REPLACE INTO orders (id, order_code, customer_id, total_amount, note, is_printed, local_image_path, image_sync_status, sync_status, created_at, updated_at, is_deleted, ownerId, data_json)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id, record.order_code || '', record.customer_id || '', record.total_amount || 0,
          record.note || '', record.is_printed ? 1 : 0, record.local_image_path || null,
          record.image_sync_status || 0, syncStatus, record.created_at || Date.now(),
          updatedAt, isDeleted, ownerId, jsonStr,
        ],
      };
    }
    if (collectionName === 'order_items') {
      return {
        sql: `INSERT OR REPLACE INTO order_items (id, order_id, product_id, quantity, unit_price, amount, sync_status, updated_at, product_name, unit, ownerId, data_json)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          id, record.order_id || '', record.product_id || '', record.quantity || 0,
          record.unit_price || 0, record.amount || 0, syncStatus, updatedAt,
          record.product_name || '', record.unit || '', ownerId, jsonStr,
        ],
      };
    }
    return {
      sql: `INSERT OR REPLACE INTO generic_documents (composite_key, collection, id, sync_status, updated_at, ownerId, data_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [
        record.composite_key || `${collectionName}:${id}`,
        collectionName,
        id,
        syncStatus,
        updatedAt,
        ownerId,
        jsonStr,
      ],
    };
  }

  async saveDoc(collectionName: string, id: string, data: Record<string, any>, syncStatus = 0): Promise<void> {
    await this.nativeReadyPromise;
    const ownerId = data.ownerId || getActiveOwnerId();
    const now = Date.now();
    const record: Record<string, any> = {
      ...data,
      id,
      collection: collectionName,
      composite_key: `${collectionName}:${id}`,
      ownerId,
      updated_at: data.updated_at || data.updatedAt || now,
      sync_status: syncStatus,
    };

    let persisted = false;
    let persistenceError: unknown;

    // 2. Persist to native SQLite when the platform exposes its bridge
    if (nativeSqlite.isAvailable()) {
      try {
        const statement = this.createNativeUpsert(collectionName, record, ownerId);
        await nativeSqlite.execute(statement.sql, statement.params);
        persisted = true;
      } catch (err) {
        persistenceError = err;
        console.warn(`[LocalDatabase] Error saving ${collectionName}:${id} to native SQLite:`, err);
      }
    }

    // Windows SQLite is the durable store; keep IndexedDB as fallback only.
    if (!persisted || !isWindowsNativeApp()) {
      try {
        const db = await this.init();
        if (['customers', 'products', 'orders', 'order_items'].includes(collectionName)) {
          await db.put(collectionName as any, record);
        } else {
          await db.put('generic_documents', record);
        }
        persisted = true;
      } catch (err) {
        persistenceError = err;
        console.warn(`[LocalDatabase] Error saving ${collectionName}:${id} to IndexedDB:`, err);
      }
    }

    if (!persisted) {
      throw persistenceError instanceof Error
        ? persistenceError
        : new Error(`[LocalDatabase] Unable to persist ${collectionName}:${id} to local storage.`);
    }

    // Keep inactive-account records persisted without exposing them in the active account's RAM cache.
    if (ownerId && ownerId === getActiveOwnerId()) {
      ramStore.setDocument(collectionName, id, record);
    }
  }

  async getDoc(collectionName: string, id: string): Promise<any | null> {
    await this.nativeReadyPromise;
    const ownerId = getActiveOwnerId();
    if (!ownerId) return null;

    // 1. Check RAM Store first
    const inRam = ramStore.getDocument(collectionName, id);
    if (inRam?.ownerId === ownerId) return inRam;

    // 2. Check Native SQLite
    if (nativeSqlite.isAvailable()) {
      try {
        let rows: any[] = [];
        if (collectionName === 'customers') {
          rows = await nativeSqlite.query(`SELECT ${getNativeRecordColumns(collectionName)} FROM customers WHERE id = ? AND ownerId = ? LIMIT 1`, [id, ownerId]);
        } else if (collectionName === 'products') {
          rows = await nativeSqlite.query(`SELECT ${getNativeRecordColumns(collectionName)} FROM products WHERE id = ? AND ownerId = ? LIMIT 1`, [id, ownerId]);
        } else if (collectionName === 'orders') {
          rows = await nativeSqlite.query(`SELECT ${getNativeRecordColumns(collectionName)} FROM orders WHERE id = ? AND ownerId = ? LIMIT 1`, [id, ownerId]);
        } else if (collectionName === 'order_items') {
          rows = await nativeSqlite.query(`SELECT ${getNativeRecordColumns(collectionName)} FROM order_items WHERE id = ? AND ownerId = ? LIMIT 1`, [id, ownerId]);
        } else {
          rows = await nativeSqlite.query(
            `SELECT ${getNativeRecordColumns(collectionName)} FROM generic_documents WHERE composite_key = ? AND ownerId = ? LIMIT 1`,
            [`${collectionName}:${id}`, ownerId],
          );
        }

        if (rows && rows.length > 0) {
          const doc = parseSqliteRow(rows[0]);
          if (doc.ownerId === ownerId) ramStore.setDocument(collectionName, id, doc);
          return doc;
        }
      } catch (err) {
        console.warn(`[LocalDatabase] Error querying ${collectionName}:${id} from native SQLite:`, err);
      }
    }

    // 3. Fallback to IndexedDB
    try {
      const db = await this.init();
      let record: any = null;
      if (['customers', 'products', 'orders', 'order_items'].includes(collectionName)) {
        record = await db.get(collectionName as any, id);
      } else {
        record = await db.get('generic_documents', `${collectionName}:${id}`);
      }

      if (record?.ownerId === ownerId) {
        ramStore.setDocument(collectionName, id, record);
        return record;
      }
    } catch {
      // ignore
    }

    return null;
  }

  async getAllDocs(collectionName: string, ownerId = getActiveOwnerId()): Promise<any[]> {
    await this.nativeReadyPromise;
    if (!ownerId) return [];

    // 1. Try Native SQLite
    if (nativeSqlite.isAvailable()) {
      try {
        let rows: any[] = [];
        if (collectionName === 'customers') {
          rows = await nativeSqlite.query(`SELECT ${getNativeRecordColumns(collectionName)} FROM customers WHERE ownerId = ?`, [ownerId]);
        } else if (collectionName === 'products') {
          rows = await nativeSqlite.query(`SELECT ${getNativeRecordColumns(collectionName)} FROM products WHERE ownerId = ?`, [ownerId]);
        } else if (collectionName === 'orders') {
          rows = await nativeSqlite.query(`SELECT ${getNativeRecordColumns(collectionName)} FROM orders WHERE ownerId = ?`, [ownerId]);
        } else if (collectionName === 'order_items') {
          rows = await nativeSqlite.query(`SELECT ${getNativeRecordColumns(collectionName)} FROM order_items WHERE ownerId = ?`, [ownerId]);
        } else {
          rows = await nativeSqlite.query(
            `SELECT ${getNativeRecordColumns(collectionName)} FROM generic_documents WHERE collection = ? AND ownerId = ?`,
            [collectionName, ownerId],
          );
        }

        const parsed = rows.map(parseSqliteRow);
        const filtered = parsed.filter(r => r.ownerId === ownerId);
        if (filtered.length > 0) {
          if (getActiveOwnerId() === ownerId) ramStore.loadDocuments(collectionName, filtered, true);
          return filtered;
        }
      } catch (err) {
        console.warn(`[LocalDatabase] Error querying collection ${collectionName} from native SQLite:`, err);
      }
    }

    return this.getCachedDocsFromIndexedDb(collectionName, ownerId);
  }

  async getCachedDocsFromIndexedDb(
    collectionName: string,
    ownerId = getActiveOwnerId(),
  ): Promise<any[]> {
    await this.nativeReadyPromise;
    if (!ownerId) return [];

    try {
      const db = await this.init();
      let records: any[] = [];

      if (['customers', 'products', 'orders', 'order_items'].includes(collectionName)) {
        records = await db.getAllFromIndex(collectionName as any, 'ownerId', ownerId);
      } else {
        const ownerDocs = await db.getAllFromIndex('generic_documents', 'ownerId', ownerId);
        records = ownerDocs.filter(r => r.collection === collectionName);
      }

      const filtered = records.filter(r => r.ownerId === ownerId);
      if (getActiveOwnerId() === ownerId) ramStore.loadDocuments(collectionName, filtered, true);
      return filtered;
    } catch (error) {
      console.warn(`[LocalDatabase] Error reading cached ${collectionName} from IndexedDB:`, error);
      return [];
    }
  }

  async getOrderItemsForOrders(orderIds: string[], ownerId = getActiveOwnerId()): Promise<any[]> {
    await this.nativeReadyPromise;
    const uniqueIds = Array.from(new Set(orderIds.filter(Boolean)));
    if (!ownerId || uniqueIds.length === 0) return [];

    if (nativeSqlite.isAvailable()) {
      try {
        const rows: any[] = [];
        const batchSize = 500;
        for (let offset = 0; offset < uniqueIds.length; offset += batchSize) {
          const batch = uniqueIds.slice(offset, offset + batchSize);
          const placeholders = batch.map(() => '?').join(', ');
          rows.push(...await nativeSqlite.query(
            `SELECT * FROM order_items WHERE ownerId = ? AND order_id IN (${placeholders})`,
            [ownerId, ...batch],
          ));
        }
        return rows.map(parseSqliteRow).filter((row) => row.ownerId === ownerId);
      } catch (error) {
        console.warn('[LocalDatabase] Unable to read dashboard order items from native SQLite; trying IndexedDB:', error);
      }
    }

    try {
      const db = await this.init();
      const records: any[] = [];
      const batchSize = 100;
      for (let offset = 0; offset < uniqueIds.length; offset += batchSize) {
        const batch = uniqueIds.slice(offset, offset + batchSize);
        const results = await Promise.all(
          batch.map((orderId) => db.getAllFromIndex('order_items', 'order_id', orderId)),
        );
        records.push(...results.flat());
      }
      const wantedIds = new Set(uniqueIds);
      return records.filter((record) =>
        record.ownerId === ownerId && wantedIds.has(record.order_id),
      );
    } catch (error) {
      console.error('[LocalDatabase] Unable to read dashboard order items from IndexedDB:', error);
      throw error;
    }
  }

  async removeDoc(collectionName: string, id: string, softDelete = true): Promise<void> {
    await this.nativeReadyPromise;
    ramStore.deleteDocument(collectionName, id, softDelete);

    if (softDelete) {
      await this.saveDoc(collectionName, id, { is_deleted: 1, deleted: true, updated_at: Date.now() }, 0);
    } else {
      if (nativeSqlite.isAvailable()) {
        try {
          if (['customers', 'products', 'orders', 'order_items'].includes(collectionName)) {
            await nativeSqlite.execute(`DELETE FROM ${collectionName} WHERE id = ?`, [id]);
          } else {
            await nativeSqlite.execute('DELETE FROM generic_documents WHERE composite_key = ?', [`${collectionName}:${id}`]);
          }
        } catch (err) {
          console.warn(`[LocalDatabase] Error deleting ${collectionName}:${id} from native SQLite:`, err);
        }
      }

      try {
        const db = await this.init();
        if (['customers', 'products', 'orders', 'order_items'].includes(collectionName)) {
          await db.delete(collectionName as any, id);
        } else {
          await db.delete('generic_documents', `${collectionName}:${id}`);
        }
      } catch {
        // ignore
      }
    }
  }

  // ─── Device & Metadata Management ─────────────────────────

  async getMetadata(key: string, ownerId = getActiveOwnerId()): Promise<string | null> {
    await this.nativeReadyPromise;
    const scopedKey = ownerId ? `${ownerId}:${key}` : key;

    if (nativeSqlite.isAvailable()) {
      try {
        const rows = await nativeSqlite.query('SELECT key_value FROM app_metadata WHERE key_name = ? LIMIT 1', [scopedKey]);
        if (rows && rows.length > 0) {
          return rows[0].key_value;
        }
      } catch (err) {
        console.warn(`[LocalDatabase] Error reading metadata ${key} from native SQLite:`, err);
      }
    }

    try {
      const db = await this.init();
      const entry = await db.get('app_metadata', scopedKey);
      return entry ? entry.key_value : null;
    } catch {
      return null;
    }
  }

  async setMetadata(key: string, value: string, ownerId = getActiveOwnerId()): Promise<void> {
    await this.nativeReadyPromise;
    const scopedKey = ownerId ? `${ownerId}:${key}` : key;

    if (nativeSqlite.isAvailable()) {
      try {
        await nativeSqlite.execute(
          'INSERT OR REPLACE INTO app_metadata (key_name, key_value) VALUES (?, ?)',
          [scopedKey, value]
        );
      } catch (err) {
        console.warn(`[LocalDatabase] Error writing metadata ${key} to native SQLite:`, err);
      }
    }

    try {
      const db = await this.init();
      await db.put('app_metadata', { key_name: scopedKey, key_value: value });
    } catch {
      // ignore
    }
  }

  async getDeviceId(): Promise<string> {
    if (this.deviceId) return this.deviceId;
    let devId = await this.getMetadata('global_device_id');
    if (!devId) {
      devId = 'dev_' + uuidv4().substring(0, 12);
      await this.setMetadata('global_device_id', devId);
    }
    this.deviceId = devId;
    return devId;
  }

  async getLastSyncTime(ownerId?: string): Promise<number> {
    const val = await this.getMetadata('last_sync_time', ownerId);
    return val ? parseInt(val, 10) : 0;
  }

  async setLastSyncTime(timestamp: number, ownerId?: string): Promise<void> {
    await this.setMetadata('last_sync_time', String(timestamp), ownerId);
  }

  // ─── Customers CRUD ────────────────────────────────────────

  async upsertCustomer(customer: Partial<CustomerEntity>): Promise<CustomerEntity> {
    const id = customer.id || uuidv4();
    const ownerId = customer.ownerId || getActiveOwnerId();
    const record: CustomerEntity = {
      id,
      customer_code: customer.customer_code || `KH-${Math.floor(1000 + Math.random() * 9000)}`,
      name: customer.name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      sync_status: 0,
      updated_at: customer.updated_at || Date.now(),
      is_deleted: customer.is_deleted ?? 0,
      ownerId,
      ...customer,
    };
    await this.saveDoc('customers', id, record, 0);
    return record;
  }

  async getCustomers(includeDeleted = false): Promise<CustomerEntity[]> {
    const docs = await this.getAllDocs('customers');
    return docs.filter(c => includeDeleted || c.is_deleted === 0);
  }

  async getCustomerById(id: string): Promise<CustomerEntity | undefined> {
    const doc = await this.getDoc('customers', id);
    return doc || undefined;
  }

  async deleteCustomer(id: string): Promise<void> {
    await this.removeDoc('customers', id, true);
  }

  // ─── Products CRUD ─────────────────────────────────────────

  async upsertProduct(product: Partial<ProductEntity>): Promise<ProductEntity> {
    const id = product.id || uuidv4();
    const ownerId = product.ownerId || getActiveOwnerId();
    const record: ProductEntity = {
      id,
      product_code: product.product_code || `SP-${Math.floor(1000 + Math.random() * 9000)}`,
      name: product.name || '',
      unit: product.unit || 'Cái',
      base_price: product.base_price ?? 0,
      local_image_path: product.local_image_path || null,
      sync_status: 0,
      updated_at: product.updated_at || Date.now(),
      is_deleted: product.is_deleted ?? 0,
      ownerId,
      ...product,
    };
    await this.saveDoc('products', id, record, 0);
    return record;
  }

  async getProducts(includeDeleted = false): Promise<ProductEntity[]> {
    const docs = await this.getAllDocs('products');
    return docs.filter(p => includeDeleted || p.is_deleted === 0);
  }

  async getProductById(id: string): Promise<ProductEntity | undefined> {
    const doc = await this.getDoc('products', id);
    return doc || undefined;
  }

  async deleteProduct(id: string): Promise<void> {
    await this.removeDoc('products', id, true);
  }

  // ─── Orders & Order Items ──────────────────────────────────

  async createOrder(
    order: Partial<OrderEntity>,
    items: Array<Omit<OrderItemEntity, 'id' | 'order_id' | 'sync_status' | 'updated_at'>>
  ): Promise<OrderEntity> {
    const now = Date.now();
    const orderId = order.id || uuidv4();
    const ownerId = order.ownerId || getActiveOwnerId();
    const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const prefix = isMobile ? 'MOB' : 'PC';
    const orderCode = order.order_code || `${prefix}-${Math.floor(10000 + Math.random() * 90000)}`;

    const orderRecord: OrderEntity = {
      id: orderId,
      order_code: orderCode,
      customer_id: order.customer_id || '',
      total_amount: order.total_amount || 0,
      note: order.note || '',
      is_printed: order.is_printed ?? 0,
      local_image_path: order.local_image_path || null,
      image_sync_status: order.local_image_path ? 0 : 1,
      sync_status: 0,
      created_at: order.created_at || now,
      updated_at: now,
      is_deleted: 0,
      ownerId,
      ...order,
    };

    const itemRecords: OrderItemEntity[] = items.map(item => ({
      id: uuidv4(),
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount || item.quantity * item.unit_price,
      sync_status: 0,
      updated_at: now,
      product_name: item.product_name || '',
      unit: item.unit || '',
      ownerId,
    }));

    await this.saveDoc('orders', orderId, { ...orderRecord, items: itemRecords }, 0);
    for (const it of itemRecords) {
      await this.saveDoc('order_items', it.id, it, 0);
    }

    return { ...orderRecord, items: itemRecords };
  }

  async getOrders(includeDeleted = false): Promise<OrderEntity[]> {
    const docs = await this.getAllDocs('orders');
    return docs.filter(o => includeDeleted || o.is_deleted === 0);
  }

  async getOrderWithItems(id: string): Promise<(OrderEntity & { items: OrderItemEntity[] }) | null> {
    await this.nativeReadyPromise;
    const inRam = ramStore.getDocument('orders', id);
    if (inRam && inRam.items) return inRam;

    const order = await this.getDoc('orders', id);
    if (!order) return null;

    let items: OrderItemEntity[] = [];
    if (nativeSqlite.isAvailable()) {
      try {
        const rows = await nativeSqlite.query('SELECT * FROM order_items WHERE order_id = ?', [id]);
        items = rows.map(parseSqliteRow);
      } catch {
        // fallback below
      }
    }
    if (items.length === 0) {
      const allItems = await this.getAllDocs('order_items');
      items = allItems.filter(i => i.order_id === id);
    }

    const fullOrder = { ...order, items };
    ramStore.setDocument('orders', id, fullOrder);
    return fullOrder;
  }

  async getOrdersMissingImages(): Promise<OrderEntity[]> {
    const orders = await this.getOrders();
    return orders.filter(o => !o.local_image_path || o.image_sync_status === 0);
  }

  async updateOrderImagePath(orderId: string, localPath: string): Promise<void> {
    const order = await this.getDoc('orders', orderId);
    if (order) {
      const updated = {
        ...order,
        local_image_path: localPath,
        image_sync_status: 1,
        updated_at: Date.now(),
      };
      await this.saveDoc('orders', orderId, updated, 0);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('collection_changed', { detail: { collection: 'orders' } }));
      }
    }
  }

  // ─── Sync Engine Helpers ───────────────────────────────────

  async getUnsyncedPayload(ownerId = getActiveOwnerId()): Promise<SyncPayload> {
    await this.nativeReadyPromise;
    if (!ownerId) return { customers: [], products: [], orders: [], order_items: [] };

    if (nativeSqlite.isAvailable()) {
      try {
        const [cRows, pRows, oRows, oiRows, gRows] = await Promise.all([
          nativeSqlite.query('SELECT data_json, ownerId, sync_status, updated_at, is_deleted FROM customers WHERE sync_status = 0 AND ownerId = ?', [ownerId]),
          nativeSqlite.query('SELECT data_json, ownerId, sync_status, updated_at, is_deleted FROM products WHERE sync_status = 0 AND ownerId = ?', [ownerId]),
          nativeSqlite.query('SELECT data_json, ownerId, sync_status, updated_at, is_deleted FROM orders WHERE sync_status = 0 AND ownerId = ?', [ownerId]),
          nativeSqlite.query('SELECT data_json, ownerId, sync_status, updated_at FROM order_items WHERE sync_status = 0 AND ownerId = ?', [ownerId]),
          nativeSqlite.query('SELECT data_json, ownerId, sync_status, updated_at FROM generic_documents WHERE sync_status = 0 AND ownerId = ?', [ownerId]),
        ]);

        const customers = cRows.map(parseSqliteRow).filter(c => c.ownerId === ownerId);
        const products = pRows.map(parseSqliteRow).filter(p => p.ownerId === ownerId);
        const orders = oRows.map(parseSqliteRow).filter(o => o.ownerId === ownerId);
        const order_items = oiRows.map(parseSqliteRow).filter(i => i.ownerId === ownerId);

        const payload: SyncPayload = { customers, products, orders, order_items };

        const generic = gRows.map(parseSqliteRow).filter(g => g.ownerId === ownerId);
        for (const item of generic) {
          const col = item.collection || 'generic';
          if (!payload[col]) payload[col] = [];
          payload[col].push(item);
        }

        return payload;
      } catch (err) {
        console.warn('[LocalDatabase] Error getting unsynced payload from native SQLite:', err);
        if (isWindowsNativeApp()) throw err;
      }
    }

    // IndexedDB fallback
    try {
      const db = await this.init();
      const customers = (await db.getAllFromIndex('customers', 'ownerId', ownerId)).filter(
        c => c.sync_status === 0 && c.ownerId === ownerId
      );
      const products = (await db.getAllFromIndex('products', 'ownerId', ownerId)).filter(
        p => p.sync_status === 0 && p.ownerId === ownerId
      );
      const orders = (await db.getAllFromIndex('orders', 'ownerId', ownerId)).filter(
        o => o.sync_status === 0 && o.ownerId === ownerId
      );
      const order_items = (await db.getAllFromIndex('order_items', 'ownerId', ownerId)).filter(
        i => i.sync_status === 0 && i.ownerId === ownerId
      );

      const payload: SyncPayload = { customers, products, orders, order_items };

      const ownerGeneric = await db.getAllFromIndex('generic_documents', 'ownerId', ownerId);
      const unsyncedGeneric = ownerGeneric.filter(
        g => g.sync_status === 0 && g.ownerId === ownerId
      );
      for (const item of unsyncedGeneric) {
        const col = item.collection || 'generic';
        if (!payload[col]) payload[col] = [];
        payload[col].push(item);
      }

      return payload;
    } catch (err) {
      console.error('[LocalDatabase] Unable to read unsynced changes from IndexedDB:', err);
      throw err;
    }
  }

  async getUnsyncedCount(ownerId = getActiveOwnerId()): Promise<number> {
    await this.nativeReadyPromise;
    if (!ownerId) return 0;

    if (nativeSqlite.isAvailable()) {
      const rows = await nativeSqlite.query<{ count: number }>(
        `SELECT
          (SELECT COUNT(*) FROM customers WHERE sync_status = 0 AND ownerId = ?) +
          (SELECT COUNT(*) FROM products WHERE sync_status = 0 AND ownerId = ?) +
          (SELECT COUNT(*) FROM orders WHERE sync_status = 0 AND ownerId = ?) +
          (SELECT COUNT(*) FROM order_items WHERE sync_status = 0 AND ownerId = ?) +
          (SELECT COUNT(*) FROM generic_documents WHERE sync_status = 0 AND ownerId = ?) AS count`,
        [ownerId, ownerId, ownerId, ownerId, ownerId],
      );
      return Number(rows[0]?.count || 0);
    }

    const payload = await this.getUnsyncedPayload(ownerId);
    return Object.values(payload).reduce(
      (count, records) => count + (Array.isArray(records) ? records.length : 0),
      0,
    );
  }

  async markAsSynced(table: string, ids: string[], ownerId = getActiveOwnerId()): Promise<void> {
    await this.nativeReadyPromise;
    if (!ownerId || !ids || ids.length === 0) return;

    let nativePersisted = false;
    if (nativeSqlite.isAvailable()) {
      try {
        const stmts: SQLiteBatchStatement[] = [];
        if (['customers', 'products', 'orders', 'order_items'].includes(table)) {
          for (const id of ids) {
            stmts.push({
              sql: `UPDATE ${table} SET sync_status = 1 WHERE id = ? AND ownerId = ?`,
              params: [id, ownerId],
            });
          }
        } else {
          for (const id of ids) {
            stmts.push({
              sql: 'UPDATE generic_documents SET sync_status = 1 WHERE composite_key = ? AND ownerId = ?',
              params: [`${table}:${id}`, ownerId],
            });
          }
        }
        await nativeSqlite.batch(stmts);
        nativePersisted = true;
      } catch (err) {
        console.warn(`[LocalDatabase] Error marking as synced in native SQLite:`, err);
        if (isWindowsNativeApp()) {
          throw new Error('Không thể cập nhật trạng thái đồng bộ trong SQLite trên Windows.');
        }
      }
    }

    if (!nativePersisted || !isWindowsNativeApp()) {
      try {
        const db = await this.init();
        if (['customers', 'products', 'orders', 'order_items'].includes(table)) {
          const tx = db.transaction(table as any, 'readwrite');
          const store = tx.objectStore(table as any);
          for (const id of ids) {
            const item = await store.get(id);
            if (item?.ownerId === ownerId) {
              item.sync_status = 1;
              await store.put(item);
            }
          }
          await tx.done;
        } else {
          const tx = db.transaction('generic_documents', 'readwrite');
          const store = tx.objectStore('generic_documents');
          for (const id of ids) {
            const key = `${table}:${id}`;
            const item = await store.get(key);
            if (item?.ownerId === ownerId) {
              item.sync_status = 1;
              await store.put(item);
            }
          }
          await tx.done;
        }
      } catch {
        // Keep the native SQLite result authoritative when IndexedDB is unavailable.
      }
    }
  }

  async upsertRemoteChanges(changes: Record<string, any[]>, ownerId = getActiveOwnerId()): Promise<void> {
    if (!ownerId) return;
    await this.nativeReadyPromise;

    for (const [table, items] of Object.entries(changes)) {
      if (!Array.isArray(items) || items.length === 0) continue;
      const records = items
        .filter((item) => item && item.id && (!item.ownerId || item.ownerId === ownerId))
        .map((item) => ({
          ...item,
          id: String(item.id),
          collection: table,
          composite_key: `${table}:${item.id}`,
          ownerId,
          updated_at: item.updated_at || item.updatedAt || Date.now(),
          sync_status: 1,
        }));
      if (records.length === 0) continue;

      for (let offset = 0; offset < records.length; offset += 150) {
        const chunk = records.slice(offset, offset + 150);
        let nativePersisted = false;
        if (nativeSqlite.isAvailable()) {
          try {
            const statements = chunk.map((record) => this.createNativeUpsert(table, record, ownerId));
            await nativeSqlite.batch(statements);
            nativePersisted = true;
          } catch (error) {
            console.error(`[LocalDatabase] Unable to batch-save remote ${table} changes:`, error);
            if (isWindowsNativeApp()) throw error;
          }
        }

        if (!nativePersisted || !isWindowsNativeApp()) {
          const db = await this.init();
          const storeName = ['customers', 'products', 'orders', 'order_items'].includes(table)
            ? table
            : 'generic_documents';
          const tx = db.transaction(storeName as any, 'readwrite');
          const store = tx.objectStore(storeName as any);
          for (const record of chunk) {
            await store.put(record);
          }
          await tx.done;
        }

        if (getActiveOwnerId() === ownerId) {
          ramStore.loadDocuments(table, chunk, false);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('collection_changed', { detail: { collection: table } }));
          }
        }
        if (offset + chunk.length < records.length) {
          await new Promise((resolve) => setTimeout(resolve, 16));
        }
      }
    }
  }

  /**
   * Apply deletions received from VPS server
   * Xóa triệt để các tài liệu đã bị xóa trên Web / VPS khỏi Native SQLite, IndexedDB và RAM!
   */
  async applyRemoteDeletions(deletions: Record<string, string[]>, ownerId = getActiveOwnerId()): Promise<number> {
    await this.nativeReadyPromise;
    if (!ownerId || ownerId !== getActiveOwnerId()) return 0;
    let deletedCount = 0;
    const affectedTables = new Set<string>();

    for (const [table, ids] of Object.entries(deletions)) {
      if (!Array.isArray(ids) || ids.length === 0) continue;
      affectedTables.add(table);

      for (const id of ids) {
        if (!id) continue;
        const existing = await this.getDoc(table, id);
        if (existing?.ownerId !== ownerId) continue;
        await this.removeDoc(table, id, false);
        ramStore.deleteDocument(table, id, false);
        deletedCount++;
      }
    }

    if (affectedTables.size > 0 && typeof window !== 'undefined') {
      affectedTables.forEach(table => {
        window.dispatchEvent(new CustomEvent('collection_changed', { detail: { collection: table } }));
      });
    }

    return deletedCount;
  }

  /**
   * Reconcile full sync: Remove local records that no longer exist on VPS server
   * Đảm bảo mọi bản ghi đã xóa trên Web/thiết bị khác biến mất 100% trong lần Full Sync!
   */
  async reconcileFullSync(table: string, remoteIds: Set<string>, ownerId?: string | null): Promise<number> {
    await this.nativeReadyPromise;
    let removed = 0;
    const activeOwnerId = ownerId || getActiveOwnerId();

    try {
      let localRows: any[] = [];
      if (nativeSqlite.isAvailable()) {
        try {
          if (['customers', 'products', 'orders', 'order_items'].includes(table)) {
            localRows = await nativeSqlite.query(`SELECT id, ownerId, sync_status FROM ${table}`);
          } else {
            localRows = await nativeSqlite.query(`SELECT id, ownerId, sync_status FROM generic_documents WHERE collection = ?`, [table]);
          }
        } catch (err) {
          console.warn(`[LocalDatabase] Error querying ${table} for reconcile:`, err);
        }
      } else {
        try {
          const db = await this.init();
          if (['customers', 'products', 'orders', 'order_items'].includes(table)) {
            localRows = await db.getAll(table as any);
          } else {
            const allGeneric = await db.getAll('generic_documents');
            localRows = allGeneric.filter((r: any) => r.collection === table);
          }
        } catch (err) {
          console.warn(`[LocalDatabase] Error querying IndexedDB ${table} for reconcile:`, err);
        }
      }

      for (const r of localRows) {
        if (!r || !r.id) continue;
        if (!activeOwnerId || r.ownerId !== activeOwnerId) continue;
        // Đã đồng bộ với máy chủ (sync_status === 1) nhưng không còn trên server -> đã bị xóa!
        if (r.sync_status === 1 && !remoteIds.has(r.id)) {
          await this.removeDoc(table, r.id, false);
          ramStore.deleteDocument(table, r.id, false);
          removed++;
        }
      }

      if (removed > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('collection_changed', { detail: { collection: table } }));
      }
    } catch (err) {
      console.warn(`[LocalDatabase] Error reconciling full sync for ${table}:`, err);
    }

    return removed;
  }

  async getLocalDataStats(ownerId = getActiveOwnerId()): Promise<{ recordCount: number; estimatedBytes: number }> {
    await this.nativeReadyPromise;
    if (!ownerId) return { recordCount: 0, estimatedBytes: 0 };

    let recordCount = 0;
    if (nativeSqlite.isAvailable()) {
      const rows = await nativeSqlite.query<{ count: number }>(
        `SELECT
          (SELECT COUNT(*) FROM customers WHERE ownerId = ?) +
          (SELECT COUNT(*) FROM products WHERE ownerId = ?) +
          (SELECT COUNT(*) FROM orders WHERE ownerId = ?) +
          (SELECT COUNT(*) FROM order_items WHERE ownerId = ?) +
          (SELECT COUNT(*) FROM generic_documents WHERE ownerId = ?) AS count`,
        [ownerId, ownerId, ownerId, ownerId, ownerId],
      );
      recordCount = Number(rows[0]?.count || 0);
    } else {
      const db = await this.init();
      const tables = ['customers', 'products', 'orders', 'order_items'] as const;
      const counts = await Promise.all([
        ...tables.map((table) => db.countFromIndex(table, 'ownerId', ownerId)),
        db.countFromIndex('generic_documents', 'ownerId', ownerId),
      ]);
      recordCount = counts.reduce((total, count) => total + count, 0);
    }

    return { recordCount, estimatedBytes: recordCount * 850 };
  }

  /**
   * Preload all local data (Core + Generic collections) from SQLite/IndexedDB into RAM
   * Ensures 0ms instant searches & 100% offline-ready operations!
   */
  async preloadToRAM(ownerId = getActiveOwnerId()): Promise<{ collectionsLoaded: number; totalDocs: number }> {
    await this.nativeReadyPromise;
    if (!ownerId) {
      ramStore.clear();
      return { collectionsLoaded: 0, totalDocs: 0 };
    }
    const coreCollections = ['customers', 'products', 'orders', 'order_items'];
    let total = 0;
    const loadedCollections = new Set<string>();

    for (const col of coreCollections) {
      const docs = await this.getAllDocs(col, ownerId);
      total += docs.length;
      loadedCollections.add(col);
      console.log(`[LocalDatabase] Preloaded ${docs.length} records for ${col} into RAM`);
    }

    // Preload generic documents
    if (nativeSqlite.isAvailable()) {
      try {
        const rows = await nativeSqlite.query('SELECT * FROM generic_documents WHERE ownerId = ?', [ownerId]);
        const parsed = rows.map(parseSqliteRow);
        const filtered = parsed.filter(r => r.ownerId === ownerId);

        const byCol: Record<string, any[]> = {};
        for (const it of filtered) {
          const c = it.collection || 'generic';
          if (!byCol[c]) byCol[c] = [];
          byCol[c].push(it);
        }

        for (const [c, docs] of Object.entries(byCol)) {
          if (getActiveOwnerId() === ownerId) ramStore.loadDocuments(c, docs, true);
          loadedCollections.add(c);
          total += docs.length;
        }
      } catch (err) {
        console.warn('[LocalDatabase] Error preloading generic documents from native SQLite:', err);
      }
    } else {
      try {
        const db = await this.init();
        const ownerGeneric = await db.getAllFromIndex('generic_documents', 'ownerId', ownerId);
        const filtered = ownerGeneric.filter(r => r.ownerId === ownerId);

        const byCollection: Record<string, any[]> = {};
        for (const item of filtered) {
          const col = item.collection || 'generic';
          if (!byCollection[col]) byCollection[col] = [];
          byCollection[col].push(item);
        }

        for (const [col, docs] of Object.entries(byCollection)) {
          if (getActiveOwnerId() === ownerId) ramStore.loadDocuments(col, docs, true);
          loadedCollections.add(col);
          total += docs.length;
        }
      } catch (e) {
        console.warn('[LocalDatabase] Error preloading generic documents to RAM:', e);
      }
    }

    return { collectionsLoaded: loadedCollections.size, totalDocs: total };
  }
}

export const localDb = new LocalDatabase();
