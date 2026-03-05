import React, { useEffect, useState } from 'react';
import { useMonitorStore, SortField, SortDirection } from '../store/monitorStore';
import { useVMStore } from '../store/vmStore';
import { useAuthStore } from '../store/authStore';
import { VMTag, TagRequest } from '../types';
import {
  ChevronDown,
  ChevronRight,
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Phone,
  Gauge,
  TrendingUp,
  ArrowUpDown,
  Tag,
  Plus,
  X,
  Clock,
  Edit3,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

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

export const MonitoringPanel: React.FC = () => {
  const vmGroups = useVMStore(state => state.vmGroups);
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

  const [vmTags, setVmTags] = useState<Record<string, VMTagsData>>({});
  const [myTags, setMyTags] = useState<Record<string, MyTagData>>({});
  const [tagModalVm, setTagModalVm] = useState<{ vmId: string; vmName: string } | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tagSubmitting, setTagSubmitting] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

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
  }, [selectedEnvId, vmMetrics, canTag, user]);

  const fetchVmTags = async (vmId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/tags/vm/${vmId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setVmTags(prev => ({ ...prev, [vmId]: data }));
      }
    } catch (err) {
      console.error('Failed to fetch VM tags:', err);
    }
  };

  const fetchMyTag = async (vmId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/tags/vm/${vmId}/my-tag`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMyTags(prev => ({ ...prev, [vmId]: data }));
      }
    } catch (err) {
      console.error('Failed to fetch my tag:', err);
    }
  };

  const handleAddTag = async () => {
    if (!tagModalVm || !tagInput.trim()) return;

    setTagSubmitting(true);
    setTagError(null);

    try {
      const res = await fetch(`${API_URL}/api/tags/vm/${tagModalVm.vmId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tagText: tagInput.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.hasExistingTag) {
          setTagError('You have already tagged this VM. Please request a tag change instead.');
        } else {
          setTagError(data.error || 'Failed to add tag');
        }
        return;
      }

      setTagModalVm(null);
      setTagInput('');
      fetchVmTags(tagModalVm.vmId);
      fetchMyTag(tagModalVm.vmId);
    } catch (err) {
      setTagError('Failed to add tag');
    } finally {
      setTagSubmitting(false);
    }
  };

  const handleRequestTagChange = async (requestType: 'add' | 'remove') => {
    if (!tagModalVm || !tagInput.trim()) return;

    setTagSubmitting(true);
    setTagError(null);

    try {
      const res = await fetch(`${API_URL}/api/tags/vm/${tagModalVm.vmId}/request-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tagText: tagInput.trim(), requestType }),
      });

      const data = await res.json();

      if (!res.ok) {
        setTagError(data.error || 'Failed to request tag change');
        return;
      }

      setTagModalVm(null);
      setTagInput('');
      fetchMyTag(tagModalVm.vmId);
    } catch (err) {
      setTagError('Failed to request tag change');
    } finally {
      setTagSubmitting(false);
    }
  };

  const handleRemoveTag = async (vmId: string, tagIndex: number) => {
    if (!isAdmin) return;

    try {
      const res = await fetch(`${API_URL}/api/tags/vm/${vmId}/tag/${tagIndex}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        fetchVmTags(vmId);
      }
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-400';
      case 'warning':
        return 'text-yellow-400';
      case 'critical':
        return 'text-red-400';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-zinc-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-red-500';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-zinc-500';
    }
  };

  const getUsageBarColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [field, direction] = e.target.value.split('-') as [SortField, SortDirection];
    setSort(field, direction);
  };

  const sortedVmMetrics = getSortedVmMetrics();

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col">
        <div className="p-3 border-b border-zinc-800">
          <h2 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider text-zinc-400">
            <Activity size={16} /> Environments
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {vmGroups.map(group => {
            const isSelected = selectedEnvId === group.environmentId;

            return (
              <button
                key={group.environmentId}
                onClick={() => selectEnvironment(group.environmentId)}
                className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
                  isSelected
                    ? 'bg-blue-600/20 border-l-2 border-blue-500'
                    : 'hover:bg-zinc-900 border-l-2 border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isSelected ? (
                    <ChevronDown size={14} className="text-blue-400" />
                  ) : (
                    <ChevronRight size={14} className="text-zinc-500" />
                  )}
                  <span className={`text-sm ${isSelected ? 'text-blue-400 font-medium' : 'text-zinc-300'}`}>
                    {group.environmentName}
                  </span>
                </div>
                <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                  {group.vmCount}
                </span>
              </button>
            );
          })}
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
      </div>

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

            {summary && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                  Environment Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-zinc-400 text-xs">
                      <Phone size={12} />
                      Total Active
                    </div>
                    <p className="text-2xl font-bold text-zinc-100">
                      {summary.totalActive.toLocaleString()}
                    </p>
                    <p className="text-xs text-zinc-500">/ {summary.totalCapacity.toLocaleString()}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-zinc-400 text-xs">
                      <Gauge size={12} />
                      Total CPS
                    </div>
                    <p className="text-2xl font-bold text-zinc-100">
                      {summary.totalCPS}
                    </p>
                    <p className="text-xs text-zinc-500">/ {summary.maxCPS}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-zinc-400 text-xs">
                      <TrendingUp size={12} />
                      Usage
                    </div>
                    <p className="text-2xl font-bold text-zinc-100">
                      {summary.usagePercent}%
                    </p>
                    <div className="w-full bg-zinc-800 rounded-full h-2 mt-1">
                      <div
                        className={`h-2 rounded-full transition-all ${getUsageBarColor(summary.usagePercent)}`}
                        style={{ width: `${Math.min(summary.usagePercent, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-zinc-400 text-xs">
                      <Activity size={12} />
                      VM Status
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle size={12} /> {summary.healthyVMs}
                      </span>
                      {summary.errorVMs > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-400">
                          <XCircle size={12} /> {summary.errorVMs}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{summary.totalVMs} total</p>
                  </div>
                </div>
              </div>
            )}

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
                    <div
                      key={vm.vmId}
                      className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleVmExpand(vm.vmId)}
                        className="w-full p-3 flex items-center justify-between text-left hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown size={14} className="text-zinc-500" />
                          ) : (
                            <ChevronRight size={14} className="text-zinc-500" />
                          )}
                          <div className={`w-2 h-2 rounded-full ${getStatusBg(vm.status)}`} />
                          <span className="text-sm font-medium text-zinc-200">{vm.vmName}</span>
                          <span className="text-xs text-zinc-500">{vm.vmIp}</span>
                        </div>

                        {vm.status !== 'error' ? (
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-zinc-400">
                              <span className="text-zinc-200 font-medium">{vm.activeCalls}</span>
                              <span className="text-zinc-500">/{vm.maxSessions}</span>
                            </span>
                            <span className="text-zinc-400">
                              CPS: <span className="text-zinc-200">{vm.currentCPS}</span>
                              <span className="text-zinc-500">/{vm.maxCPS}</span>
                            </span>
                            <span className={`font-medium ${getStatusColor(vm.status)}`}>
                              {vm.usagePercent}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-red-400 flex items-center gap-1">
                            <XCircle size={12} /> {vm.error || 'Error'}
                          </span>
                        )}
                      </button>

                      {vm.status !== 'error' && (
                        <div className="px-3 pb-2">
                          <div className="w-full bg-zinc-800 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${getUsageBarColor(vm.usagePercent)}`}
                              style={{ width: `${Math.min(vm.usagePercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t border-zinc-800/50 space-y-3">
                          {vm.status !== 'error' && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div>
                                <span className="text-zinc-500">Peak Calls</span>
                                <p className="text-zinc-200 font-medium">{vm.peakCalls.toLocaleString()}</p>
                              </div>
                              <div>
                                <span className="text-zinc-500">Total Sessions</span>
                                <p className="text-zinc-200 font-medium">{vm.totalSessions.toLocaleString()}</p>
                              </div>
                              <div>
                                <span className="text-zinc-500">Current CPS</span>
                                <p className="text-zinc-200 font-medium">{vm.currentCPS} / {vm.maxCPS}</p>
                              </div>
                              <div>
                                <span className="text-zinc-500">Status</span>
                                <p className={`font-medium capitalize flex items-center gap-1 ${getStatusColor(vm.status)}`}>
                                  {vm.status === 'healthy' && <CheckCircle size={10} />}
                                  {vm.status === 'warning' && <AlertTriangle size={10} />}
                                  {vm.status === 'critical' && <XCircle size={10} />}
                                  {vm.status}
                                </p>
                              </div>
                            </div>
                          )}

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-zinc-500 text-xs font-medium flex items-center gap-1">
                                <Tag size={12} /> Tags
                              </span>
                              {canTag && (
                                <button
                                  onClick={() => setTagModalVm({ vmId: vm.vmId, vmName: vm.vmName })}
                                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                >
                                  {myTagData?.myTag ? <Edit3 size={10} /> : <Plus size={10} />}
                                  {myTagData?.myTag ? 'Request Change' : 'Add Tag'}
                                </button>
                              )}
                            </div>

                            {vmTagData?.tags && vmTagData.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {vmTagData.tags.map((tag, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300"
                                  >
                                    <Tag size={10} className="text-zinc-500" />
                                    {tag.text}
                                    {isAdmin && (
                                      <button
                                        onClick={() => handleRemoveTag(vm.vmId, index)}
                                        className="ml-1 text-zinc-500 hover:text-red-400"
                                      >
                                        <X size={10} />
                                      </button>
                                    )}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-600">No tags</p>
                            )}

                            {myTagData?.hasPendingRequest && (
                              <p className="text-xs text-yellow-500 mt-2 flex items-center gap-1">
                                <Clock size={10} /> You have a pending tag change request
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {tagModalVm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-100">
                {myTags[tagModalVm.vmId]?.myTag ? 'Request Tag Change' : 'Add Tag'}
              </h3>
              <button onClick={() => { setTagModalVm(null); setTagInput(''); setTagError(null); }}>
                <X size={16} className="text-zinc-500 hover:text-zinc-300" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 mb-3">
              VM: {tagModalVm.vmName}
            </p>

            {myTags[tagModalVm.vmId]?.myTag && (
              <div className="mb-3 p-2 bg-zinc-800 rounded text-xs">
                <span className="text-zinc-500">Your current tag:</span>
                <span className="ml-2 text-zinc-300">{myTags[tagModalVm.vmId].myTag?.text}</span>
              </div>
            )}

            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Enter tag text..."
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              maxLength={50}
            />

            {tagError && (
              <p className="text-xs text-red-400 mt-2">{tagError}</p>
            )}

            <div className="flex gap-2 mt-4">
              {myTags[tagModalVm.vmId]?.myTag ? (
                <>
                  <button
                    onClick={() => handleRequestTagChange('remove')}
                    disabled={tagSubmitting || !tagInput.trim()}
                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-sm font-medium transition-colors"
                  >
                    Request Remove
                  </button>
                  <button
                    onClick={() => handleRequestTagChange('add')}
                    disabled={tagSubmitting || !tagInput.trim()}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-sm font-medium transition-colors"
                  >
                    Request Change
                  </button>
                </>
              ) : (
                <button
                  onClick={handleAddTag}
                  disabled={tagSubmitting || !tagInput.trim()}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-sm font-medium transition-colors"
                >
                  Add Tag
                </button>
              )}
              <button
                onClick={() => { setTagModalVm(null); setTagInput(''); setTagError(null); }}
                className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
