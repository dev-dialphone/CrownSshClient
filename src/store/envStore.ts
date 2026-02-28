import { create } from 'zustand';
import { Environment } from '../types';

interface EnvState {
  environments: Environment[];
  selectedEnvId: string;
  isLoading: boolean;
  fetchEnvironments: () => Promise<void>;
  addEnvironment: (name: string) => Promise<void>;
  updateEnvironment: (id: string, data: Partial<Environment>) => Promise<void>;
  deleteEnvironment: (id: string, totpCode?: string) => Promise<{ success: boolean; error?: string }>;
  selectEnvironment: (id: string) => void;
  resetCommands: () => Promise<{ success: boolean; updatedCount?: number; error?: string }>;
}

const API_URL = import.meta.env.VITE_API_URL || '';

export const useEnvStore = create<EnvState>((set, get) => ({
  environments: [],
  selectedEnvId: 'env-dev', // Default
  isLoading: false,

  fetchEnvironments: async () => {
    // Only set loading on first load to prevent UI flicker on updates
    if (get().environments.length === 0) {
      set({ isLoading: true });
    }

    try {
      const res = await fetch(`${API_URL}/api/environments`, {
        credentials: 'include',
      });
      const data = await res.json();

      // Compare to avoid unnecessary re-renders
      const currentEnvs = get().environments;
      if (JSON.stringify(data) !== JSON.stringify(currentEnvs)) {
        set({ environments: data });
      }

      // Ensure selectedEnvId is valid
      const current = get().selectedEnvId;
      if (data.length > 0 && !data.find((e: Environment) => e.id === current)) {
        set({ selectedEnvId: data[0].id });
      }
    } catch (error) {
      console.error('Failed to fetch environments', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addEnvironment: async (name: string) => {
    try {
      const res = await fetch(`${API_URL}/api/environments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add environment');
      }
      const newEnv = await res.json();
      set((state) => ({ environments: [...state.environments, newEnv] }));
    } catch (error) {
      console.error('Failed to add environment', error);
    }
  },

  updateEnvironment: async (id, data) => {
    try {
      const res = await fetch(`${API_URL}/api/environments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update environment');
      }
      const updatedEnv = await res.json();
      set((state) => ({
        environments: state.environments.map((e) => (e.id === id ? updatedEnv : e)),
      }));
    } catch (error) {
      console.error('Failed to update environment', error);
    }
  },

  deleteEnvironment: async (id: string, totpCode?: string) => {
    try {
      const res = await fetch(`${API_URL}/api/environments/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ totpCode }),
      });

      if (!res.ok) {
        const err = await res.json();
        return { success: false, error: err.error || 'Failed to delete environment' };
      }

      set((state) => ({
        environments: state.environments.filter((e) => e.id !== id),
        selectedEnvId: state.selectedEnvId === id ? (state.environments[0]?.id || '') : state.selectedEnvId
      }));
      return { success: true };
    } catch (error) {
      console.error('Failed to delete environment', error);
      return { success: false, error: 'Network error' };
    }
  },

  selectEnvironment: (id: string) => {
    set({ selectedEnvId: id });
  },

  resetCommands: async () => {
    try {
      const res = await fetch(`${API_URL}/api/environments/reset-commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      
      if (!res.ok) {
        const err = await res.json();
        return { success: false, error: err.error || 'Failed to reset commands' };
      }
      
      const data = await res.json();
      set({ environments: data.environments });
      return { success: true, updatedCount: data.updatedCount };
    } catch (error) {
      console.error('Failed to reset commands', error);
      return { success: false, error: 'Network error' };
    }
  }
}));
