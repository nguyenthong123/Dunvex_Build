/**
 * Hook quản lý customers
 * 🔧 REFACTOR: Thay thế code Firestore trực tiếp trong Home, CustomerList, QuickOrder
 * 📊 DEBT UNIFICATION: Tính công nợ từ debts collection (single source of truth)
 */

import { useState, useEffect } from 'react';
import { customerService, customerDebtService, type WithId } from '../services/dataAccess';

interface UseCustomersOptions {
  ownerId: string;
  enabled?: boolean;
}

export function useCustomers({ ownerId, enabled = true }: UseCustomersOptions) {
  const [customers, setCustomers] = useState<WithId<any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [debts, setDebts] = useState<WithId<any>[]>([]);

  // Listen customers
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

  // 📊 DEBT UNIFICATION: Listen debts realtime để tính công nợ chính xác
  useEffect(() => {
    if (!ownerId) {
      setDebts([]);
      return;
    }
    const unsubscribe = customerDebtService.listenByOwner(
      ownerId,
      (data) => setDebts(data),
      (err) => console.error("Lỗi tải công nợ KH:", err)
    );
    return () => unsubscribe();
  }, [ownerId]);

  // Merge debts vào customers: calculatedDebt = SUM(debts theo customerId)
  const customersWithDebt = customers.map(c => {
    const customerDebts = debts.filter(d => d.customerId === c.id);
    const calculatedDebt = customerDebts.reduce((sum, d) => {
      if (d.type === 'debt_increase') return sum + (Number(d.amount) || 0);
      if (d.type === 'payment') return sum - (Number(d.amount) || 0);
      return sum;
    }, 0);
    return {
      ...c,
      debt: Math.max(0, calculatedDebt),
      calculatedDebt: Math.max(0, calculatedDebt),
    };
  });

  return {
    customers: customersWithDebt,
    loading,
    error,
    create: customerService.create,
    update: customerService.update,
  };
}
