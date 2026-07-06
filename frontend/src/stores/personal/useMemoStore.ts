import { create } from 'zustand';
import { produce } from 'immer';
import { toast } from '@/hooks/ui/use-toast';
import {
  CreateMemoInput,
  MemoNote,
  UpdateMemoInput,
  UserContentService,
} from '@/services/personal/userContent';

export type MemoStoreState = {
  memos: MemoNote[];
  isLoading: boolean;
  fetchMemos: () => Promise<void>;
  createMemo: (input: CreateMemoInput) => Promise<MemoNote | undefined>;
  updateMemo: (id: string, input: UpdateMemoInput) => Promise<MemoNote | undefined>;
  deleteMemo: (id: string) => Promise<boolean>;
  isMessageSaved: (messageId: string) => boolean;
  replaceAll: (memos: MemoNote[]) => void;
};

type OptimisticMemo = MemoNote & { __optimistic?: boolean };

const MAX_MEMO_TEXT_LENGTH = 20_000;
const MAX_MEMO_ID_LENGTH = 160;
const MAX_MEMO_TAG_LENGTH = 64;
const MAX_MEMO_TAGS = 20;

function normalizeMemoText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return null;
  return normalized.length > maxLength
    ? normalized.slice(0, maxLength).trim()
    : normalized;
}

function normalizeMemoId(value: unknown): string | null {
  const normalized = normalizeMemoText(value, MAX_MEMO_ID_LENGTH);
  if (!normalized || /[\r\n]/.test(normalized) || /%(?:0a|0d)/i.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeMemoTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags = new Set<string>();

  for (const item of value) {
    const tag = normalizeMemoText(item, MAX_MEMO_TAG_LENGTH);
    if (!tag || /[\r\n]/.test(tag) || /%(?:0a|0d)/i.test(tag)) continue;
    tags.add(tag);
    if (tags.size >= MAX_MEMO_TAGS) break;
  }

  return Array.from(tags);
}

function normalizeMemoDate(value: unknown): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

export function normalizeMemoNote(memo: unknown): MemoNote | null {
  if (!memo || typeof memo !== 'object') return null;
  const record = memo as Partial<MemoNote>;
  const id = normalizeMemoId(record.id);
  const originalContent = normalizeMemoText(
    record.originalContent,
    MAX_MEMO_TEXT_LENGTH
  );

  if (!id || !originalContent) return null;

  return {
    ...record,
    id,
    originalContent,
    userNote: normalizeMemoText(record.userNote, MAX_MEMO_TEXT_LENGTH) ?? '',
    tags: normalizeMemoTags(record.tags),
    createdAt: normalizeMemoDate(record.createdAt),
    updatedAt: normalizeMemoDate(record.updatedAt),
    etag: typeof record.etag === 'string' ? record.etag.trim() || null : null,
  } as MemoNote;
}

function normalizeMemoList(memos: unknown): MemoNote[] {
  if (!Array.isArray(memos)) return [];
  const byId = new Map<string, MemoNote>();

  for (const memo of memos) {
    const normalized = normalizeMemoNote(memo);
    if (normalized) byId.set(normalized.id, normalized);
  }

  return Array.from(byId.values());
}

export const useMemoStore = create<MemoStoreState>((set, get) => ({
  memos: [],
  isLoading: false,

  replaceAll: memos => set({ memos: normalizeMemoList(memos) }),

  fetchMemos: async () => {
    set({ isLoading: true });
    try {
      const { items } = await UserContentService.listMemos();
      set({ memos: normalizeMemoList(items), isLoading: false });
    } catch (error) {
      console.error('[useMemoStore] fetchMemos error', error);
      toast({ title: '메모 불러오기 실패', description: '네트워크 상태를 확인하고 다시 시도해주세요.' });
      set({ isLoading: false });
    }
  },

  createMemo: async input => {
    const tempId = `temp-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const optimistic: OptimisticMemo = {
      id: tempId,
      originalContent: input.originalContent,
      userNote: input.userNote ?? '',
      tags: input.tags ?? [],
      source: input.source,
      createdAt,
      updatedAt: createdAt,
      etag: null,
      __optimistic: true,
    };

    set(state => ({ memos: [optimistic, ...state.memos] }));
    toast({ title: '저장 중…', description: '메모를 저장하고 있어요.' });

    try {
      const memo = await UserContentService.createMemo(input);
      set(state =>
        produce(state, draft => {
          const target = draft.memos.find(m => m.id === tempId);
          if (!target) return;
          Object.assign(target, memo);
          delete (target as OptimisticMemo).__optimistic;
        })
      );
      toast({ title: '메모에 저장됨', description: 'AI 응답이 메모장에 추가되었어요.' });
      return memo;
    } catch (error) {
      console.error('[useMemoStore] createMemo error', error);
      set(state => ({ memos: state.memos.filter(m => m.id !== tempId) }));
      toast({ title: '메모 저장 실패', description: '잠시 후 다시 시도해주세요.' });
      return undefined;
    }
  },

  updateMemo: async (id, input) => {
    const original = get().memos;
    const target = original.find(m => m.id === id);
    if (!target) return undefined;

    const optimistic = produce(original, draft => {
      const memo = draft.find(m => m.id === id);
      if (!memo) return;
      memo.userNote = input.userNote ?? memo.userNote;
      memo.tags = input.tags ?? memo.tags;
      if (input.originalContent) memo.originalContent = input.originalContent;
      if (input.source) memo.source = input.source;
      memo.updatedAt = new Date().toISOString();
    });
    set({ memos: optimistic });

    try {
      const updated = await UserContentService.updateMemo(id, input, target.etag);
      set(state =>
        produce(state, draft => {
          const memo = draft.memos.find(m => m.id === id);
          if (!memo) return;
          Object.assign(memo, updated);
        })
      );
      toast({ title: '메모가 업데이트되었습니다.' });
      return updated;
    } catch (error: unknown) {
      console.error('[useMemoStore] updateMemo error', error);
      set({ memos: original });
      const status = (error instanceof Error && error.message.includes('412')) ? '동일한 메모가 이미 수정되었어요.' : '잠시 후 다시 시도해주세요.';
      toast({ title: '메모 수정 실패', description: status });
      return undefined;
    }
  },

  deleteMemo: async id => {
    const original = get().memos;
    const target = original.find(m => m.id === id);
    if (!target) return false;

    set({ memos: original.filter(m => m.id !== id) });
    try {
      await UserContentService.deleteMemo(id, target.etag);
      toast({ title: '메모가 삭제되었습니다.' });
      return true;
    } catch (error: unknown) {
      console.error('[useMemoStore] deleteMemo error', error);
      set({ memos: original });
      const message = (error instanceof Error && error.message.includes('412'))
        ? '다른 곳에서 수정된 메모예요. 새로고침 후 다시 시도해주세요.'
        : '메모 삭제에 실패했습니다. 다시 시도해주세요.';
      toast({ title: '삭제 실패', description: message });
      return false;
    }
  },

  isMessageSaved: messageId => {
    return get().memos.some(memo => memo.source?.messageId === messageId);
  },
}));
