import React, { useState, useEffect, useMemo } from 'react';
import { Key } from 'lucide-react';
import { useVMStore } from '../store/vmStore';
import { usePasswordHistory, useRateLimit, useVmPasswordHistory } from '../hooks/password';
import {
  BulkPasswordUpdate,
  EnvironmentBulkUpdate,
  SingleVMPasswordManager,
  PasswordHistory,
} from './PasswordManager';

interface BulkResult {
  vmId: string;
  vmName: string;
  success: boolean;
  error?: string;
}

export default function VMPasswordManager() {
  const vmGroups = useVMStore(state => state.vmGroups);
  const fetchVMGroups = useVMStore(state => state.fetchVMGroups);
  
  const allVMs = useMemo(() => {
    return vmGroups.flatMap(g => g.vms);
  }, [vmGroups]);
  
  const [selectedVmId, setSelectedVmId] = useState<string>('');
  
  const { history, loading: historyLoading, loadHistory, exportHistory } = usePasswordHistory();
  const { manualRateLimit, autoRateLimit, loadRateLimitInfo } = useRateLimit();
  const { vmHistory, loading: vmHistoryLoading, loadVmHistory } = useVmPasswordHistory();
  
  useEffect(() => {
    fetchVMGroups();
    loadHistory();
  }, [fetchVMGroups, loadHistory]);
  
  useEffect(() => {
    if (selectedVmId) {
      loadRateLimitInfo(selectedVmId);
      loadVmHistory(selectedVmId);
    }
  }, [selectedVmId, loadRateLimitInfo, loadVmHistory]);
  
  const selectedVM = allVMs.find(v => v.id === selectedVmId);

  const handleBulkUpdate = async (password: string, testConnection: boolean): Promise<{ results: BulkResult[]; successCount: number; failCount: number }> => {
    const res = await fetch('/api/vms/passwords/bulk-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        newPassword: password, 
        testConnection,
      })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.message || data.error);
    }
    
    fetchVMGroups(true);
    loadHistory();
    
    return {
      results: data.results,
      successCount: data.successCount,
      failCount: data.failCount,
    };
  };

  const handleEnvBulkUpdate = async (envId: string, password: string, testConnection: boolean): Promise<{ results: BulkResult[]; successCount: number; failCount: number }> => {
    const res = await fetch(`/api/vms/environments/${envId}/passwords/bulk-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        newPassword: password, 
        testConnection,
      })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.message || data.error);
    }
    
    fetchVMGroups(true);
    loadHistory();
    
    return {
      results: data.results,
      successCount: data.successCount,
      failCount: data.failCount,
    };
  };

  const handleTestConnection = async (): Promise<{ success: boolean; message: string }> => {
    if (!selectedVmId) return { success: false, message: 'No VM selected' };
    
    const res = await fetch(`/api/vms/${selectedVmId}/password/test`, {
      method: 'POST',
      credentials: 'include'
    });
    const data = await res.json();
    
    return {
      success: data.success,
      message: data.message,
    };
  };

  const handleManualUpdate = async (password: string, testFirst: boolean) => {
    if (!selectedVmId || !password) return;
    
    const res = await fetch(`/api/vms/${selectedVmId}/password/manual`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ newPassword: password, testConnection: testFirst })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.message || data.error);
    }
    
    fetchVMGroups(true);
    loadRateLimitInfo(selectedVmId);
    loadHistory();
    loadVmHistory(selectedVmId);
  };

  const handleAutoReset = async (length: number, includeSpecial: boolean): Promise<string | null> => {
    if (!selectedVmId) return null;
    
    const res = await fetch(`/api/vms/${selectedVmId}/password/auto-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        length, 
        includeSpecialChars: includeSpecial,
        testBeforeChange: true,
      })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.message || data.error);
    }
    
    fetchVMGroups(true);
    loadRateLimitInfo(selectedVmId);
    loadHistory();
    loadVmHistory(selectedVmId);
    
    return data.newPassword;
  };

  const handleSyncPassword = async (password: string) => {
    if (!selectedVmId) return;
    
    const res = await fetch(`/api/vms/${selectedVmId}/password/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ actualPassword: password })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.message || data.error);
    }
    
    fetchVMGroups(true);
    loadVmHistory(selectedVmId);
    loadHistory();
  };

  const handleRestorePassword = async (historyId: string) => {
    if (!selectedVmId) return;
    
    const res = await fetch(`/api/vms/${selectedVmId}/password/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ historyId })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.message || data.error);
    }
    
    fetchVMGroups(true);
    loadVmHistory(selectedVmId);
    loadHistory();
    loadRateLimitInfo(selectedVmId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Key size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-200">VM Password Manager</h2>
            <p className="text-xs text-zinc-500">Manage and reset VM passwords securely</p>
          </div>
        </div>
      </div>
      
      <BulkPasswordUpdate 
        allVMsCount={allVMs.length} 
        onBulkUpdate={handleBulkUpdate}
      />
      
      <EnvironmentBulkUpdate onUpdate={handleEnvBulkUpdate} />
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <label className="block text-xs font-medium text-zinc-500 mb-2">Select Single VM</label>
        <select
          value={selectedVmId}
          onChange={(e) => setSelectedVmId(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
        >
          <option value="">-- Select a VM --</option>
          {vmGroups.map(group => (
            <optgroup key={group.environmentId} label={group.environmentName}>
              {group.vms.map(vm => (
                <option key={vm.id} value={vm.id}>{vm.name} ({vm.ip})</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      
      {selectedVM && (
        <SingleVMPasswordManager
          vm={selectedVM}
          manualRateLimit={manualRateLimit}
          autoRateLimit={autoRateLimit}
          vmHistory={vmHistory}
          vmHistoryLoading={vmHistoryLoading}
          onTestConnection={handleTestConnection}
          onManualUpdate={handleManualUpdate}
          onAutoReset={handleAutoReset}
          onSyncPassword={handleSyncPassword}
          onRestorePassword={handleRestorePassword}
        />
      )}
      
      <PasswordHistory
        history={history}
        loading={historyLoading}
        onExport={exportHistory}
      />
    </div>
  );
}
