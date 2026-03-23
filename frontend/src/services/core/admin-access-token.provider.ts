import type { AuthTokenProvider } from '@/services/core/auth-token.port';
import { useAuthStore } from '@/stores/session/useAuthStore';

export const adminAccessTokenProvider: AuthTokenProvider = {
  async getAccessToken() {
    return useAuthStore.getState().getValidAccessToken();
  },
};
