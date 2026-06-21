import { useState, useEffect } from 'react';
import { attendanceService } from '../services/dataAccess';

export function useAttendanceLogs({ ownerId, enabled = true }: {
  ownerId: string | undefined;
  enabled?: boolean;
}) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !ownerId) {
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = attendanceService.listenByOwner(
      ownerId,
      (data) => { setLogs(data); setLoading(false); setError(null); },
      (err) => { console.error('useAttendanceLogs error:', err); setError(err.message); setLoading(false); }
    );
    return unsubscribe;
  }, [ownerId, enabled]);

  return { logs, loading, error };
}
