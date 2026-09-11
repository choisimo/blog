import { useEffect, useState } from 'react';

export type MemoContext = {
  title: string;
  content: string;
  truncated: boolean;
};
export const MEMO_CONTEXT_LIMIT = 6000;

function storedText(key: string): string {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '""');
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

export function readMemoContext(): MemoContext {
  // Read unsaved input directly; storage is deliberately debounced by the editor.
  const root = document.querySelector('ai-memo-pad')?.shadowRoot;
  const content =
    root?.querySelector<HTMLTextAreaElement>('#memo')?.value ??
    storedText('aiMemo.content');
  const title =
    root?.querySelector<HTMLInputElement>('#memoTitleInput')?.value ??
    storedText('aiMemo.title');
  return {
    title: title.trim().slice(0, 120) || '새 메모',
    content: content.slice(0, MEMO_CONTEXT_LIMIT),
    truncated: content.length > MEMO_CONTEXT_LIMIT,
  };
}

export function useMemoContext() {
  const [memo, setMemo] = useState(readMemoContext);
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    const refresh = () => setMemo(readMemoContext());
    const onStorage = (event: StorageEvent) => {
      if (!event.key || ['aiMemo.content', 'aiMemo.title'].includes(event.key))
        refresh();
    };
    window.addEventListener('aiMemo:contentChanged', refresh);
    window.addEventListener('storage', onStorage);
    refresh();
    return () => {
      window.removeEventListener('aiMemo:contentChanged', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return { memo, enabled, setEnabled };
}
