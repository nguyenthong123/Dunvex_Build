import { useState, useEffect } from 'react';
import { priceListService } from '../services/dataAccess';

export function usePriceLists({ ownerId, enabled = true }: {
  ownerId: string | undefined;
  enabled?: boolean;
}) {
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !ownerId) {
      setPriceLists([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = priceListService.listenByOwner(
      ownerId,
      (data) => { setPriceLists(data); setLoading(false); setError(null); },
      (err) => { console.error('usePriceLists error:', err); setError(err.message); setLoading(false); }
    );
    return unsubscribe;
  }, [ownerId, enabled]);

  return { priceLists, loading, error };
}
