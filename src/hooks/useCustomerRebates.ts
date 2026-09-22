/**
 * Hook quản lý Chiết khấu trả sau theo từng khách hàng (Customer Rebates)
 */

import { useState, useEffect } from 'react';
import { customerRebateService, type CustomerRebateData, type WithId } from '../services/dataAccess';

interface UseCustomerRebatesOptions {
  ownerId: string;
  enabled?: boolean;
}

export function useCustomerRebates({ ownerId, enabled = true }: UseCustomerRebatesOptions) {
  const [rebates, setRebates] = useState<WithId<CustomerRebateData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ownerId || !enabled) {
      setRebates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = customerRebateService.listenByOwner(
      ownerId,
      (data) => {
        setRebates(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useCustomerRebates error:', err);
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [ownerId, enabled]);

  const createRebate = async (data: Omit<CustomerRebateData, 'ownerId' | 'createdAt' | 'updatedAt'>) => {
    return await customerRebateService.createRebate(ownerId, data);
  };

  const updateRebate = async (id: string, data: Partial<CustomerRebateData>) => {
    return await customerRebateService.updateRebate(id, data);
  };

  const deleteRebate = async (id: string) => {
    return await customerRebateService.deleteRebate(id);
  };

  return {
    rebates,
    loading,
    error,
    createRebate,
    updateRebate,
    deleteRebate,
  };
}
