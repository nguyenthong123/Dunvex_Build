/**
 * Hook quản lý orders — tất cả views dùng chung hook này
 * 🔧 REFACTOR: Thay thế code Firestore trực tiếp trong Home, OrderList, QuickOrder, Debts, SaleBot, NexusControl
 * 🔄 PAGINATION: Hỗ trợ loadMore bằng cursor-based pagination
 */

import { useState, useEffect, useCallback } from 'react';
import { orderService, type WithId, type PaginatedResult } from '../services/dataAccess';

interface UseOrdersOptions {
  ownerId: string;
  enabled?: boolean;
  maxResults?: number;
}

export function useOrders({ ownerId, enabled = true, maxResults = 2000 }: UseOrdersOptions) {
  const [orders, setOrders] = useState<WithId<any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [paginationCursor, setPaginationCursor] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ownerId || !enabled) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = orderService.listenByOwner(
      ownerId,
      (data) => {
        setOrders(data);
        // Nếu data = maxResults → có thể còn order cũ hơn
        setHasMore(data.length >= maxResults);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useOrders error:', err);
        setError(err as Error);
        setLoading(false);
      },
      maxResults,
    );

    return unsubscribe;
  }, [ownerId, enabled, maxResults]);

  /** 🔄 Load thêm orders cũ (cursor-based pagination) */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !ownerId) return;
    setLoadingMore(true);
    try {
      // Lấy doc cuối cùng trong orders hiện tại làm cursor
      // Cần fetch page đầu tiên qua getByOwnerPaginated để có cursor chính xác
      // rồi dùng cursor đó để lấy page tiếp theo
      let result: PaginatedResult<any>;
      if (!paginationCursor) {
        // Lần đầu loadMore → lấy page 1 qua paginated API
        result = await orderService.getByOwnerPaginated(ownerId, 200);
        // Giữ lại items chưa có trong orders (do listener đã có 500 mới nhất)
        const existingIds = new Set(orders.map((o: any) => o.id));
        const newItems = result.items.filter((item: any) => !existingIds.has(item.id));
        // Merge vào cuối (các item cũ hơn)
        setOrders(prev => [...prev, ...newItems]);
        setHasMore(result.hasMore && newItems.length > 0);
        setPaginationCursor(result.lastDoc);
      } else {
        // Các lần sau → dùng cursor
        result = await orderService.getByOwnerPaginated(ownerId, 200, paginationCursor);
        setOrders(prev => [...prev, ...result.items]);
        setHasMore(result.hasMore);
        setPaginationCursor(result.lastDoc);
      }
    } catch (err) {
      console.error('loadMore orders error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [ownerId, loadingMore, hasMore, paginationCursor, orders]);

  return {
    orders,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    error,
    create: orderService.create,
    update: orderService.update,
    remove: orderService.remove,
  };
}
