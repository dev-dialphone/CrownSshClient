import React from 'react';
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Tag,
  Plus,
  X,
  Clock,
  Edit3,
} from 'lucide-react';
import { MonitoringMetrics } from '../../types';
import { VMTag } from '../../types';

interface VMTagsData {
  tags: VMTag[];
  vmName: string;
  vmIp: string;
}

interface MyTagData {
  myTag: VMTag | null;
  hasPendingRequest: boolean;
}

interface VMMetricsCardProps {
  vm: MonitoringMetrics;
  isExpanded: boolean;
  vmTagData?: VMTagsData;
  myTagData?: MyTagData;
  canTag: boolean;
  isAdmin: boolean;
  onToggleExpand: () => void;
  onOpenTagModal: () => void;
  onRemoveTag: (tagIndex: number) => void;
}

export function VMMetricsCard({
  vm,
  isExpanded,
  vmTagData,
  myTagData,
  canTag,
  isAdmin,
  onToggleExpand,
  onOpenTagModal,
  onRemoveTag,
}: VMMetricsCardProps) {
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

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={onToggleExpand}
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
            {vm.maxSessions > 0 ? (
              <span className="text-zinc-400">
                <span className="text-zinc-200 font-medium">{vm.activeCalls}</span>
                <span className="text-zinc-500">/{vm.maxSessions}</span>
              </span>
            ) : (
              <span className="text-zinc-400">
                Active: <span className="text-zinc-200 font-medium">{vm.activeCalls}</span>
              </span>
            )}
            {(vm.currentCPS > 0 || vm.maxCPS > 0) && (
              <span className="text-zinc-400">
                CPS: <span className="text-zinc-200">{vm.currentCPS}</span>
                <span className="text-zinc-500">/{vm.maxCPS}</span>
              </span>
            )}
            {vm.earlyDialogs !== undefined && vm.earlyDialogs > 0 && (
              <span className="text-zinc-400">
                Ringing: <span className="text-zinc-200">{vm.earlyDialogs}</span>
              </span>
            )}
            {vm.maxSessions > 0 && vm.usagePercent > 0 && (
              <span className={`font-medium ${getStatusColor(vm.status)}`}>
                {vm.usagePercent}%
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <XCircle size={12} /> {vm.error || 'Error'}
          </span>
        )}
      </button>

      {vm.status !== 'error' && vm.maxSessions > 0 && (
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
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-zinc-500">Active Calls</span>
                  <p className="text-zinc-200 font-medium">{vm.activeCalls.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-zinc-500">Total Sessions</span>
                  <p className="text-zinc-200 font-medium">{vm.totalSessions.toLocaleString()}</p>
                </div>
                {vm.earlyDialogs !== undefined && vm.earlyDialogs > 0 && (
                  <div>
                    <span className="text-zinc-500">Ringing Calls</span>
                    <p className="text-zinc-200 font-medium">{vm.earlyDialogs.toLocaleString()}</p>
                  </div>
                )}
                {vm.expiredDialogs !== undefined && vm.expiredDialogs > 0 && (
                  <div>
                    <span className="text-zinc-500">Expired Dialogs</span>
                    <p className="text-zinc-200 font-medium">{vm.expiredDialogs.toLocaleString()}</p>
                  </div>
                )}
                {vm.failedDialogs !== undefined && vm.failedDialogs > 0 && (
                  <div>
                    <span className="text-zinc-500">Failed Dialogs</span>
                    <p className="text-zinc-200 font-medium">{vm.failedDialogs.toLocaleString()}</p>
                  </div>
                )}
                {vm.peakCalls > 0 && (
                  <div>
                    <span className="text-zinc-500">Peak Calls</span>
                    <p className="text-zinc-200 font-medium">{vm.peakCalls.toLocaleString()}</p>
                  </div>
                )}
                {(vm.currentCPS > 0 || vm.maxCPS > 0) && (
                  <div>
                    <span className="text-zinc-500">Current CPS</span>
                    <p className="text-zinc-200 font-medium">{vm.currentCPS} / {vm.maxCPS}</p>
                  </div>
                )}
                {vm.maxSessions > 0 && (
                  <div>
                    <span className="text-zinc-500">Max Sessions</span>
                    <p className="text-zinc-200 font-medium">{vm.maxSessions.toLocaleString()}</p>
                  </div>
                )}
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
            </>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-500 text-xs font-medium flex items-center gap-1">
                <Tag size={12} /> Tags
              </span>
              {canTag && (
                <button
                  onClick={onOpenTagModal}
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
                        onClick={() => onRemoveTag(index)}
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
}
