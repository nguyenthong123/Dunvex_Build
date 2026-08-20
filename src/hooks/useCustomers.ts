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
  isPaginated?: boolean;
  page?: number;
  pageSize?: number;
  searchKeyword?: string;
}

export function useCustomers({ 
  ownerId, 
  enabled = true,
  isPaginated = false,
  page = 1,
  pageSize = 50,
  searchKeyword = ''
}: UseCustomersOptions) {
  const [customers, setCustomers] = useState<WithId<any>[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
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

    if (isPaginated) {
      const fetchData = async () => {
        try {
          const res = await customerService.getCustomersPaginated(ownerId, page, pageSize, searchKeyword);
          setCustomers(res.items);
          setTotalItems(res.totalItems);
          setTotalPages(res.totalPages);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('useCustomers paginated error:', err);
          setError(err as Error);
          setLoading(false);
        }
      };

      fetchData();

      // 2. Setup a global listener for collection changes
      const handleGlobalChange = (e: any) => {
        if (e.detail?.collection === 'customers') {
          fetchData();
        }
      };
      window.addEventListener('collection_changed', handleGlobalChange);

      return () => {
        window.removeEventListener('collection_changed', handleGlobalChange);
      };
    } else {
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
    }
  }, [ownerId, enabled, isPaginated, page, pageSize, searchKeyword]);

  return {
    customers,
    totalItems,
    totalPages,
    loading,
    error,
    create: customerService.create,
    update: customerService.update,
  };
}
