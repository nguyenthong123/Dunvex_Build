/**
 * Hook quản lý payments
 * 🔧 REFACTOR: Thay thế code Firestore trực tiếp trong Home, QuickOrder
 * 🔄 PAGINATION: Hỗ trợ loadMore bằng cursor-based pagination
 */

import { useState, useEffect, useCallback } from 'react';
import { paymentService, type WithId, type PaginatedResult } from '../services/dataAccess';

interface UsePaymentsOptions {
  ownerId: string;
  enabled?: boolean;
  maxResults?: number;
}

export function usePayments({ ownerId, enabled = true, maxResults = 500 }: UsePaymentsOptions) {
  const [payments, setPayments] = useState<WithId<any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [paginationCursor, setPaginationCursor] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ownerId || !enabled) {
      setPayments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = paymentService.listenByOwner(
      ownerId,
      (data) => {
        setPayments(data);
        setHasMore(data.length >= maxResults);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('usePayments error:', err);
        setError(err as Error);
        setLoading(false);
      },
      maxResults,
    );

    return unsubscribe;
  }, [ownerId, enabled, maxResults]);

  /** 🔄 Load thêm payments cũ */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !ownerId) return;
    setLoadingMore(true);
    try {
      let result: PaginatedResult<any>;
      if (!paginationCursor) {
        result = await paymentService.getByOwnerPaginated(ownerId, 200);
        const existingIds = new Set(payments.map((p: any) => p.id));
        const newItems = result.items.filter((item: any) => !existingIds.has(item.id));
        setPayments(prev => [...prev, ...newItems]);
        setHasMore(result.hasMore && newItems.length > 0);
        setPaginationCursor(result.lastDoc);
      } else {
        result = await paymentService.getByOwnerPaginated(ownerId, 200, paginationCursor);
        setPayments(prev => [...prev, ...result.items]);
        setHasMore(result.hasMore);
        setPaginationCursor(result.lastDoc);
      }
    } catch (err) {
      console.error('loadMore payments error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [ownerId, loadingMore, hasMore, paginationCursor, payments]);

  return { payments, loading, loadingMore, hasMore, loadMore, error };
}
