export class AnonymousSessionError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  constructor(code: string, status: number, message: string, retryable?: boolean);
}
export interface AnonymousSessionOptions {
  apiBase: string;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  fetcher?: typeof fetch;
  locks?: Pick<LockManager, 'request'>;
  forceRefresh?: boolean;
  signal?: AbortSignal;
  isCurrent?: () => boolean;
}
export function getAnonymousSession(options: AnonymousSessionOptions): Promise<string>;
export function startNewAnonymousSession(options: AnonymousSessionOptions & {
  confirmed: true;
  expectedToken: string | null;
}): Promise<string>;
