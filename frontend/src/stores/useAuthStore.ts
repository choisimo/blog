import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuthState = {
  token: string | null;
  setToken: (token: string | null) => void;
  clearToken: () => void;
};

const STORAGE_KEY = 'aiMemo.auth';

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      token: null,
      setToken: token => set({ token: token?.trim() || null }),
      clearToken: () => set({ token: null }),
    }),
    {
      name: STORAGE_KEY,
      partialize: state => ({ token: state.token }),
    }
  )
);

export function bootstrapAuthTokenFromLegacyStorage(): void {
  try {
    const legacyKeys = ['aiMemo.authToken', 'aiMemo.jwt', 'auth.token', 'aiMemoAuthToken'];
    for (const key of legacyKeys) {
      const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string' && parsed.trim()) {
          useAuthStore.getState().setToken(parsed.trim());
          return;
        }
      } catch {
        if (raw.trim()) {
          useAuthStore.getState().setToken(raw.trim());
          return;
        }
      }
    }
  } catch {
    // ignore storage access errors
  }
}
