import { create } from 'zustand';
import type { User } from './types';

type BootstrapStatus = 'idle' | 'loading' | 'ready';

interface AuthState {
  user: User | null;
  bootstrapStatus: BootstrapStatus;
  setUser: (user: User) => void;
  setBootstrapStatus: (status: BootstrapStatus) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  bootstrapStatus: 'idle',
  setUser: (user) => set({ user }),
  setBootstrapStatus: (bootstrapStatus) => set({ bootstrapStatus }),
  clearAuth: () => set({ user: null }),
}));

export const authBridge = {
  setUser: (user: User) => useAuthStore.getState().setUser(user),
  clearAuth: () => useAuthStore.getState().clearAuth(),
};
