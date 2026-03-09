import { useState, useCallback } from 'react';
import { VMTag, TagRequest } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

interface VMTagsData {
  tags: VMTag[];
  vmName: string;
  vmIp: string;
}

interface MyTagData {
  myTag: VMTag | null;
  hasPendingRequest: boolean;
  pendingRequest: TagRequest | null;
}

export function useVmTags() {
  const [vmTags, setVmTags] = useState<Record<string, VMTagsData>>({});
  const [myTags, setMyTags] = useState<Record<string, MyTagData>>({});

  const fetchVmTags = useCallback(async (vmId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/tags/vm/${vmId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setVmTags(prev => ({ ...prev, [vmId]: data }));
      }
    } catch (err) {
      console.error('Failed to fetch VM tags:', err);
    }
  }, []);

  const fetchMyTag = useCallback(async (vmId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/tags/vm/${vmId}/my-tag`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMyTags(prev => ({ ...prev, [vmId]: data }));
      }
    } catch (err) {
      console.error('Failed to fetch my tag:', err);
    }
  }, []);

  const addTag = useCallback(async (vmId: string, tagText: string): Promise<{ success: boolean; hasExistingTag?: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_URL}/api/tags/vm/${vmId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tagText }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { 
          success: false, 
          hasExistingTag: data.hasExistingTag,
          error: data.error || 'Failed to add tag' 
        };
      }

      await fetchVmTags(vmId);
      await fetchMyTag(vmId);
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to add tag' };
    }
  }, [fetchVmTags, fetchMyTag]);

  const requestTagChange = useCallback(async (vmId: string, tagText: string, requestType: 'add' | 'remove'): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_URL}/api/tags/vm/${vmId}/request-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tagText, requestType }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to request tag change' };
      }

      await fetchMyTag(vmId);
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to request tag change' };
    }
  }, [fetchMyTag]);

  const removeTag = useCallback(async (vmId: string, tagIndex: number): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/api/tags/vm/${vmId}/tag/${tagIndex}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        await fetchVmTags(vmId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [fetchVmTags]);

  return {
    vmTags,
    myTags,
    fetchVmTags,
    fetchMyTag,
    addTag,
    requestTagChange,
    removeTag,
  };
}
