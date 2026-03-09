import React, { useEffect, useState } from 'react';
import { useMonitorStore } from '../store/monitorStore';
import { useAuthStore } from '../store/authStore';
import { VMTag } from '../types';
import { useVmTags } from '../hooks/useVmTags';
import {
  EnvironmentSidebar,
  EnvironmentSummary,
  VMMetricsCard,
  TagModal,
} from './Monitoring';
import { Activity, RefreshCw, AlertTriangle, ArrowUpDown } from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'activeCalls-desc', label: 'Active Calls (High-Low)' },
  { value: 'activeCalls-asc', label: 'Active Calls (Low-High)' },
  { value: 'usagePercent-desc', label: 'Usage % (High-Low)' },
  { value: 'usagePercent-asc', label: 'Usage % (Low-High)' },
  { value: 'vmName-asc', label: 'VM Name (A-Z)' },
  { value: 'vmName-desc', label: 'VM Name (Z-A)' },
  { value: 'vmIp-asc', label: 'IP Address (A-Z)' },
  { value: 'vmIp-desc', label: 'IP Address (Z-A)' },
  { value: 'peakCalls-desc', label: 'Peak Calls (High-Low)' },
  { value: 'currentCPS-desc', label: 'Current CPS (High-Low)' },
  { value: 'totalSessions-desc', label: 'Total Sessions (High-Low)' },
  { value: 'maxSessions-desc', label: 'Max Capacity (High-Low)' },
];

export const MonitoringPanel: React.FC = () => {
  const { user, isAdmin, hasPermission } = useAuthStore();

  const {
    selectedEnvId,
    environmentName,
    configured,
    message,
    summary,
    vmMetrics,
    isLoading,
    autoRefresh,
    lastUpdated,
    expandedVmIds,
    sortField,
    sortDirection,
    selectEnvironment,
    fetchMetrics,
    toggleAutoRefresh,
    toggleVmExpand,
    setSort,
    getSortedVmMetrics,
  } = useMonitorStore();

  const { vmTags, myTags, fetchVmTags, fetchMyTag, addTag, requestTagChange, removeTag } = useVmTags();
  
  const [tagModalVm, setTagModalVm] = useState<{ vmId: string; vmName: string } | null>(null);

  const canTag = hasPermission('exec');

  useEffect(() => {
    if (!autoRefresh || !selectedEnvId) return;

    const interval = setInterval(() => {
      fetchMetrics();
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, selectedEnvId, fetchMetrics]);

  useEffect(() => {
    if (selectedEnvId && vmMetrics) {
      const vmIds = Object.keys(vmMetrics);
      vmIds.forEach(vmId => {
        fetchVmTags(vmId);
        if (canTag && user) {
          fetchMyTag(vmId);
        }
      });
    }
  }, [selectedEnvId, vmMetrics, canTag, user, fetchVmTags, fetchMyTag]);

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [field, direction] = e.target.value.split('-') as [typeof sortField, typeof sortDirection];
    setSort(field, direction);
  };

  const handleAddTag = async (vmId: string, tagText: string) => {
    const result = await addTag(vmId, tagText);
    if (!result.success) {
      if (result.hasExistingTag) {
        throw new Error('You have already tagged this VM. Please request a tag change instead.');
      }
      throw new Error(result.error || 'Failed to add tag');
    }
  };

  const handleRequestTagChange = async (vmId: string, tagText: string, requestType: 'add' | 'remove') => {
    const result = await requestTagChange(vmId, tagText, requestType);
    if (!result.success) {
      throw new Error(result.error || 'Failed to request tag change');
    }
  };

  const handleRemoveTag = async (vmId: string, tagIndex: number) => {
    if (!isAdmin) return;
    await removeTag(vmId, tagIndex);
  };

  const sortedVmMetrics = getSortedVmMetrics();

  return (
    <div className="flex h-full">
      <EnvironmentSidebar 
        selectedEnvId={selectedEnvId}
        onSelectEnvironment={selectEnvironment}
      />

      <div className="flex-1 overflow-y-auto bg-zinc-950 p-4">
        {!selectedEnvId ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <Activity size={48} className="mb-4 opacity-50" />
            <p>Select an environment to view metrics</p>
          </div>
        ) : isLoading && !vmMetrics ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw size={24} className="animate-spin text-blue-400" />
          </div>
        ) : !configured ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <AlertTriangle size={48} className="mb-4 text-yellow-500" />
            <p className="text-lg font-medium text-zinc-300">Monitoring Not Configured</p>
            <p className="mt-2 text-sm">{message || 'No monitoring command set for this environment'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">{environmentName} Environment</h2>
                {lastUpdated && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>

            {summary && <EnvironmentSummary summary={summary} />}

            {vmMetrics && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    VM Metrics ({Object.keys(vmMetrics).length})
                  </h3>
                  
                  <div className="flex items-center gap-2">
                    <ArrowUpDown size={14} className="text-zinc-500" />
                    <select
                      value={`${sortField}-${sortDirection}`}
                      onChange={handleSortChange}
                      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
                    >
                      {SORT_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {sortedVmMetrics.map(vm => {
                  const isExpanded = expandedVmIds.includes(vm.vmId);
                  const vmTagData = vmTags[vm.vmId];
                  const myTagData = myTags[vm.vmId];

                  return (
                    <VMMetricsCard
                      key={vm.vmId}
                      vm={vm}
                      isExpanded={isExpanded}
                      vmTagData={vmTagData}
                      myTagData={myTagData}
                      canTag={canTag}
                      isAdmin={isAdmin}
                      onToggleExpand={() => toggleVmExpand(vm.vmId)}
                      onOpenTagModal={() => setTagModalVm({ vmId: vm.vmId, vmName: vm.vmName })}
                      onRemoveTag={(tagIndex) => handleRemoveTag(vm.vmId, tagIndex)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-zinc-800 space-y-2">
        <button
          onClick={toggleAutoRefresh}
          className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded text-sm transition-colors ${
            autoRefresh
              ? 'bg-green-600/20 text-green-400 border border-green-600/30'
              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
          }`}
        >
          <RefreshCw size={14} className={autoRefresh ? 'animate-spin' : ''} />
          Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
        </button>

        {selectedEnvId && (
          <button
            onClick={() => fetchMetrics()}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh Now
          </button>
        )}
      </div>

      {tagModalVm && (
        <TagModal
          vmId={tagModalVm.vmId}
          vmName={tagModalVm.vmName}
          currentTag={myTags[tagModalVm.vmId]?.myTag || null}
          onClose={() => setTagModalVm(null)}
          onAddTag={(tagText) => handleAddTag(tagModalVm.vmId, tagText)}
          onRequestChange={(tagText, requestType) => handleRequestTagChange(tagModalVm.vmId, tagText, requestType)}
        />
      )}
    </div>
  );
};
