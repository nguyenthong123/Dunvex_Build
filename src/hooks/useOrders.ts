/**
 * Hook quản lý orders — tất cả views dùng chung hook này
 * 🔧 REFACTOR: Thay thế code Firestore trực tiếp trong Home, OrderList, QuickOrder, Debts, NexusControl
 * 🔄 PAGINATION: Hỗ trợ loadMore bằng cursor-based pagination
 */

import { useState, useEffect, useCallback } from 'react';
import { orderService, type WithId, type PaginatedResult } from '../services/dataAccess';

interface UseOrdersOptions {
  ownerId: string;
  enabled?: boolean;
  maxResults?: number;
  isPaginated?: boolean;
  page?: number;
  pageSize?: number;
  searchKeyword?: string;
}

export function useOrders({ 
  ownerId, 
  enabled = true, 
  maxResults = 999999,
  isPaginated = false,
  page = 1,
  pageSize = 50,
  searchKeyword = ''
}: UseOrdersOptions) {
  const [orders, setOrders] = useState<WithId<any>[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ownerId || !enabled) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    if (isPaginated) {
      // 1. Fetch data initially
      const fetchData = async () => {
        try {
          const res = await orderService.getOrdersPaginated(ownerId, page, pageSize, searchKeyword);
          setOrders(res.items);
          setTotalItems(res.totalItems);
          setTotalPages(res.totalPages);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('useOrders paginated error:', err);
          setError(err as Error);
          setLoading(false);
        }
      };

      fetchData();

      // 2. Setup a global listener for collection changes
      const handleGlobalChange = (e: any) => {
        if (e.detail?.collection === 'orders') {
          fetchData();
        }
      };
      window.addEventListener('collection_changed', handleGlobalChange);

      return () => {
        window.removeEventListener('collection_changed', handleGlobalChange);
      };
    } else {
      // Old behavior
      const unsubscribe = orderService.listenByOwner(
        ownerId,
        (data) => {
          setOrders(data);
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
    }
  }, [ownerId, enabled, maxResults, isPaginated, page, pageSize, searchKeyword]);
  return {
    orders,
    totalItems,
    totalPages,
    loading,
    error,
    create: orderService.create,
    update: orderService.update,
    remove: orderService.remove,
  };
}
