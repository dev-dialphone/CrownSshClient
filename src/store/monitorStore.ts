import { create } from 'zustand';
import { MonitoringMetrics, EnvironmentSummary, MonitoringResult } from '../types';

export type SortField = 'vmName' | 'vmIp' | 'activeCalls' | 'maxSessions' | 'peakCalls' | 'currentCPS' | 'maxCPS' | 'totalSessions' | 'usagePercent';
export type SortDirection = 'asc' | 'desc';

interface MonitorState {
  selectedEnvId: string | null;
  environmentName: string | null;
  configured: boolean;
  message: string | null;
  summary: EnvironmentSummary | null;
  vmMetrics: Record<string, MonitoringMetrics> | null;
  isLoading: boolean;
  autoRefresh: boolean;
  lastUpdated: Date | null;
  expandedVmIds: string[];
  sortField: SortField;
  sortDirection: SortDirection;

  selectEnvironment: (envId: string) => void;
  fetchMetrics: () => Promise<void>;
  toggleAutoRefresh: () => void;
  toggleVmExpand: (vmId: string) => void;
  clearSelection: () => void;
  setSort: (field: SortField, direction: SortDirection) => void;
  getSortedVmMetrics: () => MonitoringMetrics[];
}

const API_URL = import.meta.env.VITE_API_URL || '';

export const useMonitorStore = create<MonitorState>((set, get) => ({
  selectedEnvId: null,
  environmentName: null,
  configured: false,
  message: null,
  summary: null,
  vmMetrics: null,
  isLoading: false,
  autoRefresh: true,
  lastUpdated: null,
  expandedVmIds: [],
  sortField: 'activeCalls',
  sortDirection: 'desc',

  selectEnvironment: (envId: string) => {
    set({ selectedEnvId: envId, vmMetrics: null, summary: null });
    get().fetchMetrics();
  },

  fetchMetrics: async () => {
    const { selectedEnvId } = get();
    if (!selectedEnvId) return;

    set({ isLoading: true });

    try {
      const res = await fetch(`${API_URL}/api/monitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ environmentId: selectedEnvId }),
      });

      if (!res.ok) {
        const err = await res.json();
        set({
          message: err.error || 'Failed to fetch metrics',
          isLoading: false,
        });
        return;
      }

      const data: MonitoringResult = await res.json();

      set({
        configured: data.configured,
        message: data.message || null,
        environmentName: data.environmentName || null,
        summary: data.summary,
        vmMetrics: data.vms,
        lastUpdated: new Date(data.lastUpdated),
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch monitoring metrics', error);
      set({
        message: 'Failed to connect to server',
        isLoading: false,
      });
    }
  },

  toggleAutoRefresh: () => {
    set(state => ({ autoRefresh: !state.autoRefresh }));
  },

  toggleVmExpand: (vmId: string) => {
    set(state => {
      if (state.expandedVmIds.includes(vmId)) {
        return { expandedVmIds: state.expandedVmIds.filter(id => id !== vmId) };
      }
      return { expandedVmIds: [...state.expandedVmIds, vmId] };
    });
  },

  clearSelection: () => {
    set({
      selectedEnvId: null,
      environmentName: null,
      configured: false,
      message: null,
      summary: null,
      vmMetrics: null,
      lastUpdated: null,
      expandedVmIds: [],
    });
  },

  setSort: (field: SortField, direction: SortDirection) => {
    set({ sortField: field, sortDirection: direction });
  },

  getSortedVmMetrics: () => {
    const { vmMetrics, sortField, sortDirection } = get();
    if (!vmMetrics) return [];

    const metrics = Object.values(vmMetrics);

    return metrics.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.toLowerCase().localeCompare(bVal.toLowerCase()) 
          : bVal.toLowerCase().localeCompare(aVal.toLowerCase());
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  },
}));
