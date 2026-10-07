import { useState, useEffect, useCallback } from 'react';
import { syncEngine, type SyncState } from '../services/syncEngine';

export function useSyncEngine() {
  const [state, setState] = useState<SyncState>(() => syncEngine.getState());

  useEffect(() => {
    return syncEngine.subscribe((newState) => {
      setState(newState);
    });
  }, []);

  const triggerSync = useCallback(async () => {
    return await syncEngine.syncNow();
  }, []);

  return {
    ...state,
    triggerSync,
  };
}
