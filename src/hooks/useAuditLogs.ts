/**
 * Hook quản lý audit_logs
 * 🔧 REFACTOR: Thay thế code Firestore trực tiếp trong Home, AdminSettings, và tất cả views ghi log
 */

import { useState, useEffect } from 'react';
import { auditService, type WithId } from '../services/dataAccess';

interface UseAuditLogsOptions {
  ownerId: string;
  enabled?: boolean;
  maxResults?: number;
}

export function useAuditLogs({ ownerId, enabled = true, maxResults = 100 }: UseAuditLogsOptions) {
  const [logs, setLogs] = useState<WithId<any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ownerId || !enabled) {
      setLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = auditService.listenByOwner(
      ownerId,
      (data) => {
        setLogs(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useAuditLogs error:', err);
        setError(err as Error);
        setLoading(false);
      },
      maxResults,
    );

    return unsubscribe;
  }, [ownerId, enabled, maxResults]);

  return {
    logs,
    loading,
    error,
    addLog: auditService.addLog,
    addLogWithId: auditService.addLogWithId,
  };
}
