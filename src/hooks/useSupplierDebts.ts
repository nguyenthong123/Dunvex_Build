import { useState, useEffect } from 'react';
import { supplierDebtService, WithId } from '../services/dataAccess';
import { useOwner } from './useOwner';

export function useSupplierDebts() {
  const [debts, setDebts] = useState<WithId<any>[]>([]);
  const [loading, setLoading] = useState(true);
  const owner = useOwner();

  useEffect(() => {
    if (!owner.ownerId) {
      setDebts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = supplierDebtService.listenByOwner(
      owner.ownerId,
      (data) => {
        setDebts(data);
        setLoading(false);
      },
      (err) => {
        console.error("Lỗi khi tải công nợ NCC:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [owner.ownerId]);

  const addDebt = async (data: Record<string, any>) => {
    if (!owner.ownerId) throw new Error("No owner found");
    return await supplierDebtService.create({ ...data, ownerId: owner.ownerId });
  };

  const removeDebt = async (id: string) => {
    return await supplierDebtService.remove(id);
  };

  return { debts, loading, addDebt, removeDebt };
}
