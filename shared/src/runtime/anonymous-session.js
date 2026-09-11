// Canonical browser lifecycle used by React and the generated memo ES module.
// Local JWT decoding only checks continuity; authorization is always server-side.
const TOKEN_KEY = 'anon.token';
const LOCK_NAME = 'nodove:anonymous-session:v1';
const STATE_KEY = Symbol.for(LOCK_NAME);
const SUB_PATTERN = /^anon-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class AnonymousSessionError extends Error {
  constructor(code, status, message, retryable = false) {
    super(message);
    this.name = 'AnonymousSessionError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function state() {
  return globalThis[STATE_KEY] ??= { pending: new Map(), tail: Promise.resolve(), epoch: 0 };
}

function fail(code, status, message, retryable = false) {
  return new AnonymousSessionError(code, status, message, retryable);
}

function storageOf(options) {
  try {
    const storage = options.storage ?? globalThis.localStorage;
    if (!storage) throw new Error();
    return storage;
  } catch {
    throw fail('ANONYMOUS_STORAGE_UNAVAILABLE', 503, '브라우저 저장 공간에 접근할 수 없습니다.', true);
  }
}

function read(storage) {
  try { return storage.getItem(TOKEN_KEY); }
  catch { throw fail('ANONYMOUS_STORAGE_UNAVAILABLE', 503, '인증 정보를 읽지 못했습니다.', true); }
}

function claims(token) {
  if (typeof token !== 'string' || token.length > 8192 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const result = JSON.parse(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)));
    return result && SUB_PATTERN.test(result.sub) && result.role === 'anonymous' &&
      result.tokenClass === 'anonymous' && result.type === 'access' &&
      Number.isSafeInteger(result.exp) ? result : null;
  } catch { return null; }
}

function usable(token, bufferSeconds = 0) {
  const payload = claims(token);
  return Boolean(payload && Date.now() < (payload.exp - bufferSeconds) * 1000);
}

function announce(error) {
  if (['ANONYMOUS_RECOVERY_REQUIRED', 'ANONYMOUS_IDENTITY_MISMATCH'].includes(error?.code) &&
      typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    // Never put proof, subject IDs or private content on UI events.
    globalThis.dispatchEvent(new CustomEvent('reader:anonymous-auth-required', { detail: { code: error.code } }));
  }
  throw error;
}

async function serialized(options, run) {
  const shared = state();
  const execute = async () => {
    const locks = options.locks ?? globalThis.navigator?.locks;
    return locks?.request ? locks.request(LOCK_NAME, { mode: 'exclusive' }, run) : run();
  };
  const result = shared.tail.then(execute, execute);
  shared.tail = result.catch(() => {});
  return result;
}

async function request(options, existing) {
  const base = String(options.apiBase).replace(/\/$/, '');
  let response;
  try {
    response = await (options.fetcher ?? globalThis.fetch)(
      `${base}/api/v1/auth/anonymous${existing ? '/refresh' : ''}`, {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json',
          ...(existing ? { Authorization: `Bearer ${existing}` } : {}) },
        body: '{}', signal: options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      });
  } catch {
    if (options.signal?.aborted) throw fail('ANONYMOUS_ACTION_CANCELLED', 409, '인증 변경을 취소했습니다.');
    throw fail('ANONYMOUS_AUTH_UNAVAILABLE', 503, '인증 서버에 연결하지 못했습니다. 기존 메모는 유지됩니다.', true);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) {
    if (response.status === 401 || response.status === 403) {
      throw fail('ANONYMOUS_RECOVERY_REQUIRED', response.status, '기존 익명 자격을 확인할 수 없습니다.');
    }
    throw fail('ANONYMOUS_AUTH_UNAVAILABLE', response.status || 503,
      '인증을 갱신하지 못했습니다. 기존 메모는 유지됩니다.', response.status >= 500 || response.status === 429);
  }
  const data = payload.data;
  const next = claims(data?.token);
  const old = existing ? claims(existing) : null;
  if (!next || !usable(data.token) || data.userId !== next.sub || (existing && next.sub !== old?.sub)) {
    throw fail('ANONYMOUS_IDENTITY_MISMATCH', 409, '갱신 응답의 소유자가 일치하지 않아 반영하지 않았습니다.');
  }
  return data.token;
}

function commit(storage, expected, next, epoch) {
  if (state().epoch !== epoch || read(storage) !== expected) {
    throw fail('ANONYMOUS_SESSION_CHANGED', 409, '인증 상태가 변경되었습니다. 요청을 다시 확인하세요.');
  }
  try { storage.setItem(TOKEN_KEY, next); }
  catch { throw fail('ANONYMOUS_STORAGE_UNAVAILABLE', 503, '인증 정보를 저장하지 못했습니다.', true); }
  if (read(storage) !== next) {
    throw fail('ANONYMOUS_SESSION_CHANGED', 409, '다른 탭에서 인증 상태가 변경되었습니다.');
  }
  return next;
}

export async function getAnonymousSession(options) {
  const shared = state();
  const storage = storageOf(options);
  const initial = read(storage);
  const key = `${options.apiBase}:${options.forceRefresh === true ? 'refresh' : 'get'}`;
  if (shared.pending.has(key)) return shared.pending.get(key);
  const pending = serialized(options, async () => {
    const epoch = shared.epoch;
    const existing = read(storage);
    if (initial !== null && initial !== existing &&
        (!claims(initial) || claims(initial).sub !== claims(existing)?.sub)) {
      throw fail('ANONYMOUS_SESSION_CHANGED', 409, '대기 중 소유자가 바뀌어 이전 요청을 이어서 실행하지 않았습니다.');
    }
    if (existing !== null && !usable(existing)) {
      throw fail('ANONYMOUS_RECOVERY_REQUIRED', 401, '익명 자격이 만료되었거나 유효하지 않습니다.');
    }
    if (existing && !options.forceRefresh && usable(existing, 86400)) return existing;
    try {
      const next = await request(options, existing);
      return commit(storage, existing, next, epoch);
    } catch (error) {
      // A transient renewal failure may use a still-valid proof, never a new owner.
      // A rejected request's forced refresh must not replay the rejected proof.
      if (error.retryable && existing && !options.forceRefresh && usable(existing, 30) &&
          shared.epoch === epoch && read(storage) === existing) return existing;
      throw error;
    }
  }).catch(announce).finally(() => shared.pending.delete(key));
  shared.pending.set(key, pending);
  return pending;
}

/** Explicit user confirmation only. Does not delete, merge or upload old data. */
export async function startNewAnonymousSession(options) {
  if (options.confirmed !== true || !Object.hasOwn(options, 'expectedToken')) {
    throw fail('ANONYMOUS_CONFIRMATION_REQUIRED', 409, '새 익명 세션 시작을 확인해야 합니다.');
  }
  const storage = storageOf(options);
  return serialized(options, async () => {
    if (read(storage) !== options.expectedToken) {
      throw fail('ANONYMOUS_SESSION_CHANGED', 409, '인증 상태가 변경되었습니다. 창을 다시 여세요.');
    }
    const epoch = ++state().epoch;
    const token = await request(options, null);
    if (options.signal?.aborted || options.isCurrent?.() === false) {
      throw fail('ANONYMOUS_ACTION_CANCELLED', 409, '인증 상태가 바뀌어 변경하지 않았습니다.');
    }
    commit(storage, options.expectedToken, token, epoch);
    if (typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      globalThis.dispatchEvent(new CustomEvent('reader:anonymous-session-changed'));
    }
    return token;
  });
}
