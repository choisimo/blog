# Data Ownership

## analytics.post_stats

- Owner service: backend
- Canonical store: PostgreSQL
- Cache/materialized edge store: D1 `post_views`

## analytics.editor_picks

- Owner service: backend
- Canonical ranking inputs: PostgreSQL
- Edge cache/materialized read model: D1 `editor_picks`

## Response headers

Analytics responses include:

- `X-Data-Ownership-Id`
- `X-Data-Owner`
- `X-Data-Canonical-Store`
- `X-Data-Cache-Store`
