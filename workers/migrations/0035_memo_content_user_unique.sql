-- Enforce the memo invariant that each user has at most one current memo row.
-- Duplicate rows, if present from older code paths, are archived before cleanup.

CREATE TABLE IF NOT EXISTS memo_content_duplicate_archive_0035 AS
SELECT * FROM memo_content WHERE 0;

INSERT INTO memo_content_duplicate_archive_0035
SELECT *
FROM memo_content
WHERE rowid IN (
  WITH ranked AS (
    SELECT
      rowid AS source_rowid,
      ROW_NUMBER() OVER (
        PARTITION BY user_id
        ORDER BY datetime(updated_at) DESC, rowid DESC
      ) AS rn
    FROM memo_content
  )
  SELECT source_rowid FROM ranked WHERE rn > 1
);

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY user_id
      ORDER BY datetime(updated_at) DESC, rowid DESC
    ) AS keep_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY datetime(updated_at) DESC, rowid DESC
    ) AS rn
  FROM memo_content
)
UPDATE memo_versions
SET memo_id = (
  SELECT keep_id FROM ranked WHERE ranked.id = memo_versions.memo_id
)
WHERE memo_id IN (SELECT id FROM ranked WHERE rn > 1);

DELETE FROM memo_content
WHERE rowid IN (
  WITH ranked AS (
    SELECT
      rowid AS source_rowid,
      ROW_NUMBER() OVER (
        PARTITION BY user_id
        ORDER BY datetime(updated_at) DESC, rowid DESC
      ) AS rn
    FROM memo_content
  )
  SELECT source_rowid FROM ranked WHERE rn > 1
);

DROP INDEX IF EXISTS idx_memo_content_user_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_memo_content_user_id_unique ON memo_content(user_id);
