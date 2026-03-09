import { useState, useCallback } from 'react';
import { PasswordHistoryEntry } from './usePasswordHistory';

export function useVmPasswordHistory() {
  const [vmHistory, setVmHistory] = useState<PasswordHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadVmHistory = useCallback(async (vmId: string) => {
    if (!vmId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/vms/${vmId}/password/history`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setVmHistory(data);
      }
    } catch {
      console.error('Failed to load VM history');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    vmHistory,
    loading,
    loadVmHistory,
  };
}
