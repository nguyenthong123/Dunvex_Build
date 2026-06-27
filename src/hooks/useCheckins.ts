import { useState, useEffect } from 'react';
import { checkinService } from '../services/dataAccess';

export function useCheckins({ ownerId, enabled = true, maxResults = 500 }: {
  ownerId: string | undefined;
  enabled?: boolean;
  maxResults?: number;
}) {
  const [checkins, setCheckins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !ownerId) {
      setCheckins([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = checkinService.listenByOwner(
      ownerId,
      (data) => {
        setCheckins(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useCheckins error:', err);
        setError(err.message);
        setLoading(false);
      },
      maxResults,
    );
    return unsubscribe;
  }, [ownerId, enabled, maxResults]);

  return { checkins, loading, error };
}
