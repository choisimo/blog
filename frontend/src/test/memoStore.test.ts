import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeMemoNote,
  useMemoStore,
} from '@/stores/personal/useMemoStore';
import type { MemoNote } from '@/services/personal/userContent';

vi.mock('@/hooks/ui/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/services/personal/userContent', () => ({
  UserContentService: {
    createMemo: vi.fn(),
    deleteMemo: vi.fn(),
    listMemos: vi.fn(),
    updateMemo: vi.fn(),
  },
}));

function makeMemo(overrides: Partial<MemoNote> = {}): MemoNote {
  return {
    id: 'memo-1',
    originalContent: 'Original content',
    userNote: 'User note',
    tags: ['tag'],
    source: {},
    createdAt: '2026-07-03T00:00:00.000Z',
    updatedAt: '2026-07-03T00:00:00.000Z',
    etag: null,
    ...overrides,
  } as MemoNote;
}

describe('memo store boundaries', () => {
  beforeEach(() => {
    useMemoStore.getState().replaceAll([]);
  });

  afterEach(() => {
    useMemoStore.getState().replaceAll([]);
  });

  it('normalizes memo payloads before store persistence', () => {
    expect(
      normalizeMemoNote(
        makeMemo({
          id: ' memo-1 ',
          originalContent: ' Original\r\ncontent ',
          userNote: ' Note ',
          tags: [' tag ', 'tag', '', 'bad%0atag'],
        })
      )
    ).toMatchObject({
      id: 'memo-1',
      originalContent: 'Original\ncontent',
      userNote: 'Note',
      tags: ['tag'],
      createdAt: '2026-07-03T00:00:00.000Z',
      updatedAt: '2026-07-03T00:00:00.000Z',
    });
  });

  it('drops malformed and duplicate memos through replaceAll', () => {
    useMemoStore.getState().replaceAll([
      makeMemo({ id: 'memo-1', originalContent: 'First' }),
      makeMemo({ id: 'memo-1', originalContent: 'Second' }),
      makeMemo({ id: 'bad%0aid', originalContent: 'Bad id' }),
      makeMemo({ id: 'blank-content', originalContent: '   ' }),
    ]);

    expect(useMemoStore.getState().memos).toHaveLength(1);
    expect(useMemoStore.getState().memos[0]).toMatchObject({
      id: 'memo-1',
      originalContent: 'Second',
    });
  });
});
