import { useState, useEffect } from 'react';
import { supplierService, WithId } from '../services/dataAccess';
import { useOwner } from './useOwner';

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<WithId<any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const owner = useOwner();

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
    suppliers,
    loading,
    error,
    addSupplier,
    updateSupplier,
    deleteSupplier
  };
}
