/**
 * Hook quản lý products — tất cả views dùng chung hook này
 * 🔧 REFACTOR: Thay thế code Firestore trực tiếp trong ProductList, InventoryPage, Home, NexusControl, QuickOrder, PriceList
 */

import { useState, useEffect } from 'react';
import { productService, type WithId } from '../services/dataAccess';

interface UseProductsOptions {
  ownerId: string;
  enabled?: boolean;
  isPaginated?: boolean;
  page?: number;
  pageSize?: number;
  searchKeyword?: string;
}

export function useProducts({ 
  ownerId, 
  enabled = true,
  isPaginated = false,
  page = 1,
  pageSize = 50,
  searchKeyword = ''
}: UseProductsOptions) {
  const [products, setProducts] = useState<WithId<any>[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ownerId || !enabled) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    if (isPaginated) {
      const fetchData = async () => {
        try {
          const res = await productService.getProductsPaginated(ownerId, page, pageSize, searchKeyword);
          setProducts(res.items);
          setTotalItems(res.totalItems);
          setTotalPages(res.totalPages);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('useProducts paginated error:', err);
          setError(err as Error);
          setLoading(false);
        }
      };

      fetchData();

      // 2. Setup a global listener for collection changes
      const handleGlobalChange = (e: any) => {
        if (e.detail?.collection === 'products') {
          fetchData();
        }
      };
      window.addEventListener('collection_changed', handleGlobalChange);

      return () => {
        window.removeEventListener('collection_changed', handleGlobalChange);
      };
    } else {
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
    }
  }, [ownerId, enabled, isPaginated, page, pageSize, searchKeyword]);

  return {
    products,
    totalItems,
    totalPages,
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
    getAllCategories: productService.getAllCategories,
  };
}
