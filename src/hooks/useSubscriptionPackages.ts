import { useState, useEffect } from 'react';
import { subscriptionPackageService } from '../services/dataAccess';

export function useSubscriptionPackages({ enabled = true }: { enabled?: boolean } = {}) {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) { setPackages([]); setLoading(false); return; }
    setLoading(true);
    const unsubscribe = subscriptionPackageService.listen(
      (data) => { setPackages(data); setLoading(false); setError(null); },
      (err) => { console.error('useSubscriptionPackages error:', err); setError(err.message); setLoading(false); }
    );
    return unsubscribe;
  }, [enabled]);

  return { packages, loading, error };
}
