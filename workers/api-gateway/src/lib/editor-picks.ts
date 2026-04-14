import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

export type EditorPickStatRow = {
  post_slug: string;
  year: string;
  total_views: number;
  views_7d: number;
  views_30d: number;
};

export type RankedEditorPick = EditorPickStatRow & {
  score: number;
  rank: number;
  reason: string;
};

function calculateReason(stat: EditorPickStatRow): string {
  if (stat.views_7d > stat.views_30d * 0.5) {
    return 'Trending this week';
  }
  if (stat.total_views > 100) {
    return 'Evergreen favorite';
  }
  return 'Popular post';
}

export function selectTopEditorPicks(stats: EditorPickStatRow[], limit = 3): RankedEditorPick[] {
  return stats
    .filter((stat) => stat.total_views > 0)
    .map((stat) => ({
      ...stat,
      score: stat.views_7d * 0.5 + stat.views_30d * 0.3 + stat.total_views * 0.2,
      reason: calculateReason(stat),
      rank: 0,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((stat, index) => ({
      ...stat,
      rank: index + 1,
    }));
}

export function getNextEditorPickExpiry(now = new Date()): string {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 1);
  expiresAt.setHours(6, 0, 0, 0);
  return expiresAt.toISOString();
}

function buildDeactivateStatement(
  db: D1Database,
  picks: RankedEditorPick[]
): D1PreparedStatement {
  if (picks.length === 0) {
    return db.prepare(
      `UPDATE editor_picks
       SET is_active = 0, updated_at = datetime('now')
       WHERE is_active = 1`
    );
  }

  const predicates = picks.map(() => '(post_slug = ? AND year = ?)').join(' OR ');
  const params = picks.flatMap((pick) => [pick.post_slug, pick.year]);

  return db
    .prepare(
      `UPDATE editor_picks
       SET is_active = 0, updated_at = datetime('now')
       WHERE is_active = 1
         AND NOT (${predicates})`
    )
    .bind(...params);
}

export async function replaceActiveEditorPicks(
  db: D1Database,
  picks: RankedEditorPick[],
  expiresAt: string = getNextEditorPickExpiry()
): Promise<void> {
  if (picks.length === 0) {
    return;
  }

  const statements: D1PreparedStatement[] = picks.map((pick) =>
    db
      .prepare(
        `INSERT INTO editor_picks (post_slug, year, title, rank, score, reason, expires_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(post_slug, year)
         DO UPDATE SET
           rank = ?,
           score = ?,
           reason = ?,
           expires_at = ?,
           is_active = 1,
           picked_at = datetime('now'),
           updated_at = datetime('now')`
      )
      .bind(
        pick.post_slug,
        pick.year,
        '',
        pick.rank,
        pick.score,
        pick.reason,
        expiresAt,
        pick.rank,
        pick.score,
        pick.reason,
        expiresAt
      )
  );

  statements.push(buildDeactivateStatement(db, picks));
  await db.batch(statements);
}
