/**
 * Local SQLite Database Module — Thay thế JSON file store
 * 
 * Interface giữ nguyên như phiên bản JSON cũ để không phải sửa consumer code.
 * Data lưu dạng 1 table/collection, mỗi doc là 1 row với cột `doc` (JSON text).
 * Các field thường query (ownerId, createdAt, status, customerId...) được extract
 * thành virtual column + index để query nhanh.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const dbEvents = new EventEmitter();

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DB_PATH = process.env.NODE_ENV === 'test' && process.env.DUNVEX_DB_PATH
  ? path.resolve(process.env.DUNVEX_DB_PATH)
  : path.join(DATA_DIR, 'dunvex.db');

/** @type {import('better-sqlite3').Database} */
let db;

// ─── Init ─────────────────────────────────────────────────

function ensureDataDir() {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

function removeAccents(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function load(filePath) {
  // Already initialized — skip (prevents double-connection from cron-eod.js)
  if (db) {
    console.log('[DB] Already loaded, skipping re-init');
    return;
  }
  ensureDataDir();
  db = new Database(DB_PATH);

  // Register accent-insensitive function for search
  db.function('remove_accents', (str) => removeAccents(str));

  // Performance settings
  db.pragma('journal_mode = WAL');       // Write-Ahead Log — faster concurrent reads
  db.pragma('synchronous = NORMAL');      // Safe enough with WAL, much faster
  db.pragma('cache_size = -8000');        // 8MB cache
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');       // Wait 5s before failing on lock

  console.log(`[DB] SQLite opened: ${DB_PATH}`);

  // ── Migration: JSON → SQLite (one-time) ──
  const migrated = db.pragma('user_version', { simple: true });
  if (migrated === 0) {
    migrateFromJson(filePath);
  }

  // Ensure core tables exist including coupons & deletions
  ensureTable('coupons');
  ensureDeletionsTable();

  console.log(`[DB] Ready — ${getStatsRaw().totalDocs} documents across ${getStatsRaw().collections} tables`);
}

function migrateFromJson(filePath) {
  const jsonPath = filePath
    ? path.resolve(filePath)
    : path.join(DATA_DIR, 'dunvex-latest-backup.json');

  if (!fs.existsSync(jsonPath)) {
    console.log('[DB] No JSON backup found, starting fresh');
    db.pragma('user_version = 1');
    return;
  }

  console.log(`[DB] Migrating from JSON: ${jsonPath}...`);
  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const jsonData = JSON.parse(raw);
    const collections = jsonData.collections || {};

    let totalDocs = 0;
    const migration = db.transaction(() => {
      for (const [collName, col] of Object.entries(collections)) {
        if (!col.documents || col.documents.length === 0) continue;

        ensureTable(collName);
        const insert = db.prepare(`INSERT OR IGNORE INTO "${collName}" (id, doc) VALUES (?, ?)`);

        for (const doc of col.documents) {
          const normalized = normalizeDoc(doc);
          const docStr = JSON.stringify(normalized);
          insert.run(normalized.id, docStr);
          totalDocs++;
        }
      }
    });

    migration();
    db.pragma('user_version = 1');
    console.log(`[DB] ✅ Migrated ${totalDocs} documents from JSON → SQLite`);
  } catch (err) {
    console.error('[DB] Migration failed:', err.message);
    // Still mark as migrated so we don't retry with corrupt data
    db.pragma('user_version = 1');
  }
}

// ─── Table Management ─────────────────────────────────────

// Các field thường query → tạo virtual column + index
const INDEXABLE_FIELDS = ['ownerId', 'createdAt', 'updatedAt', 'status', 'customerId', 'productId', 'orderId', 'supplierId', 'userId', 'code', 'scope'];

function ensureTable(collection) {
  const safeName = collection.replace(/[^a-zA-Z0-9_]/g, '_');

  // Check if table exists
  const exists = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
  ).get(safeName);

  if (!exists) {
    // Virtual columns cho field thường query
    const virtualCols = INDEXABLE_FIELDS
      .map(f => `"${f}" TEXT GENERATED ALWAYS AS (json_extract(doc, '$.${f}')) VIRTUAL`)
      .join(', ');

    db.exec(`
      CREATE TABLE IF NOT EXISTS "${safeName}" (
        id TEXT PRIMARY KEY,
        doc TEXT NOT NULL
        ${virtualCols ? ', ' + virtualCols : ''}
      )
    `);
    console.log(`[DB] Created table: ${safeName}`);
  } else {
    // Table exists — check missing virtual columns and add them dynamically
    try {
      const existingCols = db.prepare(`PRAGMA table_info("${safeName}")`).all().map(c => c.name);
      INDEXABLE_FIELDS.forEach(f => {
        if (!existingCols.includes(f)) {
          try {
            db.exec(`ALTER TABLE "${safeName}" ADD COLUMN "${f}" TEXT GENERATED ALWAYS AS (json_extract(doc, '$.${f}')) VIRTUAL`);
            console.log(`[DB] Added virtual column "${f}" to table ${safeName}`);
          } catch (colErr) {
            // Ignore if column already exists or ALTER fails
          }
        }
      });
    } catch (pragmaErr) {
      console.warn(`[DB] Error inspecting table info for ${safeName}:`, pragmaErr.message);
    }
  }

  // Create indexes for all commonly queried fields (idempotent & safe)
  INDEXABLE_FIELDS.forEach(f => {
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS "idx_${safeName}_${f}" ON "${safeName}"("${f}")`);
    } catch (idxErr) {
      // Ignore index error if column is not supported or already indexed
    }
  });

  return safeName;
}

function tableName(collection) {
  return collection.replace(/[^a-zA-Z0-9_]/g, '_');
}

// ─── Helpers ──────────────────────────────────────────────

function randomId(length = 20) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function normalizeTimestamp(val) {
  if (val && typeof val === 'object') {
    if (val.seconds !== undefined) {
      return new Date(val.seconds * 1000 + (val.nanoseconds || 0) / 1e6).toISOString();
    }
    if (val._seconds !== undefined) {
      return new Date(val._seconds * 1000 + (val._nanoseconds || 0) / 1e6).toISOString();
    }
  }
  return val;
}

function normalizeDoc(data) {
  if (!data || typeof data !== 'object') return data;
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'createdAt' || k === 'updatedAt' || k.endsWith('At') || k.endsWith('Date')) {
      out[k] = normalizeTimestamp(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ─── CRUD ─────────────────────────────────────────────────

/**
 * Get all documents in a collection, with optional filters.
 * Supports: where (field:op:value), search (LIKE), orderBy, limit, offset
 */
export function getAll(collection, options = {}) {
  const tbl = tableName(collection);
  ensureTable(collection);

  const conditions = [];
  const params = [];

  // Build WHERE from options.where hoặc query string format
  if (options.where && Array.isArray(options.where)) {
    for (const clause of options.where) {
      if (typeof clause === 'string') {
        const parts = clause.split(':');
        if (parts.length >= 3) {
          const field = parts[0];
          const op = parts[1];
          const value = parts.slice(2).join(':');
          if (INDEXABLE_FIELDS.includes(field)) {
            conditions.push(`"${field}" ${sqlOp(op)} ?`);
          } else {
            conditions.push(`json_extract(doc, '$.${field}') ${sqlOp(op)} ?`);
          }
          params.push(value);
        }
      } else if (typeof clause === 'object') {
        const field = clause.field;
        if (INDEXABLE_FIELDS.includes(field)) {
          conditions.push(`"${field}" ${sqlOp(clause.op)} ?`);
        } else {
          conditions.push(`json_extract(doc, '$.${field}') ${sqlOp(clause.op)} ?`);
        }
        params.push(String(clause.value));
      }
    }
  }

  // Build SEARCH (LIKE on doc JSON string with accent insensitivity & multi-token support)
  if (options.search && typeof options.search === 'string' && options.search.trim().length > 0) {
    const rawNoAcc = removeAccents(options.search).trim();
    const tokens = rawNoAcc.split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      for (const token of tokens) {
        conditions.push(`remove_accents(doc) LIKE ?`);
        params.push(`%${token}%`);
      }
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // ORDER BY
  let orderClause = '';
  if (options.orderBy) {
    const parts = typeof options.orderBy === 'string'
      ? options.orderBy.split(':')
      : [options.orderBy.field, options.orderBy.direction || 'asc'];
    const field = parts[0];
    const dir = (parts[1] || 'asc').toUpperCase();
    if (INDEXABLE_FIELDS.includes(field)) {
      orderClause = `ORDER BY "${field}" ${dir === 'DESC' ? 'DESC' : 'ASC'}`;
    } else {
      orderClause = `ORDER BY json_extract(doc, '$.${field}') ${dir === 'DESC' ? 'DESC' : 'ASC'}`;
    }
  }

  // LIMIT & OFFSET
  let limitClause = '';
  if (options.limit && options.limit > 0) {
    limitClause = `LIMIT ${Math.min(options.limit, 5000)}`;
    if (options.offset && options.offset > 0) {
      limitClause += ` OFFSET ${options.offset}`;
    }
  }

  const sql = `SELECT doc FROM "${tbl}" ${whereClause} ${orderClause} ${limitClause}`;
  const rows = db.prepare(sql).all(...params);

  return rows.map(row => JSON.parse(row.doc));
}

/**
 * Count documents matching the filters (where, search)
 */
export function countAll(collection, options = {}) {
  const tbl = tableName(collection);
  ensureTable(collection);

  const conditions = [];
  const params = [];

  if (options.where && Array.isArray(options.where)) {
    for (const clause of options.where) {
      if (typeof clause === 'string') {
        const parts = clause.split(':');
        if (parts.length >= 3) {
          const field = parts[0];
          const op = parts[1];
          const value = parts.slice(2).join(':');
          if (INDEXABLE_FIELDS.includes(field)) {
            conditions.push(`"${field}" ${sqlOp(op)} ?`);
          } else {
            conditions.push(`json_extract(doc, '$.${field}') ${sqlOp(op)} ?`);
          }
          params.push(value);
        }
      } else if (typeof clause === 'object') {
        const field = clause.field;
        if (INDEXABLE_FIELDS.includes(field)) {
          conditions.push(`"${field}" ${sqlOp(clause.op)} ?`);
        } else {
          conditions.push(`json_extract(doc, '$.${field}') ${sqlOp(clause.op)} ?`);
        }
        params.push(String(clause.value));
      }
    }
  }

  if (options.search && typeof options.search === 'string' && options.search.trim().length > 0) {
    const rawNoAcc = removeAccents(options.search).trim();
    const tokens = rawNoAcc.split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      for (const token of tokens) {
        conditions.push(`remove_accents(doc) LIKE ?`);
        params.push(`%${token}%`);
      }
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const sql = `SELECT COUNT(*) as count FROM "${tbl}" ${whereClause}`;
  const row = db.prepare(sql).get(...params);
  return row.count || 0;
}

/** Get single document by ID */
export function get(collection, id) {
  const tbl = tableName(collection);
  ensureTable(collection);

  // Try primary key first
  let row = db.prepare(`SELECT doc FROM "${tbl}" WHERE id = ?`).get(id);
  if (row) return JSON.parse(row.doc);

  // Fallback: match by doc.id in JSON
  row = db.prepare(`SELECT doc FROM "${tbl}" WHERE json_extract(doc, '$.id') = ?`).get(id);
  return row ? JSON.parse(row.doc) : null;
}

/** Create a new document */
export function create(collection, data, customId) {
  ensureTable(collection);
  const tbl = tableName(collection);

  const id = customId || (data && typeof data === 'object' ? data.id : null) || randomId();
  const now = new Date().toISOString();
  const normalized = normalizeDoc(data);
  const doc = {
    id,
    ...normalized,
    createdAt: normalized.createdAt || now,
    updatedAt: now,
  };

  db.prepare(`INSERT OR REPLACE INTO "${tbl}" (id, doc) VALUES (?, ?)`).run(id, JSON.stringify(doc));
  dbEvents.emit('change', { collection });
  return doc;
}

/** Update an existing document */
export function update(collection, id, data) {
  const tbl = tableName(collection);
  ensureTable(collection);

  const existing = get(collection, id) || {};
  const normalized = normalizeDoc(data);

  // Handle __inc__ increment markers (Firebase compatibility)
  for (const [key, val] of Object.entries(normalized)) {
    if (typeof val === 'string' && val.startsWith('__inc__')) {
      const incAmount = Number(val.slice(7)) || 0;
      normalized[key] = (Number(existing[key]) || 0) + incAmount;
    }
  }

  const doc = {
    ...existing,
    ...normalized,
    id, // ensure id doesn't get overwritten
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.prepare(`INSERT OR REPLACE INTO "${tbl}" (id, doc) VALUES (?, ?)`).run(id, JSON.stringify(doc));
  dbEvents.emit('change', { collection });
  return doc;
}

/** Ensure _deletions table exists for tombstone tracking across devices */
export function ensureDeletionsTable() {
  if (!db) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS "_deletions" (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      ownerId TEXT,
      deletedAt INTEGER NOT NULL,
      PRIMARY KEY (collection, id)
    )
  `);
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS "idx_deletions_owner_time" ON "_deletions"(ownerId, deletedAt)`);
  } catch {}
}

/** Record a deletion for syncing to offline devices */
export function recordDeletion(collection, id, ownerId) {
  if (!db || !collection || !id || collection === '_deletions') return;
  try {
    ensureDeletionsTable();
    db.prepare(`
      INSERT OR REPLACE INTO "_deletions" (collection, id, ownerId, deletedAt)
      VALUES (?, ?, ?, ?)
    `).run(collection, id, ownerId || '', Date.now());
  } catch (err) {
    console.warn('[DB] Failed to record deletion:', err.message);
  }
}

/** Get all deleted document IDs for an owner since timestamp */
export function getDeletions(ownerId, sinceTimestamp = 0) {
  if (!db) return {};
  try {
    ensureDeletionsTable();
    const rows = db.prepare(`
      SELECT collection, id, deletedAt
      FROM "_deletions"
      WHERE (ownerId = ? OR ownerId = '' OR ownerId IS NULL)
        AND deletedAt > ?
    `).all(ownerId || '', sinceTimestamp);

    const result = {};
    for (const row of rows) {
      if (!result[row.collection]) result[row.collection] = [];
      result[row.collection].push(row.id);
    }
    return result;
  } catch (err) {
    console.warn('[DB] Failed to get deletions:', err.message);
    return {};
  }
}

/** Remove a document by ID */
export function remove(collection, id) {
  const tbl = tableName(collection);
  ensureTable(collection);

  const existing = get(collection, id);
  const ownerId = existing?.ownerId || null;

  // Try primary key match first
  let result = db.prepare(`DELETE FROM "${tbl}" WHERE id = ?`).run(id);
  if (result.changes > 0) {
    recordDeletion(collection, id, ownerId);
    dbEvents.emit('change', { collection });
    return true;
  }

  // Fallback: try matching doc.id in JSON (handles migrated docs with mismatched ids)
  result = db.prepare(`DELETE FROM "${tbl}" WHERE json_extract(doc, '$.id') = ?`).run(id);
  if (result.changes > 0) {
    recordDeletion(collection, id, ownerId);
    dbEvents.emit('change', { collection });
    return true;
  }
  return false;
}

/** Get or create */
export function getOrCreate(collection, id, defaultData = {}) {
  const existing = get(collection, id);
  if (existing) return existing;
  return create(collection, { id, ...defaultData }, id);
}

/** Batch write trong 1 transaction */
export function batchWrite(operations) {
  const batch = db.transaction(() => {
    for (const op of operations) {
      switch (op.type) {
        case 'create':
          create(op.collection, op.data, op.id);
          break;
        case 'update':
          update(op.collection, op.id, op.data);
          break;
        case 'delete':
          remove(op.collection, op.id);
          break;
      }
    }
  });
  batch();
}

/** Run a synchronous callback and commit all SQLite writes together. */
export function withTransaction(callback) {
  const transaction = db.transaction(callback);
  return transaction();
}

// Aliases for backward compatibility
export const getById = get;
export const add = create;

/** Get collection stats */
export function getStats() {
  const stats = {};
  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_dummy'`
  ).all();

  for (const t of tables) {
    const row = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get();
    stats[t.name] = row.count;
  }
  return stats;
}

function getStatsRaw() {
  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_dummy'`
  ).all();
  let totalDocs = 0;
  for (const t of tables) {
    const row = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get();
    totalDocs += row.count;
  }
  return { collections: tables.length, totalDocs };
}

/** Không cần flush với SQLite (WAL mode handles persistence) */
export function forceFlush() {
  // SQLite WAL mode tự động flush. Giữ để tương thích API cũ.
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (e) {
    // ignore
  }
}

// ─── SQL Operator Mapping ─────────────────────────────────

function sqlOp(op) {
  switch (op) {
    case '==': return '=';
    case '!=': return '!=';
    case '>': return '>';
    case '<': return '<';
    case '>=': return '>=';
    case '<=': return '<=';
    case 'array-contains': return '='; // fallback — check exact match
    default: return '=';
  }
}

// ─── Auto-init ────────────────────────────────────────────
export function close() {
  if (db) {
    try {
      db.close();
    } catch (e) {
      console.error('[DB] Error closing database:', e.message);
    }
    db = null;
    console.log('[DB] Connection closed successfully');
  }
}

// Tests initialize an isolated database explicitly.
if (process.env.NODE_ENV !== 'test') load();
