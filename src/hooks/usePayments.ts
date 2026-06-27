/**
 * Hook quản lý payments
 * 🔧 REFACTOR: Thay thế code Firestore trực tiếp trong Home, QuickOrder
 */

import { useState, useEffect } from 'react';
import { paymentService, type WithId } from '../services/dataAccess';

interface UsePaymentsOptions {
  ownerId: string;
  enabled?: boolean;
  maxResults?: number;
}

export function usePayments({ ownerId, enabled = true, maxResults = 500 }: UsePaymentsOptions) {
  const [payments, setPayments] = useState<WithId<any>[]>([]);
  const [loading, setLoading] = useState(true);
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

  return { payments, loading, error };
}
