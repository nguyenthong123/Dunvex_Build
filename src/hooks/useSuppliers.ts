import { useState, useEffect, useMemo } from 'react';
import { supplierService, supplierDebtService, WithId } from '../services/dataAccess';
import { useOwner } from './useOwner';

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<WithId<any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [debts, setDebts] = useState<WithId<any>[]>([]);
  const owner = useOwner();

  // Listen suppliers
  useEffect(() => {
    if (!owner.ownerId) {
      setSuppliers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = supplierService.listenByOwner(
      owner.ownerId,
      (data) => {
        setSuppliers(data);
        setLoading(false);
      },
      (err) => {
        console.error("Lỗi khi tải danh sách Nhà cung cấp:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [owner.ownerId]);

  // P0 #2: Listen debts realtime để tính totalDebt chính xác
  useEffect(() => {
    if (!owner.ownerId) {
      setDebts([]);
      return;
    }
    const unsubscribe = supplierDebtService.listenByOwner(
      owner.ownerId,
      (data) => setDebts(data),
      (err) => console.error("Lỗi tải công nợ:", err)
    );
    return () => unsubscribe();
  }, [owner.ownerId]);

  // Merge debts vào suppliers: tính calculatedDebt = SUM(debts theo supplierId)
  // P0 #2: override totalDebt bằng calculatedDebt từ debts (realtime, luôn chính xác)
  const suppliersWithDebt = useMemo(() => suppliers.map(s => {
    const supplierDebts = debts.filter(d => d.supplierId === s.id);
    const calculatedDebt = supplierDebts.reduce((sum, d) => {
      if (d.type === 'debt_increase') return sum + (Number(d.amount) || 0);
      if (d.type === 'payment') return sum - (Number(d.amount) || 0);
      return sum;
    }, 0);
    const hasDebtRecords = supplierDebts.length > 0;
    const fallbackDebt = Number(s.totalDebt) || 0;
    const finalDebt = hasDebtRecords ? Math.max(0, calculatedDebt) : fallbackDebt;
    return { ...s, totalDebt: finalDebt, calculatedDebt: Math.max(0, calculatedDebt) };
  }), [suppliers, debts]);

  const addSupplier = async (data: Record<string, any>) => {
    if (!owner.ownerId) throw new Error("No owner found");
    return await supplierService.create({ ...data, ownerId: owner.ownerId });
  };

  const updateSupplier = async (id: string, data: Record<string, any>) => {
    return await supplierService.update(id, data);
  };

  const deleteSupplier = async (id: string) => {
    return await supplierService.remove(id);
  };

  return {
    suppliers: suppliersWithDebt,
    loading,
    error,
    addSupplier,
    updateSupplier,
    deleteSupplier
  };
}
