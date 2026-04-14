declare module '../../../../shared/src/contracts/service-boundaries.js' {
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

  export const ROUTE_OWNERS: Record<string, string>;
  export const ROUTE_BOUNDARIES: readonly RouteBoundary[];

  export function buildRouteBoundaryHeaders(
    input: string | { id?: string; pathname?: string; path?: string; method?: string },
    options?: {
      responder?: string;
      edgeMode?: string;
      originMode?: string;
    }
  ): Record<string, string>;

  export function matchServiceBoundary(
    input: string | { pathname?: string }
  ): ServiceBoundary | null;

  export function matchRouteBoundary(
    input: string | { pathname?: string; method?: string }
  ): RouteBoundary | null;
}

declare module '../../../../shared/src/contracts/data-ownership.js' {
  export function buildDataOwnershipHeaders(ownershipId: string): Record<string, string>;
}
