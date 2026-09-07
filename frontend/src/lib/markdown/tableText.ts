export interface MarkdownTableCellLike {
  textContent: string | null;
}

export interface MarkdownTableRowLike {
  cells: ArrayLike<MarkdownTableCellLike>;
}

export interface MarkdownTableLike {
  rows: ArrayLike<MarkdownTableRowLike>;
}

export function normalizeMarkdownTableCellText(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function serializeMarkdownTableRows(
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
): string {
  return rows
    .filter((row) => row.length > 0)
    .map((row) => row.map(normalizeMarkdownTableCellText).join('\t'))
    .join('\n');
}

export function serializeRenderedMarkdownTable(
  table: MarkdownTableLike | null,
): string {
  if (!table) return '';
  const rows = Array.from(table.rows, (row) =>
    Array.from(row.cells, (cell) => cell.textContent ?? ''),
  );
  return serializeMarkdownTableRows(rows);
}
