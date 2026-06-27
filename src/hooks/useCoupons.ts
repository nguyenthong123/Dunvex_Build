import { useState, useEffect } from 'react';
import { couponService } from '../services/dataAccess';

export function useCoupons({ ownerId, enabled = true, maxResults }: {
  ownerId: string | undefined;
  enabled?: boolean;
  maxResults?: number;
}) {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !ownerId) {
      setCoupons([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = couponService.listenByOwner(
      ownerId,
      (data) => {
        const sorted = [...data].sort((a, b) => {
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA;
        });
        setCoupons(maxResults ? sorted.slice(0, maxResults) : sorted);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useCoupons error:', err);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [ownerId, enabled, maxResults]);

  return { coupons, loading, error };
}
