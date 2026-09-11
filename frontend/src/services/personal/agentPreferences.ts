import { useSyncExternalStore } from 'react';
import { normalizeAgentPreferences, type AgentPreferences } from '@blog/shared/contracts/agent-preferences';
import { useAuthStore } from '@/stores/session/useAuthStore';
import { parseJwtPayload } from '@/services/session/auth';
import { getPrincipalHeaders } from '@/services/session/userContentAuth';
import { getApiBaseUrl } from '@/utils/network/apiBase';
export { DEFAULT_AGENT_PREFERENCES, shouldAutoIllustrate } from '@blog/shared/contracts/agent-preferences';
export type { AgentPreferences } from '@blog/shared/contracts/agent-preferences';

export function scopeFromClaims(claims: Record<string, unknown> | null): string {
  return typeof claims?.sub === 'string' && ['user','member','admin'].includes(String(claims.role)) &&
    claims.emailVerified === true && claims.type !== 'refresh' ? `account:${claims.sub}` : 'guest';
}
export function preferenceScope(): string {
  const token = useAuthStore.getState().accessToken;
  const claims = token ? parseJwtPayload(token) : null;
  return scopeFromClaims(claims);
}
const listeners = new Set<() => void>();
let cachedKey = '', cachedRaw: string | null = null;
let cached = normalizeAgentPreferences(null);
export function getAgentPreferences(): AgentPreferences {
  const key = `reader.agent.v1:${preferenceScope()}`;
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { /* private mode */ }
  if (key !== cachedKey || raw !== cachedRaw) {
    cachedKey = key; cachedRaw = raw;
    try { cached = normalizeAgentPreferences(raw ? JSON.parse(raw) : null); }
    catch { cached = normalizeAgentPreferences(null); }
  }
  return cached;
}
function notify() { for (const listener of listeners) listener(); }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
useAuthStore.subscribe(notify);
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (!event.key || event.key.startsWith('reader.agent.v1:')) notify();
});
export function useAgentPreferences() { return useSyncExternalStore(subscribe, getAgentPreferences, getAgentPreferences); }
export function saveAgentPreferences(input: unknown, scope = preferenceScope()) {
  if (scope !== preferenceScope()) throw new Error('계정이 변경되었습니다. 설정을 다시 여세요.');
  const normalized = normalizeAgentPreferences(input);
  try { localStorage.setItem(`reader.agent.v1:${scope}`, JSON.stringify(normalized)); }
  catch { throw new Error('기기에 설정을 저장하지 못했습니다. 저장 공간과 브라우저 권한을 확인하세요.'); }
  notify(); return normalized;
}
export async function getScopedPrincipalHeaders(scope = preferenceScope(), init?: HeadersInit) {
  if (scope !== preferenceScope()) throw new Error('계정이 변경되었습니다. 다시 요청하세요.');
  const headers = await getPrincipalHeaders(init);
  const claims = parseJwtPayload((headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
  if (scope !== preferenceScope() || scopeFromClaims(claims) !== scope)
    throw new Error('계정이 변경되었습니다. 다시 로그인하거나 새 대화를 시작하세요.');
  return headers;
}
async function accountRequest(method: 'GET' | 'PUT', body?: unknown) {
  const scope = preferenceScope();
  const headers = await getScopedPrincipalHeaders(scope, { 'Content-Type': 'application/json' });
  const response = await fetch(`${getApiBaseUrl()}/api/v1/user/agent-preferences`, {
    method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000),
  });
  const payload = await response.json();
  if (scope !== preferenceScope()) throw new Error('계정이 변경되었습니다. 설정을 다시 여세요.');
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message || '계정 설정을 불러오지 못했습니다.');
  return { version: Number(payload.data.version), preferences: normalizeAgentPreferences(payload.data.preferences) };
}
export const loadAccountPreferences = () => accountRequest('GET');
export const saveAccountPreferences = (preferences: AgentPreferences, version: number) => accountRequest('PUT', { preferences, version });
export function openAgentPreferences() { window.dispatchEvent(new Event('reader:agent-settings')); }

export function startPreferenceBootstrap() {
  let disposed = false;
  const loading = new Set<string>();
  const refresh = () => {
    const scope = preferenceScope(), key = `reader.agent.v1:${scope}`;
    if (!scope.startsWith('account:') || loading.has(scope)) return;
    try { if (localStorage.getItem(key) !== null) return; } catch { return; }
    loading.add(scope);
    void loadAccountPreferences().then(result => {
      if (disposed || scope !== preferenceScope() || localStorage.getItem(key) !== null) return;
      saveAgentPreferences(result.preferences, scope);
    }).catch(() => { /* The settings dialog exposes a retry and an explicit local-only state. */ })
      .finally(() => loading.delete(scope));
  };
  refresh();
  const unsubscribe = useAuthStore.subscribe(refresh);
  return () => { disposed = true; unsubscribe(); };
}
