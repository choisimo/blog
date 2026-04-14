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

export type RouteBoundary = {
  id: string;
  method: string;
  path: string;
  owner: string;
  boundaryId: string;
  description: string;
};

export const SERVICE_BOUNDARIES: readonly ServiceBoundary[];
export const ROUTE_BOUNDARIES: readonly RouteBoundary[];

export function matchServiceBoundary(
  input: string | { pathname?: string }
): ServiceBoundary | null;

export function matchRouteBoundary(
  input: { pathname?: string; method?: string } | string
): RouteBoundary | null;

export function getBoundaryById(id: string): ServiceBoundary | null;
export function getRouteBoundaryById(id: string): RouteBoundary | null;

export function buildRouteBoundaryHeaders(
  input:
    | string
    | { id?: string; pathname?: string; path?: string; method?: string },
  options?: {
    responder?: string;
    edgeMode?: string;
    originMode?: string;
  }
): Record<string, string>;

export function isWorkerOwnedPath(pathname: string, method?: string): boolean;
export function isBackendOwnedPath(pathname: string, method?: string): boolean;
export function isProxyOnlyPath(pathname: string, method?: string): boolean;
