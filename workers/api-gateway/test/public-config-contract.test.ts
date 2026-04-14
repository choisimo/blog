import { buildPublicRuntimeConfig } from '@blog/shared/contracts/public-runtime-config';
import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv
    extends Pick<
      Env,
      | 'ENV'
      | 'PUBLIC_SITE_URL'
      | 'API_BASE_URL'
      | 'FEATURE_AI_ENABLED'
      | 'FEATURE_RAG_ENABLED'
      | 'FEATURE_TERMINAL_ENABLED'
      | 'FEATURE_AI_INLINE'
      | 'FEATURE_COMMENTS_ENABLED'
      | 'CHAT_WS_ENABLED'
      | 'TERMINAL_GATEWAY_URL'
      | 'AI_DEFAULT_MODEL'
      | 'AI_VISION_MODEL'
    > {}
}

describe('public runtime config contract', () => {
  it('serves the shared public runtime config shape from the worker', async () => {
    const response = await SELF.fetch('https://example.com/api/v1/public/config');
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      ok: boolean;
      data: ReturnType<typeof buildPublicRuntimeConfig>;
    };

    expect(payload.ok).toBe(true);
    expect(payload.data).toEqual(
      buildPublicRuntimeConfig({
        env: env.ENV,
        siteBaseUrl: env.PUBLIC_SITE_URL,
        apiBaseUrl: env.API_BASE_URL || payload.data.apiBaseUrl,
        chatBaseUrl: env.API_BASE_URL || payload.data.chatBaseUrl,
        supportsChatWebSocket: false,
        terminalGatewayUrl: env.TERMINAL_GATEWAY_URL,
        ai: {
          modelSelectionEnabled: false,
          defaultModel: env.AI_DEFAULT_MODEL ?? null,
          visionModel: env.AI_VISION_MODEL ?? null,
        },
        features: {
          aiEnabled: env.FEATURE_AI_ENABLED === 'true',
          ragEnabled: env.FEATURE_RAG_ENABLED === 'true',
          terminalEnabled: env.FEATURE_TERMINAL_ENABLED === 'true',
          aiInline: env.FEATURE_AI_INLINE === 'true',
          commentsEnabled: env.FEATURE_COMMENTS_ENABLED === 'true',
        },
      })
    );
  });
});
