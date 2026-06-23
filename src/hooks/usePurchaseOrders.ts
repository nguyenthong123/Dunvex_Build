import { useState, useEffect } from 'react';
import { purchaseOrderService, WithId } from '../services/dataAccess';
import { useOwner } from './useOwner';

export function usePurchaseOrders() {
  const [purchaseOrders, setPurchaseOrders] = useState<WithId<any>[]>([]);
  const [loading, setLoading] = useState(true);
  const owner = useOwner();

  useEffect(() => {
    if (!owner.ownerId) {
      setPurchaseOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = purchaseOrderService.listenByOwner(
      owner.ownerId,
      (data) => {
        setPurchaseOrders(data);
        setLoading(false);
      },
      (err) => {
        console.error("Lỗi khi tải danh sách Đơn nhập hàng:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [owner.ownerId]);

  const addPurchaseOrder = async (data: Record<string, any>) => {
    if (!owner.ownerId) throw new Error("No owner found");
    return await purchaseOrderService.create({ ...data, ownerId: owner.ownerId });
  };

  const updatePurchaseOrder = async (id: string, data: Record<string, any>) => {
    return await purchaseOrderService.update(id, data);
  };

  const deletePurchaseOrder = async (id: string) => {
    return await purchaseOrderService.remove(id);
  };

  return { purchaseOrders, loading, addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder };
}
