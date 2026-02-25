import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isPinVerified: boolean;
  isAdmin: boolean;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
}

const API_URL = import.meta.env.VITE_API_URL || '';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,
  isPinVerified: false,
  isAdmin: false,

  checkAuth: async () => {
    try {
      set({ isLoading: true, error: null });
      const res = await fetch(`${API_URL}/api/auth/me`, {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        set({
          user: data.user,
          isAdmin: data.user?.role === 'admin',
          isLoading: false,
        });
      } else if (res.status === 401 || res.status === 403) {
        set({ user: null, isAdmin: false, isLoading: false });
      } else {
        set({ error: `Server error: ${res.status}`, isLoading: false });
      }
    } catch (error) {
      console.error('Auth check failed', error);
      set({ error: 'Connection failed', isLoading: false });
    }
  },

  logout: async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      set({ user: null, isPinVerified: false, isAdmin: false });
    } catch (error) {
      console.error('Logout failed', error);
    }
  },

  verifyPin: async (pin: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin }),
      });
      
      const data = await res.json();
      if (data.success) {
        set({ isPinVerified: true });
        return true;
      }
      return false;
    } catch (error) {
      console.error('PIN verification failed', error);
      return false;
    }
  }
}));
