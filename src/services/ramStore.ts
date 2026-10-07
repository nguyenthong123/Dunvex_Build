/**
 * In-Memory RAM Store for Dunvex
 * Tận dụng bộ nhớ RAM & đa nhân CPU của máy Mac để xử lý truy vấn, lọc, tìm kiếm siêu tốc (0ms).
 */

export interface QueryFilter {
  field: string;
  op: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in' | 'array-contains-any';
  value: any;
}

export interface QueryOptions {
  filters?: QueryFilter[];
  orderByField?: string | null;
  orderDir?: 'asc' | 'desc';
  limitCount?: number | null;
  offsetVal?: number | null;
  searchKeyword?: string | null;
  searchFields?: string[];
}

function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  if (!path.includes('.')) return obj[path];
  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[part];
  }
  return curr;
}

export class RAMStore {
  // Collection -> Map<DocId, DocumentData>
  private collections = new Map<string, Map<string, any>>();
  private listeners = new Map<string, Set<(docs: any[]) => void>>();
  private initializedCollections = new Set<string>();

  /**
   * Get total documents in memory across all collections
   */
  public getMemoryStats(): { totalCollections: number; totalDocs: number; collectionCounts: Record<string, number> } {
    let totalDocs = 0;
    const collectionCounts: Record<string, number> = {};
    for (const [colName, map] of this.collections.entries()) {
      collectionCounts[colName] = map.size;
      totalDocs += map.size;
    }
    return {
      totalCollections: this.collections.size,
      totalDocs,
      collectionCounts,
    };
  }

  public isCollectionInitialized(colName: string): boolean {
    return this.initializedCollections.has(colName);
  }

  public markCollectionInitialized(colName: string): void {
    this.initializedCollections.add(colName);
  }

  public getCollectionMap(colName: string): Map<string, any> {
    let map = this.collections.get(colName);
    if (!map) {
      map = new Map<string, any>();
      this.collections.set(colName, map);
    }
    return map;
  }

  /**
   * Batch load / replace documents into RAM
   */
  public loadDocuments(colName: string, docs: any[], replace = false): void {
    const map = this.getCollectionMap(colName);
    if (replace) {
      map.clear();
    }
    for (const doc of docs) {
      if (doc && doc.id) {
        map.set(doc.id, { ...doc });
      }
    }
    this.initializedCollections.add(colName);
    this.notifyCollection(colName);
  }

  /**
   * Set a single document in RAM
   */
  public setDocument(colName: string, id: string, data: any): void {
    const map = this.getCollectionMap(colName);
    map.set(id, { id, ...data });
    this.notifyCollection(colName);
  }

  /**
   * Update a document in RAM
   */
  public updateDocument(colName: string, id: string, updates: any): void {
    const map = this.getCollectionMap(colName);
    const existing = map.get(id) || { id };
    map.set(id, { ...existing, ...updates, id });
    this.notifyCollection(colName);
  }

  /**
   * Get a single document from RAM
   */
  public getDocument(colName: string, id: string): any | null {
    const map = this.collections.get(colName);
    if (!map) return null;
    const doc = map.get(id);
    return doc ? { ...doc } : null;
  }

  /**
   * Delete a document from RAM (or mark deleted)
   */
  public deleteDocument(colName: string, id: string, softDelete = false): void {
    const map = this.collections.get(colName);
    if (!map) return;
    if (softDelete) {
      const existing = map.get(id);
      if (existing) {
        map.set(id, { ...existing, is_deleted: 1, deleted: true, updated_at: Date.now() });
      }
    } else {
      map.delete(id);
    }
    this.notifyCollection(colName);
  }

