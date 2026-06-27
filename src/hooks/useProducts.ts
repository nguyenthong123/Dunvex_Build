/**
 * Hook quản lý products — tất cả views dùng chung hook này
 * 🔧 REFACTOR: Thay thế code Firestore trực tiếp trong ProductList, InventoryPage, Home, SaleBot, NexusControl, QuickOrder, PriceList
 */

import { useState, useEffect } from 'react';
import { productService, type WithId } from '../services/dataAccess';

interface UseProductsOptions {
  ownerId: string;
  enabled?: boolean;
}

export function useProducts({ ownerId, enabled = true }: UseProductsOptions) {
  const [products, setProducts] = useState<WithId<any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ownerId || !enabled) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = productService.listenByOwner(
      ownerId,
      (data) => {
        setProducts(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useProducts error:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [ownerId, enabled]);

  return {
    products,
    loading,
    error,
    /** Refresh: tạm set loading để trigger re-render (listener vẫn chạy realtime) */
    refresh: () => setLoading(true),
    /** CRUD helpers */
    create: productService.create,
    update: productService.update,
    remove: productService.remove,
    findBySku: productService.findBySku,
    getById: productService.getById,
  };
}
