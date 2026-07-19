/**
 * Hook quản lý inventory_logs
 * 🔧 REFACTOR: Thay thế code Firestore trực tiếp trong ProductList, InventoryPage
 * 🔒 TIME FILTER: Chỉ lấy logs 90 ngày gần nhất (xử lý trong dataAccess)
 * 🔄 PAGINATION: Hỗ trợ loadMore để xem lịch sử cũ hơn
 */

import { useState, useEffect, useCallback } from 'react';
import { inventoryService, type WithId, type PaginatedResult } from '../services/dataAccess';

interface UseInventoryLogsOptions {
  ownerId: string;
  enabled?: boolean;
}

export function useInventoryLogs({ ownerId, enabled = true }: UseInventoryLogsOptions) {
  const [logs, setLogs] = useState<WithId<any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [paginationCursor, setPaginationCursor] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !ownerId) {
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = inventoryService.listenByOwner(
      ownerId,
      (data) => {
        // Đã được sorted bởi orderBy('createdAt', 'desc') trong query
        setLogs(data);
        setHasMore(data.length >= 500);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useInventoryLogs error:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [ownerId, enabled]);

  /** 🔄 Load thêm inventory_logs cũ hơn 90 ngày (không bị time filter) */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !ownerId) return;
    setLoadingMore(true);
    try {
      let result: PaginatedResult<any>;
      if (!paginationCursor) {
        result = await inventoryService.getByOwnerPaginated(ownerId, 200);
        const existingIds = new Set(logs.map((l: any) => l.id));
        const newItems = result.items.filter((item: any) => !existingIds.has(item.id));
        setLogs(prev => [...prev, ...newItems]);
        setHasMore(result.hasMore && newItems.length > 0);
        setPaginationCursor(result.lastDoc);
      } else {
        result = await inventoryService.getByOwnerPaginated(ownerId, 200, paginationCursor);
        setLogs(prev => [...prev, ...result.items]);
        setHasMore(result.hasMore);
        setPaginationCursor(result.lastDoc);
      }
    } catch (err) {
      console.error('loadMore inventory_logs error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [ownerId, loadingMore, hasMore, paginationCursor, logs]);

  return {
    logs,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    error,
    addLog: inventoryService.addLog,
    addLogWithId: inventoryService.addLogWithId,
  };
}
