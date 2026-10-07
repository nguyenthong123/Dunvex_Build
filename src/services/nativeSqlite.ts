/**
 * Native SQLite bridge for Android and desktop apps.
 * Android uses CapacitorSQLite; macOS and Windows keep their existing native bridges.
 */

import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';

export interface SQLiteExecuteResult {
  rowsAffected: number;
  lastInsertId: number;
}

export interface SQLiteBatchStatement {
  sql: string;
  params?: any[];
}

export interface SQLitePingResult {
  status: string;
  dbPath: string;
  supportsStorageLocationSelection?: boolean;
}

export interface StorageLocationChangeResult {
  cancelled: boolean;
  dbPath?: string;
}

const ANDROID_DATABASE_NAME = 'dunvex_offline_db';
const ANDROID_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY, customer_code TEXT, name TEXT, phone TEXT, address TEXT,
    sync_status INTEGER DEFAULT 0, updated_at INTEGER, is_deleted INTEGER DEFAULT 0,
    ownerId TEXT, data_json TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, product_code TEXT, name TEXT, unit TEXT, base_price REAL,
    local_image_path TEXT, sync_status INTEGER DEFAULT 0, updated_at INTEGER,
    is_deleted INTEGER DEFAULT 0, ownerId TEXT, data_json TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, order_code TEXT, customer_id TEXT, total_amount REAL, note TEXT,
    is_printed INTEGER DEFAULT 0, local_image_path TEXT, image_sync_status INTEGER DEFAULT 0,
    sync_status INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER,
    is_deleted INTEGER DEFAULT 0, ownerId TEXT, data_json TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY, order_id TEXT, product_id TEXT, quantity REAL, unit_price REAL,
    amount REAL, sync_status INTEGER DEFAULT 0, updated_at INTEGER, product_name TEXT,
    unit TEXT, ownerId TEXT, data_json TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS generic_documents (
    composite_key TEXT PRIMARY KEY, collection TEXT, id TEXT,
    sync_status INTEGER DEFAULT 0, updated_at INTEGER, ownerId TEXT, data_json TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS app_metadata (key_name TEXT PRIMARY KEY, key_value TEXT)`,
  'CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(ownerId)',
  'CREATE INDEX IF NOT EXISTS idx_customers_sync ON customers(sync_status)',
  'CREATE INDEX IF NOT EXISTS idx_products_owner ON products(ownerId)',
  'CREATE INDEX IF NOT EXISTS idx_products_sync ON products(sync_status)',
  'CREATE INDEX IF NOT EXISTS idx_orders_owner ON orders(ownerId)',
  'CREATE INDEX IF NOT EXISTS idx_orders_sync ON orders(sync_status)',
  'CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)',
  'CREATE INDEX IF NOT EXISTS idx_order_items_sync ON order_items(sync_status)',
  'CREATE INDEX IF NOT EXISTS idx_generic_collection ON generic_documents(collection)',
  'CREATE INDEX IF NOT EXISTS idx_generic_sync ON generic_documents(sync_status)',
];

class NativeSQLiteBridge {
  private androidConnection = new SQLiteConnection(CapacitorSQLite);
  private androidDbPromise: Promise<SQLiteDBConnection> | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private initialized = false;

  constructor() {
    this.setupCallback();
  }

  private setupCallback() {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    // Swift calls: window.__sqliteBridgeCallback(requestId, result, error)
    (window as any).__sqliteBridgeCallback = (
      requestId: string,
      result: any,
      error: string | null
    ) => {
      const pending = this.pendingRequests.get(requestId);
      if (!pending) return;

      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);

      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
    };
  }

  /**
   * Check if the app has a native SQLite implementation available.
   */
  public isAvailable(): boolean {
    return this.isAndroidAvailable() || (
      typeof window !== 'undefined' &&
      ((window as any).webkit?.messageHandlers?.sqliteBridge !== undefined ||
       (window as any).chrome?.webview !== undefined)
    );
  }

  public isAndroidAvailable(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  private async getAndroidDatabase(): Promise<SQLiteDBConnection> {
    if (!this.isAndroidAvailable()) {
      throw new Error('Capacitor SQLite is only available in the Android app.');
    }

    if (!this.androidDbPromise) {
      this.androidDbPromise = (async () => {
        await this.androidConnection.checkConnectionsConsistency();
        const connection = await this.androidConnection.isConnection(ANDROID_DATABASE_NAME, false);
        const db = connection.result
          ? await this.androidConnection.retrieveConnection(ANDROID_DATABASE_NAME, false)
          : await this.androidConnection.createConnection(
              ANDROID_DATABASE_NAME,
              false,
              'no-encryption',
              1,
              false,
            );
        const open = await db.isDBOpen();
        if (!open.result) await db.open();
        for (const statement of ANDROID_SCHEMA) {
          await db.execute(statement);
        }
        return db;
      })().catch((error) => {
        this.androidDbPromise = null;
        throw error;
      });
    }
    return this.androidDbPromise;
  }

  public async initialize(): Promise<void> {
    if (this.isAndroidAvailable()) await this.getAndroidDatabase();
  }

  private send<T = any>(action: string, payload: Record<string, any> = {}): Promise<T> {
    this.setupCallback();

    if (!this.isAvailable()) {
      return Promise.reject(new Error('Native SQLite bridge is not available in current environment.'));
    }

    return new Promise<T>((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`SQLite request timed out after 30s: ${action}`));
        }
      }, 30000);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      try {
        if ((window as any).webkit?.messageHandlers?.sqliteBridge) {
          (window as any).webkit.messageHandlers.sqliteBridge.postMessage({
            requestId,
            action,
            ...payload,
          });
        } else if ((window as any).chrome?.webview) {
          (window as any).chrome.webview.postMessage({
            bridge: 'sqliteBridge',
            requestId,
            action,
            ...payload,
          });
        }
      } catch (err) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(err);
      }
    });
  }

  /**
   * Ping SQLite database and get file path
   */
  public async ping(): Promise<SQLitePingResult> {
    if (this.isAndroidAvailable()) {
      await this.getAndroidDatabase();
      return {
        status: 'ok',
        dbPath: `${ANDROID_DATABASE_NAME}.db (app-private)`,
        supportsStorageLocationSelection: false,
      };
    }
    return this.send<SQLitePingResult>('ping');
  }

  public supportsStorageLocationSelection(): boolean {
    return typeof window !== 'undefined' && (
      (window as any).webkit?.messageHandlers?.sqliteBridge !== undefined ||
      (window as any).chrome?.webview !== undefined
    );
  }

  public async chooseStorageLocation(): Promise<StorageLocationChangeResult> {
    if (!this.supportsStorageLocationSelection()) {
      throw new Error('Chỉ có thể thay đổi vị trí lưu trên ứng dụng Windows hoặc macOS.');
    }
    return this.send<StorageLocationChangeResult>('chooseStorageLocation');
  }

  /**
   * Execute an INSERT / UPDATE / DELETE statement
   */
  public async execute(sql: string, params: any[] = []): Promise<SQLiteExecuteResult> {
    if (this.isAndroidAvailable()) {
      const db = await this.getAndroidDatabase();
      const result = await db.run(sql, params, true);
      return {
        rowsAffected: result.changes?.changes ?? 0,
        lastInsertId: result.changes?.lastId ?? 0,
      };
    }
    return this.send<SQLiteExecuteResult>('execute', { sql, params });
  }

  /**
   * Execute a SELECT query and return rows
   */
  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (this.isAndroidAvailable()) {
      const db = await this.getAndroidDatabase();
      const result = await db.query(sql, params);
      return (result.values || []) as T[];
    }
    return this.send<T[]>('query', { sql, params });
  }

  /**
   * Execute multiple statements atomically inside a transaction
   */
  public async batch(statements: SQLiteBatchStatement[]): Promise<{ success: boolean }> {
    if (this.isAndroidAvailable()) {
      const db = await this.getAndroidDatabase();
      await db.executeSet(
        statements.map(({ sql, params }) => ({ statement: sql, values: params })),
        true,
      );
      return { success: true };
    }
    return this.send<{ success: boolean }>('batch', { statements });
  }
}

export const nativeSqlite = new NativeSQLiteBridge();
