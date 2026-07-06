import type { AuthTokenProvider } from '@/services/core/auth-token.port';
import { useAuthStore } from '@/stores/session/useAuthStore';

const MAX_ACCESS_TOKEN_LENGTH = 4096;

function normalizeAccessToken(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const token = value.trim();
  if (!token || token.length > MAX_ACCESS_TOKEN_LENGTH || /\s/.test(token)) {
    return null;
  }

  return token;
}

export const adminAccessTokenProvider: AuthTokenProvider = {
  async getAccessToken() {
    try {
      const token = await useAuthStore.getState().getValidAccessToken();
      return normalizeAccessToken(token);
    } catch {
      return null;
    }
  },
};
