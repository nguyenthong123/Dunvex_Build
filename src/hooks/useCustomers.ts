/**
 * Hook quản lý customers
 * 🔧 SIMPLIFIED: Dùng customer.debt từ Firestore trực tiếp (VPS bot sync authoritative)
 * Không còn merge từ debts collection — tránh split brain dữ liệu
 */

import { useState, useEffect } from 'react';
import { customerService, type WithId } from '../services/dataAccess';

interface UseCustomersOptions {
  ownerId: string;
  enabled?: boolean;
}

export function useCustomers({ ownerId, enabled = true }: UseCustomersOptions) {
  const [customers, setCustomers] = useState<WithId<any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Listen customers (debt field do VPS bot sync, luôn là authoritative)
  useEffect(() => {
    if (!ownerId || !enabled) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = customerService.listenByOwner(
      ownerId,
      (data) => {
        setCustomers(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useCustomers error:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [ownerId, enabled]);

  return {
    customers,
    loading,
    error,
    create: customerService.create,
    update: customerService.update,
  };
}
