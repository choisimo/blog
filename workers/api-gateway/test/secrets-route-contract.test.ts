import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { generateAccessToken } from '../src/lib/jwt';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<Env, 'DB' | 'JWT_SECRET'> {}
}

const staticGetRoutes = [
  { path: 'export', dataKeys: ['exportedAt', 'categories', 'secrets'] },
  { path: 'audit', dataKeys: ['logs', 'pagination'] },
  { path: 'health', dataKeys: ['status', 'encryption', 'stats'] },
  { path: 'overview', dataKeys: ['categories', 'stats', 'recentActivity'] },
];

describe('secrets route contract', () => {
  it.each(staticGetRoutes)(
    'dispatches GET /$path to its static handler before GET /:id',
    async ({ path, dataKeys }) => {
      const accessToken = await generateAccessToken(
        {
          sub: 'admin',
          role: 'admin',
          username: 'admin',
          email: 'admin@example.com',
          emailVerified: true,
        },
        env
      );

      const response = await SELF.fetch(`https://example.com/api/v1/admin/secrets/${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: Record<string, unknown>;
        error?: { message: string };
      };

      expect(response.status, JSON.stringify(payload)).toBe(200);
      expect(payload.ok).toBe(true);
      expect(payload.data).toBeDefined();
      for (const key of dataKeys) {
        expect(payload.data).toHaveProperty(key);
      }
    }
  );
});
