import type {
  InsightWorkspaceItem,
  InsightWorkspaceItemKind,
} from './types';

const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;
const MAX_STORED_TEXT_LENGTH = 240;
const STACK_ITEM_KINDS = new Set<InsightWorkspaceItemKind>([
  'post',
  'chat',
  'memo',
  'thought',
]);

function normalizeStoredText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .replace(CONTROL_TEXT_PATTERN, ' ')
    .replace(COLLAPSED_WHITESPACE_PATTERN, ' ')
    .trim()
    .slice(0, MAX_STORED_TEXT_LENGTH);
  return normalized || fallback;
}

function normalizeStoredId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(CONTROL_TEXT_PATTERN, '')
    .replace(COLLAPSED_WHITESPACE_PATTERN, ' ')
    .trim()
    .slice(0, MAX_STORED_TEXT_LENGTH);
  return normalized || null;
}

function normalizeStackKind(value: unknown): InsightWorkspaceItemKind {
  const normalized = normalizeStoredText(value).toLowerCase();
  return STACK_ITEM_KINDS.has(normalized as InsightWorkspaceItemKind)
    ? (normalized as InsightWorkspaceItemKind)
    : 'post';
}

export function normalizeInsightWorkspaceItem(
  value: unknown,
): InsightWorkspaceItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<InsightWorkspaceItem>;
  const id = normalizeStoredId(item.id);
  const title = normalizeStoredText(item.title);
  const createdAt =
    typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
      ? item.createdAt
      : null;

  if (!id || !title || createdAt === null) return null;

  const nodeId = normalizeStoredId(item.nodeId) ?? id;
  const subtitle = normalizeStoredText(item.subtitle);
  const postKey = normalizeStoredId(item.postKey);

  return {
    ...item,
    id,
    nodeId,
    kind: normalizeStackKind(item.kind),
    title,
    subtitle,
    postKey: postKey ?? undefined,
    createdAt,
  } as InsightWorkspaceItem;
}

export function normalizePinnedStackIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeStoredId)
    .filter((id): id is string => Boolean(id))
    .slice(0, 100);
}
