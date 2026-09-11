import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { readMemoContext, useMemoContext } from './useMemoContext';

afterEach(() => {
  document.querySelector('ai-memo-pad')?.remove();
  localStorage.clear();
});

describe('live memo context', () => {
  it('reads unsaved input and updates on typing, clearing and title changes', () => {
    localStorage.setItem(
      'aiMemo.content',
      JSON.stringify('stale persisted text')
    );
    const host = document.createElement('ai-memo-pad');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<textarea id="memo"></textarea><input id="memoTitleInput" value="My note" />';
    document.body.append(host);
    const memo = root.querySelector('textarea')!;
    memo.value = '**unsaved**';
    const { result } = renderHook(useMemoContext);
    expect(result.current.memo.content).toBe('**unsaved**');
    act(() => {
      memo.value = 'new input';
      root.querySelector('input')!.value = 'Renamed';
      window.dispatchEvent(new Event('aiMemo:contentChanged'));
    });
    expect(result.current.memo).toMatchObject({
      title: 'Renamed',
      content: 'new input',
    });
    act(() => result.current.setEnabled(false));
    act(() => {
      memo.value = '';
      window.dispatchEvent(new Event('aiMemo:contentChanged'));
    });
    expect(result.current.memo.content).toBe('');
    expect(result.current.enabled).toBe(false);
  });

  it('bounds the displayed and submitted context equally', () => {
    localStorage.setItem('aiMemo.content', JSON.stringify('a'.repeat(6001)));
    expect(readMemoContext()).toMatchObject({
      content: 'a'.repeat(6000),
      truncated: true,
    });
  });
});