  /**
   * Query documents directly from RAM using CPU
   */
  public query(colName: string, options: QueryOptions = {}): any[] {
    const map = this.collections.get(colName);
    if (!map || map.size === 0) return [];

    let results: any[] = [];

    const {
      filters = [],
      orderByField = null,
      orderDir = 'asc',
      limitCount = null,
      offsetVal = null,
      searchKeyword = null,
    } = options;

    const normalizedKeyword = searchKeyword ? removeVietnameseTones(searchKeyword) : null;

    for (const item of map.values()) {
      if (!item) continue;

      // 1. Skip soft-deleted items unless explicitly queried
      const hasDeletedFilter = filters.some(f => f.field === 'is_deleted' || f.field === 'deleted');
      if (!hasDeletedFilter && (item.is_deleted === 1 || item.deleted === true)) {
        continue;
      }

      // 2. Filters Evaluation
      let match = true;
      for (const filter of filters) {
        const val = getNestedValue(item, filter.field);
        const target = filter.value;

        // Special handling for soft delete checks
        if (filter.field === 'is_deleted' || filter.field === 'deleted') {
          const isDel = val === 1 || val === true || val === '1';
          const targetDel = target === 1 || target === true || target === '1';
          if (filter.op === '==' && isDel !== targetDel) {
            match = false;
            break;
          }
          if (filter.op === '!=' && isDel === targetDel) {
            match = false;
            break;
          }
          continue;
        }

        switch (filter.op) {
          case '==':
            if (val !== target) match = false;
            break;
          case '!=':
            if (val === target) match = false;
            break;
          case '>':
            if (val === undefined || val === null || !(val > target)) match = false;
            break;
          case '>=':
            if (val === undefined || val === null || !(val >= target)) match = false;
            break;
          case '<':
            if (val === undefined || val === null || !(val < target)) match = false;
            break;
          case '<=':
            if (val === undefined || val === null || !(val <= target)) match = false;
            break;
          case 'array-contains':
            if (!Array.isArray(val) || !val.includes(target)) match = false;
            break;
          case 'in':
            if (!Array.isArray(target) || !target.includes(val)) match = false;
            break;
          case 'array-contains-any':
            if (!Array.isArray(val) || !Array.isArray(target) || !target.some(t => val.includes(t))) match = false;
            break;
          default:
            break;
        }

        if (!match) break;
      }

      if (!match) continue;

      // 3. Search keyword evaluation (Instant In-Memory Fuzzy Search)
      if (normalizedKeyword) {
        let keywordMatch = false;
        const searchPool = [
          item.name,
          item.code,
          item.customer_code,
          item.product_code,
          item.order_code,
          item.phone,
          item.customer_name,
          item.customer_phone,
          item.note,
          item.supplier_name,
          item.supplier_code,
        ].filter(Boolean);

        for (const poolItem of searchPool) {
          const str = removeVietnameseTones(String(poolItem));
          if (str.includes(normalizedKeyword)) {
            keywordMatch = true;
            break;
          }
        }

        if (!keywordMatch) continue;
      }

      results.push({ ...item });
    }

    // 4. Order By
    if (orderByField) {
      results.sort((a, b) => {
        let valA = getNestedValue(a, orderByField);
        let valB = getNestedValue(b, orderByField);

        // Date/timestamp comparison
        if (typeof valA === 'string' && !isNaN(Date.parse(valA))) valA = new Date(valA).getTime();
        if (typeof valB === 'string' && !isNaN(Date.parse(valB))) valB = new Date(valB).getTime();

        if (valA === undefined || valA === null) return orderDir === 'asc' ? 1 : -1;
        if (valB === undefined || valB === null) return orderDir === 'asc' ? -1 : 1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return orderDir === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        if (strA < strB) return orderDir === 'asc' ? -1 : 1;
        if (strA > strB) return orderDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // 5. Offset & Limit
    if (offsetVal && offsetVal > 0) {
      results = results.slice(offsetVal);
    }
    if (limitCount && limitCount > 0) {
      results = results.slice(0, limitCount);
    }

    return results;
  }

  /**
   * Get stats (count, totalAmount, totalProfit) aggregated in RAM
   */
  public getStats(colName: string, options: QueryOptions = {}): { count: number; totalAmount: number; totalProfit: number } {
    // Run query without limit/offset to get aggregate over all matching items
    const docs = this.query(colName, { ...options, limitCount: null, offsetVal: null });
    let totalAmount = 0;
    let totalProfit = 0;

    for (const doc of docs) {
      totalAmount += Number(doc.total_amount || doc.total || doc.amount || 0);
      totalProfit += Number(doc.profit || doc.totalProfit || 0);
    }

    return {
      count: docs.length,
      totalAmount,
      totalProfit,
    };
  }

  /**
   * Subscribe to collection changes in RAM
   */
  public subscribe(colName: string, listener: (docs: any[]) => void): () => void {
    let set = this.listeners.get(colName);
    if (!set) {
      set = new Set();
      this.listeners.set(colName, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }

  private notifyCollection(colName: string) {
    const set = this.listeners.get(colName);
    if (set && set.size > 0) {
      const allDocs = this.query(colName);
      set.forEach(listener => listener(allDocs));
    }
  }

  /**
   * Clear all RAM cache
   */
  public clear(): void {
    const collectionNames = new Set([...this.collections.keys(), ...this.initializedCollections]);
    this.collections.clear();
    this.initializedCollections.clear();
    collectionNames.forEach((colName) => {
      this.listeners.get(colName)?.forEach((listener) => listener([]));
    });
  }
}

export const ramStore = new RAMStore();
