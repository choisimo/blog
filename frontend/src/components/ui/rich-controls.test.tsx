/** Run with the actual app's locked dependencies. Never replace React/Radix with mock renderers. */
import { createRef, StrictMode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { ActionButton } from './action-button';
import { ActionToolbar } from './action-toolbar';
import { WorkspacePanel } from '@/components/organisms/layout/WorkspacePanel';
import { PaneSwitcher } from '@/components/organisms/layout/PaneSwitcher';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('shared action semantics', () => {
  it('names an icon-only command and keeps its icon decorative', () => {
    render(<ActionButton action="attachImage" iconOnly />);
    const button = screen.getByRole('button', { name: '이미지 첨부' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('title', '이미지 첨부');
    expect(button).not.toHaveAttribute('aria-pressed');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
  it('forwards the actual button ref and dispatches exactly once', async () => {
    const ref = createRef<HTMLButtonElement>(), click = vi.fn(), user = userEvent.setup();
    render(<ActionButton action="bold" ref={ref} onClick={click} />);
    expect(ref.current).toBe(screen.getByRole('button', { name: '굵게 적용' }));
    await user.click(ref.current!); expect(click).toHaveBeenCalledTimes(1);
  });
  it.each(['disabled', 'busy', 'aria-disabled'] as const)('does not dispatch when %s', (flag) => {
    const click = vi.fn();
    render(<ActionButton action="bold" disabled={flag === 'disabled'} busy={flag === 'busy'}
      aria-disabled={flag === 'aria-disabled'} onClick={click} />);
    const button = screen.getByRole('button', { name: '굵게 적용' });
    fireEvent.click(button); expect(click).not.toHaveBeenCalled();
    if (flag === 'busy') expect(button).toHaveAttribute('aria-busy', 'true');
  });
  it('changes only the state ARIA associated with that kind of action', () => {
    const { rerender } = render(<ActionButton action="viewList" pressed={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-expanded');
    rerender(<ActionButton action="viewList" pressed />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    rerender(<ActionButton action="expandStack" expanded controls="stack-items" />);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button')).toHaveAttribute('aria-controls', 'stack-items');
  });
});

describe('React toolbar lifecycle', () => {
  // jsdom has no layout. This one geometry substitute is explicit; actual visibility,
  // breakpoints and mutation/focus timing are separately tested in real Chromium.
  const enableLayout = () => vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    return (this.closest('[hidden]') ? [] : [new DOMRect(0, 0, 44, 44)]) as unknown as DOMRectList;
  });
  it('roves without triggering actions, survives StrictMode cleanup and leaves on Tab', async () => {
    enableLayout(); const user = userEvent.setup(), first = vi.fn(), second = vi.fn();
    render(<StrictMode><button>이전</button><ActionToolbar label="서식">
      <ActionButton action="bold" onClick={first} /><ActionButton action="italic" onClick={second} />
    </ActionToolbar><button>이후</button></StrictMode>);
    screen.getByRole('button', { name: '이전' }).focus(); await user.tab();
    expect(screen.getByRole('button', { name: '굵게 적용' })).toHaveFocus();
    await user.keyboard('{ArrowRight}'); expect(screen.getByRole('button', { name: '기울임 적용' })).toHaveFocus();
    expect(first).not.toHaveBeenCalled(); expect(second).not.toHaveBeenCalled();
    await user.tab(); expect(screen.getByRole('button', { name: '이후' })).toHaveFocus();
  });
  it('preserves consumer-prevented keys', () => {
    enableLayout(); render(<ActionToolbar label="서식" onKeyDown={event => event.preventDefault()}>
      <ActionButton action="bold" /><ActionButton action="italic" />
    </ActionToolbar>);
    const button = screen.getByRole('button', { name: '굵게 적용' });button.focus();
    fireEvent.keyDown(button, { key: 'ArrowRight' });expect(button).toHaveFocus();
  });
  it('repairs a disabled focused child after a React update', async () => {
    enableLayout();
    const view = (disabled: boolean) => <ActionToolbar label="서식">
      <ActionButton action="bold" disabled={disabled} /><ActionButton action="italic" />
    </ActionToolbar>;
    const { rerender } = render(view(false));screen.getByRole('button', { name: '굵게 적용' }).focus();rerender(view(true));
    await waitFor(() => expect(screen.getByRole('button', { name: '기울임 적용' })).toHaveFocus());
  });
  it('does not emit a pane-change for the already selected option', async () => {
    enableLayout(); const change = vi.fn(), user = userEvent.setup();
    render(<PaneSwitcher label="작업 영역" value="write" onChange={change}
      options={[{ id: 'write', label: '작성', controls: 'write-pane' }, { id: 'preview', label: '미리보기', controls: 'preview-pane' }]} />);
    await user.click(screen.getByRole('button', { name: '작성' }));expect(change).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '미리보기' }));expect(change).toHaveBeenCalledExactlyOnceWith('preview');
  });
});

describe('persistent, non-modal panels', () => {
  function Child() { const [text, setText] = useState('초기');return <input aria-label="초안" value={text} onChange={e => setText(e.target.value)} />; }
  it('does not unmount edited content while the panel is hidden', async () => {
    const user = userEvent.setup(), view = (hidden: boolean) => <WorkspacePanel id="editor-tools" title="작성 도구" hidden={hidden}><Child /></WorkspacePanel>;
    const { rerender } = render(view(false));const input = screen.getByRole('textbox', { name: '초안' });
    await user.clear(input);await user.type(input, '보존할 초안');rerender(view(true));
    expect(input).toBeInTheDocument();expect(input).not.toBeVisible();rerender(view(false));
    expect(screen.getByRole('textbox', { name: '초안' })).toBe(input);expect(input).toHaveValue('보존할 초안');
  });
  it('has unique heading relationships and preserves an external description', () => {
    render(<><p id="extra">원본은 유지됩니다.</p><WorkspacePanel id="one" as="aside" title="도구" description="1개" aria-describedby="extra" /><WorkspacePanel id="two" title="결과" /></>);
    const a=screen.getByRole('complementary', { name: '도구' }), b=screen.getByRole('region', { name: '결과' });
    expect(a.getAttribute('aria-labelledby')).not.toBe(b.getAttribute('aria-labelledby'));
    expect(a.getAttribute('aria-describedby')?.split(' ')).toContain('extra');expect(screen.queryByRole('main')).toBeNull();
  });
});

describe('actual Radix dialog ownership', () => {
  const content = <><DialogTitle>설정</DialogTitle><DialogDescription>표시 설정</DialogDescription><input aria-label="이름" /></>;
  it('closes with Escape and returns focus to its opener', async () => {
    const user=userEvent.setup();render(<Dialog><DialogTrigger>설정 열기</DialogTrigger><DialogContent>{content}</DialogContent></Dialog>);
    const opener=screen.getByRole('button', { name: '설정 열기' });await user.click(opener);
    expect(screen.getByRole('dialog', { name: '설정' })).toBeVisible();await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());expect(opener).toHaveFocus();
  });
  it('shared close sanitizes its accessible label and returns focus without duplicating a close', async () => {
    const change=vi.fn(),user=userEvent.setup();
    render(<Dialog onOpenChange={change}><DialogTrigger>설정 열기</DialogTrigger><DialogContent closeLabel={'\u001b[31m설정 닫기\u001b[0m'}>{content}</DialogContent></Dialog>);
    const opener=screen.getByRole('button', { name: '설정 열기' });await user.click(opener);change.mockClear();
    await user.click(screen.getByRole('button', { name: '설정 닫기' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());expect(opener).toHaveFocus();expect(change).toHaveBeenCalledExactlyOnceWith(false);
  });
  it('keeps focus inside the modal and honors a consumer-prevented Escape', async () => {
    const user=userEvent.setup();render(<Dialog><DialogTrigger>열기</DialogTrigger><DialogContent onEscapeKeyDown={event => event.preventDefault()}>{content}</DialogContent></Dialog>);
    await user.click(screen.getByRole('button', { name: '열기' }));screen.getByRole('button', { name: '닫기' }).focus();await user.tab();
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);await user.keyboard('{Escape}');expect(screen.getByRole('dialog')).toBeVisible();
  });
  it('preserves hideClose', () => {
    render(<Dialog defaultOpen><DialogContent hideClose>{content}</DialogContent></Dialog>);expect(screen.queryByRole('button', { name: '닫기' })).toBeNull();
  });
});
