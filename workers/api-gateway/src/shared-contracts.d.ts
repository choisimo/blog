declare module '../../../../shared/src/contracts/service-boundaries.js' {
  export const ROUTE_OWNERS: Record<string, string>;

  export function buildRouteBoundaryHeaders(
    input: string | { id?: string; pathname?: string },
    options?: {
      responder?: string;
      edgeMode?: string;
      originMode?: string;
    }
  ): Record<string, string>;

  export function matchServiceBoundary(
    input: string | { pathname?: string }
  ): { id: string; prefix: string; owner: string; description: string } | null;
}

declare module '../../../../shared/src/contracts/data-ownership.js' {
  export function buildDataOwnershipHeaders(ownershipId: string): Record<string, string>;
}
