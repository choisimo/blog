import type { Env } from '../types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_FAILOVER_KEY_PREFIX = 'gemini-failover:';

async function callFallbackGenerator(
  prompt: string,
  env: Env,
  temperature: number
): Promise<string> {
  const base = env.AI_SERVE_BASE_URL || 'https://ai-check.nodove.com';
  const url = `${base.replace(/\/$/, '')}/ai/generate`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (env.AI_SERVE_API_KEY) {
    headers['X-API-KEY'] = env.AI_SERVE_API_KEY;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, temperature }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Fallback AI error: ${res.status} ${txt}`);
  }

  const payload = (await res.json().catch(() => null)) as
    | { text?: string }
    | null;
  const text = payload?.text;
  if (!text) {
    throw new Error('Invalid fallback AI response');
  }
  return text;
}

async function markGeminiFailoverToday(env: Env): Promise<void> {
  try {
    const now = new Date();
    const keyDate = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1
    ).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    const key = `${GEMINI_FAILOVER_KEY_PREFIX}${keyDate}`;
    const tomorrowUtcMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    );
    const ttlSeconds = Math.max(
      60,
      Math.floor((tomorrowUtcMidnight.getTime() - now.getTime()) / 1000)
    );
    await env.KV.put(key, '1', { expirationTtl: ttlSeconds });
  } catch {
  }
}

async function isGeminiInFailover(env: Env): Promise<boolean> {
  try {
    const now = new Date();
    const keyDate = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1
    ).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    const key = `${GEMINI_FAILOVER_KEY_PREFIX}${keyDate}`;
    const v = await env.KV.get(key);
    return v === '1';
  } catch {
    return false;
  }
}

export async function generateContent(
  prompt: string,
  env: Env,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const temperature = options?.temperature ?? 0.2;
  const maxTokens = options?.maxTokens ?? 2048;

  if (!env.GEMINI_API_KEY || (await isGeminiInFailover(env))) {
    return callFallbackGenerator(prompt, env, temperature);
  }

  const model = 'gemini-2.5-flash';
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await markGeminiFailoverToday(env);
      throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }

    const data = await response.json<{
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    }>();

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      await markGeminiFailoverToday(env);
      throw new Error('No content in Gemini response');
    }

    return text;
  } catch (err) {
    await markGeminiFailoverToday(env);
    return callFallbackGenerator(prompt, env, temperature);
  }
}

export function tryParseJson(text: string): unknown {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch?.[1]) {
      return JSON.parse(jsonMatch[1]);
    }
    // Try direct parse
    return JSON.parse(text);
  } catch {
    return null;
  }
}
