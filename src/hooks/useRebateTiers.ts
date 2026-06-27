/**
 * Hook quản lý cấu hình chiết khấu trả sau (rebate tiers)
 */

import { useState, useEffect } from 'react';
import { rebateTierService, type WithId } from '../services/dataAccess';

interface RebateTier {
  minAmount: number;
  percent: number;
}

interface RebateConfig {
  id: string;
  customerType: string;
  tiers: RebateTier[];
  updatedAt?: any;
}

interface UseRebateTiersOptions {
  ownerId: string;
  enabled?: boolean;
}

export function useRebateTiers({ ownerId, enabled = true }: UseRebateTiersOptions) {
  const [tiers, setTiers] = useState<WithId<RebateConfig>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ownerId || !enabled) {
      setTiers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = rebateTierService.listenByOwner(
      ownerId,
      (data) => {
        setTiers(data as WithId<RebateConfig>[]);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useRebateTiers error:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [ownerId, enabled]);

  const saveTiers = async (customerType: string, tierData: RebateTier[]) => {
    try {
      await rebateTierService.saveTiers(ownerId, customerType, tierData);
    } catch (err) {
      console.error('saveTiers error:', err);
      throw err;
    }
  };

  const getTiersForType = (customerType: string): RebateTier[] => {
    const config = tiers.find(t => t.customerType === customerType);
    return config?.tiers || [];
  };

  return {
    tiers,
    loading,
    error,
    saveTiers,
    getTiersForType,
  };
}
