export const DATA_OWNERSHIP = Object.freeze([
  {
    id: 'analytics.post_stats',
    ownerService: 'backend',
    canonicalStore: 'postgres.post_visits + postgres.post_stats_pg',
    cacheStore: 'd1.post_views',
    readPath: ['/api/v1/analytics/view', '/api/v1/analytics/stats/:year/:slug', '/api/v1/analytics/trending'],
    notes: 'Write-heavy analytics and periodic rollups remain canonical in PostgreSQL.',
  },
  {
    id: 'analytics.editor_picks',
    ownerService: 'backend',
    canonicalStore: 'postgres.post_stats_pg',
    cacheStore: 'd1.editor_picks',
    readPath: ['/api/v1/analytics/editor-picks'],
    notes: 'Daily worker cron materializes top picks from PostgreSQL into D1 for edge reads.',
  },
]);

export function getDataOwnership(id) {
  return DATA_OWNERSHIP.find((item) => item.id === id) || null;
}

export function buildDataOwnershipHeaders(id) {
  const item = getDataOwnership(id);
  if (!item) return {};
  return {
    'X-Data-Ownership-Id': item.id,
    'X-Data-Owner': item.ownerService,
    'X-Data-Canonical-Store': item.canonicalStore,
    'X-Data-Cache-Store': item.cacheStore,
  };
}
