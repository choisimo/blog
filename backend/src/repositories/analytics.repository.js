import { pgQuery, pgQueryOne, pgExecute, pgTransaction, isPgConfigured, testPgConnection } from './base/pg.repository.js';

export { isPgConfigured, testPgConnection };

export async function runMigrations() {
  await pgExecute(`
    CREATE TABLE IF NOT EXISTS post_visits (
      id BIGSERIAL PRIMARY KEY,
      post_slug TEXT NOT NULL,
      year TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      referer TEXT,
      country TEXT,
      city TEXT,
      path TEXT,
      session_id TEXT,
      visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pgExecute(`CREATE INDEX IF NOT EXISTS idx_post_visits_slug_year ON post_visits (post_slug, year)`);
  await pgExecute(`CREATE INDEX IF NOT EXISTS idx_post_visits_visited_at ON post_visits (visited_at DESC)`);
  await pgExecute(`ALTER TABLE post_visits ADD COLUMN IF NOT EXISTS event_id TEXT`);
  await pgExecute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_post_visits_event_id
      ON post_visits (event_id)
      WHERE event_id IS NOT NULL
  `);

  await pgExecute(`
    CREATE TABLE IF NOT EXISTS server_logs (
      id BIGSERIAL PRIMARY KEY,
      level TEXT NOT NULL,
      service TEXT,
      message TEXT NOT NULL,
      context JSONB,
      logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pgExecute(`CREATE INDEX IF NOT EXISTS idx_server_logs_logged_at ON server_logs (logged_at DESC)`);
  await pgExecute(`CREATE INDEX IF NOT EXISTS idx_server_logs_level ON server_logs (level)`);
  await pgExecute(`CREATE INDEX IF NOT EXISTS idx_server_logs_service ON server_logs (service)`);

  await pgExecute(`
    CREATE TABLE IF NOT EXISTS post_stats_pg (
      post_slug TEXT NOT NULL,
      year TEXT NOT NULL,
      total_views BIGINT NOT NULL DEFAULT 0,
      views_7d INT NOT NULL DEFAULT 0,
      views_30d INT NOT NULL DEFAULT 0,
      last_viewed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_slug, year)
    )
  `);
}

export async function recordVisit({ slug, year, ip, userAgent, referer, path, sessionId, eventId }) {
  let inserted = false;
  await pgTransaction(async (client) => {
    const visit = await client.query(
      `INSERT INTO post_visits (
         post_slug, year, ip_address, user_agent, referer, path, session_id, event_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [slug, year, ip || null, userAgent || null, referer || null, path || null, sessionId || null, eventId || null]
    );
    inserted = visit.rowCount === 1;
    if (!inserted) return;

    await client.query(
      `INSERT INTO post_stats_pg (post_slug, year, total_views, last_viewed_at, updated_at)
       VALUES ($1, $2, 1, NOW(), NOW())
       ON CONFLICT (post_slug, year)
       DO UPDATE SET
         total_views = post_stats_pg.total_views + 1,
         last_viewed_at = NOW(),
         updated_at = NOW()`,
      [slug, year]
    );
  });
  return { recorded: inserted, deduped: !inserted };
}

export async function getPostStats(slug, year) {
  return pgQueryOne(
    `SELECT * FROM post_stats_pg WHERE post_slug = $1 AND year = $2`,
    slug, year
  );
}

export async function getAllPostStats({ limit, offset = 0, orderBy = 'total_views' } = {}) {
  const allowed = ['total_views', 'views_7d', 'views_30d', 'last_viewed_at'];
  const col = allowed.includes(orderBy) ? orderBy : 'total_views';
  const args = [];
  let sql = `SELECT * FROM post_stats_pg ORDER BY ${col} DESC NULLS LAST`;
  if (limit) {
    args.push(limit, offset);
    sql += ` LIMIT $1 OFFSET $2`;
  }
  return pgQuery(sql, ...args);
}

export async function getTrendingPosts({ days = 7, limit = 10 } = {}) {
  return pgQuery(
    `SELECT
       pv.post_slug,
       pv.year,
       COUNT(*) AS recent_views,
       COALESCE(ps.total_views, 0) AS total_views
     FROM post_visits pv
     LEFT JOIN post_stats_pg ps ON pv.post_slug = ps.post_slug AND pv.year = ps.year
     WHERE pv.visited_at >= NOW() - ($1 || ' days')::INTERVAL
     GROUP BY pv.post_slug, pv.year, ps.total_views
     ORDER BY recent_views DESC
     LIMIT $2`,
    days, limit
  );
}

export async function getPostVisits({ slug, year, limit = 100, offset = 0 } = {}) {
  return pgQuery(
    `SELECT id, ip_address, user_agent, referer, path, session_id, visited_at
     FROM post_visits
     WHERE post_slug = $1 AND year = $2
     ORDER BY visited_at DESC
     LIMIT $3 OFFSET $4`,
    slug, year, limit, offset
  );
}

export async function getPostVisitCount(slug, year) {
  const row = await pgQueryOne(
    `SELECT COUNT(*) AS cnt FROM post_visits WHERE post_slug = $1 AND year = $2`,
    slug, year
  );
  return Number(row?.cnt ?? 0);
}

export async function getPostVisitHourlyBreakdown(slug, year) {
  return pgQuery(
    `SELECT
       DATE_TRUNC('hour', visited_at) AS hour,
       COUNT(*) AS visits
     FROM post_visits
     WHERE post_slug = $1 AND year = $2
       AND visited_at >= NOW() - INTERVAL '7 days'
     GROUP BY hour
     ORDER BY hour ASC`,
    slug, year
  );
}

export async function refreshPeriodicStats() {
  await pgExecute(`
    UPDATE post_stats_pg ps
    SET
      views_7d = (
        SELECT COUNT(*) FROM post_visits pv
        WHERE pv.post_slug = ps.post_slug AND pv.year = ps.year
          AND pv.visited_at >= NOW() - INTERVAL '7 days'
      ),
      views_30d = (
        SELECT COUNT(*) FROM post_visits pv
        WHERE pv.post_slug = ps.post_slug AND pv.year = ps.year
          AND pv.visited_at >= NOW() - INTERVAL '30 days'
      ),
      updated_at = NOW()
  `);
  const row = await pgQueryOne(`SELECT COUNT(*) AS cnt FROM post_stats_pg`);
  return Number(row?.cnt ?? 0);
}

export async function insertServerLog({ level, service, message, context }) {
  await pgExecute(
    `INSERT INTO server_logs (level, service, message, context) VALUES ($1, $2, $3, $4)`,
    level, service || null, message, context ? JSON.stringify(context) : null
  );
}

export async function getServerLogs({ level, service, limit = 200, offset = 0, since } = {}) {
  const conditions = [];
  const args = [];
  let idx = 1;

  if (level) { conditions.push(`level = $${idx++}`); args.push(level); }
  if (service) { conditions.push(`service = $${idx++}`); args.push(service); }
  if (since) { conditions.push(`logged_at >= $${idx++}`); args.push(since); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  args.push(limit, offset);

  return pgQuery(
    `SELECT id, level, service, message, context, logged_at
     FROM server_logs
     ${where}
     ORDER BY logged_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    ...args
  );
}
