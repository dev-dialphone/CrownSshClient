import { useState, useCallback } from 'react';

export interface PasswordHistoryEntry {
  id: string;
  vmId: string;
  vmName: string;
  vmIp: string;
  vmUsername: string;
  newPassword: string;
  oldPassword?: string;
  operationType: 'manual' | 'auto';
  changedBy: string;
  success: boolean;
  errorMessage?: string;
  createdAt: string;
}

export function usePasswordHistory() {
  const [history, setHistory] = useState<PasswordHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async (offset = 0) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vms/passwords/history?limit=50&offset=${offset}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.data);
      }
    } catch {
      console.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, []);

  const exportHistory = useCallback(async (format: 'csv' | 'json') => {
    try {
      const res = await fetch(`/api/vms/passwords/export?format=${format}`, {
        credentials: 'include'
      });
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `password-history.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert('Failed to export history');
    }
  }, []);

  return {
    history,
    loading,
    loadHistory,
    exportHistory,
  };
}
