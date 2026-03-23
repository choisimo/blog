import type { AuthTokenProvider } from '@/services/core/auth-token.port';
import { getStoredSessionToken } from '@/services/session/fingerprint';

export const storedSessionTokenProvider: AuthTokenProvider = {
  async getAccessToken() {
    return getStoredSessionToken();
  },
};
