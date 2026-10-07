import { useState, useEffect, useCallback } from 'react';
import { p2pSync, type P2PProgressState, type P2PDevice } from '../services/p2pSync';

export function useP2PSync() {
  const [state, setState] = useState<P2PProgressState>({
    isTransferring: false,
    role: 'idle',
    statusMessage: '',
    progressPercent: 0,
    totalImages: 0,
    completedImages: 0,
  });

  const [onlinePeers, setOnlinePeers] = useState<P2PDevice[]>([]);

  useEffect(() => {
    p2pSync.connect();
    const unsub = p2pSync.subscribe((newState) => {
      setState(newState);
      setOnlinePeers(p2pSync.getOnlinePeers());
    });
    return unsub;
  }, []);

  const requestImageSync = useCallback(async (targetDeviceId?: string) => {
    return await p2pSync.requestImageSyncFromPhone(targetDeviceId);
  }, []);

  return {
    ...state,
    onlinePeers,
    requestImageSync,
  };
}
