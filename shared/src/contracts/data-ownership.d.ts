export type DataOwnership = {
  id: string;
  ownerService: string;
  canonicalStore: string;
  cacheStore: string;
  readPath: string[];
  notes: string;
};

export const DATA_OWNERSHIP: readonly DataOwnership[];

export function getDataOwnership(id: string): DataOwnership | null;
export function buildDataOwnershipHeaders(id: string): Record<string, string>;
