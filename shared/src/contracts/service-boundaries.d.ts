export const ROUTE_OWNERS: Readonly<{
  BACKEND: string;
  WORKER: string;
  PROXY_ONLY: string;
  COMPATIBILITY: string;
}>;

export type ServiceBoundary = {
  id: string;
  prefix: string;
  owner: string;
  description: string;
};

export const SERVICE_BOUNDARIES: readonly ServiceBoundary[];

export function matchServiceBoundary(
  input: string | { pathname?: string }
): ServiceBoundary | null;

export function getBoundaryById(id: string): ServiceBoundary | null;

export function buildRouteBoundaryHeaders(
  input: string | { id?: string; pathname?: string },
  options?: {
    responder?: string;
    edgeMode?: string;
    originMode?: string;
  }
): Record<string, string>;

export function isWorkerOwnedPath(pathname: string): boolean;
export function isBackendOwnedPath(pathname: string): boolean;
export function isProxyOnlyPath(pathname: string): boolean;
