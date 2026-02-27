import { create } from 'zustand';
import { VM, VMGroup, ExecutionLog, ExecutionStatus } from '../types';

interface CacheEntry {
  data: VMGroup[];
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000;
const groupedCache: CacheEntry = { data: [], timestamp: 0 };

interface VMState {
  vmGroups: VMGroup[];
  selectedVmIds: string[];
  activeTerminalVmId: string | null;
  expandedEnvIds: string[];
  logs: ExecutionLog[];
  statuses: Record<string, 'pending' | 'running' | 'success' | 'error'>;
  isLoading: boolean;

  setVMGroups: (groups: VMGroup[]) => void;
  toggleVMSelection: (id: string) => void;
  selectAllVMs: () => void;
  selectAllVMsInEnv: (envId: string) => void;
  deselectAllVMs: () => void;
  deselectAllVMsInEnv: (envId: string) => void;
  toggleEnvExpand: (envId: string) => void;
  expandAllEnvs: () => void;
  collapseAllEnvs: () => void;
  addLog: (log: ExecutionLog) => void;
  updateStatus: (status: ExecutionStatus) => void;
  clearLogs: () => void;
  setActiveTerminalVmId: (id: string | null) => void;

  fetchVMGroups: (forceRefresh?: boolean) => Promise<void>;
  addVM: (vm: Omit<VM, 'id'>) => Promise<void>;
  updateVM: (id: string, vm: Partial<VM>) => Promise<void>;
  deleteVM: (id: string) => Promise<void>;
}

const API_URL = import.meta.env.VITE_API_URL || '';

export const useVMStore = create<VMState>((set, get) => ({
  vmGroups: [],
  selectedVmIds: [],
  activeTerminalVmId: null,
  expandedEnvIds: [],
  logs: [],
  statuses: {},
  isLoading: false,

  setVMGroups: (groups) => set({ vmGroups: groups }),

  toggleVMSelection: (id) => set((state) => {
    const newSelected = state.selectedVmIds.includes(id)
      ? state.selectedVmIds.filter((vmId) => vmId !== id)
      : [...state.selectedVmIds, id];

    let newActive = state.activeTerminalVmId;
    if (newSelected.length === 0) {
      newActive = null;
    } else if (!newSelected.includes(id) && state.activeTerminalVmId === id) {
      newActive = newSelected[0];
    } else if (newSelected.length === 1 && !state.activeTerminalVmId) {
      newActive = id;
    }

    return {
      selectedVmIds: newSelected,
      activeTerminalVmId: newActive
    };
  }),

  selectAllVMs: () => set((state) => {
    const allIds = state.vmGroups.flatMap(g => g.vms.map(v => v.id));
    return {
      selectedVmIds: allIds,
      activeTerminalVmId: state.activeTerminalVmId || allIds[0] || null
    };
  }),

  selectAllVMsInEnv: (envId) => set((state) => {
    const group = state.vmGroups.find(g => g.environmentId === envId);
    if (!group) return state;
    const envVmIds = group.vms.map(v => v.id);
    const newSelected = [...new Set([...state.selectedVmIds, ...envVmIds])];
    return {
      selectedVmIds: newSelected,
      activeTerminalVmId: state.activeTerminalVmId || newSelected[0] || null
    };
  }),

  deselectAllVMs: () => set({ selectedVmIds: [], activeTerminalVmId: null }),

  deselectAllVMsInEnv: (envId) => set((state) => {
    const group = state.vmGroups.find(g => g.environmentId === envId);
    if (!group) return state;
    const envVmIds = new Set(group.vms.map(v => v.id));
    const newSelected = state.selectedVmIds.filter(id => !envVmIds.has(id));
    return { selectedVmIds: newSelected };
  }),

  toggleEnvExpand: (envId) => set((state) => {
    const isExpanded = state.expandedEnvIds.includes(envId);
    return {
      expandedEnvIds: isExpanded
        ? state.expandedEnvIds.filter(id => id !== envId)
        : [...state.expandedEnvIds, envId]
    };
  }),

  expandAllEnvs: () => set((state) => ({
    expandedEnvIds: state.vmGroups.map(g => g.environmentId)
  })),

  collapseAllEnvs: () => set({ expandedEnvIds: [] }),

  addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),

  updateStatus: ({ vmId, status }) => set((state) => ({
    statuses: { ...state.statuses, [vmId]: status }
  })),

  clearLogs: () => set({ logs: [], statuses: {} }),

  setActiveTerminalVmId: (id) => set({ activeTerminalVmId: id }),

  fetchVMGroups: async (forceRefresh = false) => {
    if (!forceRefresh && groupedCache.data.length > 0 && Date.now() - groupedCache.timestamp < CACHE_TTL) {
      const cached = groupedCache.data;
      set({
        vmGroups: cached,
        expandedEnvIds: cached.map(g => g.environmentId),
        isLoading: false
      });
      return;
    }

    set({ isLoading: true });

    try {
      const res = await fetch(`${API_URL}/api/vms?grouped=true`, { credentials: 'include' });
      const groups: VMGroup[] = await res.json();

      groupedCache.data = groups;
      groupedCache.timestamp = Date.now();

      set({
        vmGroups: groups,
        expandedEnvIds: groups.map(g => g.environmentId),
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to fetch VM groups', error);
      set({ isLoading: false });
    }
  },

  addVM: async (vm) => {
    try {
      const res = await fetch(`${API_URL}/api/vms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(vm),
      });
      const newVM = await res.json();

      set((state) => {
        const groups = [...state.vmGroups];
        const envId = newVM.environmentId || 'unknown';
        const groupIndex = groups.findIndex(g => g.environmentId === envId);

        if (groupIndex >= 0) {
          groups[groupIndex] = {
            ...groups[groupIndex],
            vms: [...groups[groupIndex].vms, newVM],
            vmCount: groups[groupIndex].vmCount + 1
          };
        } else {
          groups.push({
            environmentId: envId,
            environmentName: 'Unassigned',
            vms: [newVM],
            vmCount: 1
          });
        }

        groupedCache.data = groups;
        groupedCache.timestamp = Date.now();

        return { vmGroups: groups };
      });

      window.dispatchEvent(new Event('vm-added'));
    } catch (error) {
      console.error('Failed to add VM', error);
    }
  },

  updateVM: async (id, vmData) => {
    const previousGroups = get().vmGroups;

    set((state) => ({
      vmGroups: state.vmGroups.map(group => ({
        ...group,
        vms: group.vms.map(v => v.id === id ? { ...v, ...vmData } : v)
      }))
    }));

    try {
      const res = await fetch(`${API_URL}/api/vms/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(vmData),
      });

      if (!res.ok) throw new Error('Failed to update');

      const updatedVM = await res.json();

      set((state) => {
        const groups = state.vmGroups.map(group => ({
          ...group,
          vms: group.vms.map(v => v.id === id ? updatedVM : v)
        }));
        groupedCache.data = groups;
        groupedCache.timestamp = Date.now();
        return { vmGroups: groups };
      });
    } catch (error) {
      console.error('Failed to update VM', error);
      set({ vmGroups: previousGroups });
    }
  },

  deleteVM: async (id) => {
    const previousGroups = get().vmGroups;

    set((state) => ({
      vmGroups: state.vmGroups.map(group => ({
        ...group,
        vms: group.vms.filter(v => v.id !== id),
        vmCount: Math.max(0, group.vmCount - 1)
      })).filter(group => group.vmCount > 0 || group.environmentId !== 'unknown'),
      selectedVmIds: state.selectedVmIds.filter(vmId => vmId !== id)
    }));

    try {
      const res = await fetch(`${API_URL}/api/vms/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete');

      groupedCache.data = get().vmGroups;
      groupedCache.timestamp = Date.now();

      window.dispatchEvent(new Event('vm-deleted'));
    } catch (error) {
      console.error('Failed to delete VM', error);
      set({ vmGroups: previousGroups });
    }
  },
}));
