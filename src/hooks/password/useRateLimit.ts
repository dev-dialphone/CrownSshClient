import { useState, useCallback } from 'react';

export interface RateLimitInfo {
  vmRemaining: number;
  adminRemaining: number;
  isAdmin?: boolean;
}

export function useRateLimit() {
  const [manualRateLimit, setManualRateLimit] = useState<RateLimitInfo | null>(null);
  const [autoRateLimit, setAutoRateLimit] = useState<RateLimitInfo | null>(null);

  const loadRateLimitInfo = useCallback(async (vmId: string) => {
    try {
      const res = await fetch(`/api/vms/${vmId}/password/rate-limit`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setManualRateLimit(data.manual);
        setAutoRateLimit(data.auto);
      }
    } catch (error) {
      console.error('Failed to load rate limit info:', error);
    }
  }, []);

  return {
    manualRateLimit,
    autoRateLimit,
    loadRateLimitInfo,
  };
}

export function getRateLimitText(info: RateLimitInfo | null, type: 'manual' | 'auto'): { text: string; isAdmin: boolean } | null {
  if (!info) return null;
  
  if (info.isAdmin) {
    return { text: 'No rate limit for admin', isAdmin: true };
  }
  
  const limits = type === 'manual' 
    ? { vm: 5, admin: 20 }
    : { vm: 3, admin: 10 };
  
  return {
    text: `Rate limits: ${info.vmRemaining}/${limits.vm} ${type} changes per VM, ${info.adminRemaining}/${limits.admin} per admin (hourly)`,
    isAdmin: false,
  };
}
