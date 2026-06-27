/**
 * Hook quản lý inventory_logs
 * 🔧 REFACTOR: Thay thế code Firestore trực tiếp trong ProductList, InventoryPage
 */

import { useState, useEffect } from 'react';
import { inventoryService, type WithId } from '../services/dataAccess';

interface UseInventoryLogsOptions {
  ownerId: string;
  enabled?: boolean;
}

export function useInventoryLogs({ ownerId, enabled = true }: UseInventoryLogsOptions) {
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
    const unsubscribe = inventoryService.listenByOwner(
      ownerId,
      (data) => {
        // Sort by createdAt desc (giống logic cũ)
        const sorted = [...data].sort((a, b) => {
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA;
        });
        setLogs(sorted);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useInventoryLogs error:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [ownerId, enabled]);

  return {
    logs,
    loading,
    error,
    addLog: inventoryService.addLog,
    addLogWithId: inventoryService.addLogWithId,
  };
}
