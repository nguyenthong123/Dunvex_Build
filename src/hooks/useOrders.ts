/**
 * Hook quản lý orders — tất cả views dùng chung hook này
 * 🔧 REFACTOR: Thay thế code Firestore trực tiếp trong Home, OrderList, QuickOrder, Debts, SaleBot, NexusControl
 */

import { useState, useEffect } from 'react';
import { orderService, type WithId } from '../services/dataAccess';

interface UseOrdersOptions {
  ownerId: string;
  enabled?: boolean;
  maxResults?: number;
}

export function useOrders({ ownerId, enabled = true, maxResults = 500 }: UseOrdersOptions) {
  const [orders, setOrders] = useState<WithId<any>[]>([]);
  const [loading, setLoading] = useState(true);
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

  return {
    orders,
    loading,
    error,
    create: orderService.create,
    update: orderService.update,
    remove: orderService.remove,
  };
}
