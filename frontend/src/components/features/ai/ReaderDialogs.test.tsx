import { useState } from 'react';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OverlayDialog } from '@/components/molecules/OverlayDialog';
import { useAuthStore } from '@/stores/session/useAuthStore';
import AgentPreferencesDialog, { AgentSettingsButton } from './AgentPreferencesDialog';
import AnonymousSessionRecoveryDialog from './AnonymousSessionRecoveryDialog';

function Harness({ recovery = false }: { recovery?: boolean }) {
  const [open, setOpen] = useState(true);
  return <>
    <OverlayDialog open={open} onClose={() => setOpen(false)} label="AI Chat" modal>
      <div>
        <AgentSettingsButton />
        <button onClick={() => window.dispatchEvent(new Event('reader:anonymous-auth-required'))}>
          Recover session
        </button>
      </div>
    </OverlayDialog>
    <AgentPreferencesDialog />
    {recovery && <AnonymousSessionRecoveryDialog />}
  </>;
}

beforeEach(() => {
  localStorage.clear();
  useAuthStore.getState().clearAuth();
  // Real local credential validation rejects this proof before any network call.
  localStorage.setItem('anon.token', 'invalid-proof');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('reader dialogs above modal chat', () => {
  it('allows settings interaction and restores focus without closing chat', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'AI 설정 열기' });
    await user.click(trigger);
    const settings = await screen.findByRole('dialog', { name: 'AI 설정' });
    expect(settings.closest('[aria-hidden="true"]')).toBeNull();
    expect(settings).toHaveStyle({ pointerEvents: 'auto' });
    const tone = within(settings).getByRole('combobox', { name: '말투' });
    await user.selectOptions(tone, 'formal');
    expect(tone).toHaveFocus();
    await user.click(within(settings).getByRole('button', { name: '저장' }));
    expect(JSON.parse(localStorage.getItem('reader.agent.v1:guest')!)).toMatchObject({ tone: 'formal' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(settings).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.getByRole('dialog', { name: 'AI Chat' })).toHaveStyle({ pointerEvents: 'auto' });
  });

  it('keeps recovery usable and focused above settings, then returns through the stack', async () => {
    const user = userEvent.setup();
    render(<Harness recovery />);
    const trigger = screen.getByRole('button', { name: 'AI 설정 열기' });
    await user.click(trigger);
    // The settings quota lookup encounters the invalid proof and opens recovery.
    const recovery = await screen.findByRole('dialog', { name: '익명 인증 확인' });
    expect(recovery).toHaveAccessibleDescription('현재 메모는 그대로 둡니다. 만료되거나 분실한 자격은 ID만으로 복구할 수 없습니다.');
    expect(recovery.closest('[aria-hidden="true"]')).toBeNull();
    expect(recovery).toHaveStyle({ pointerEvents: 'auto' });
    const confirm = within(recovery).getByRole('checkbox');
    await user.click(confirm);
    expect(confirm).toBeChecked();
    expect(confirm).toHaveFocus();
    expect(within(recovery).getByRole('button', { name: '새 익명 세션 시작' })).toBeEnabled();
    // A repeated auth event must not reset an already-open confirmation.
    act(() => { window.dispatchEvent(new Event('reader:anonymous-auth-required')); });
    expect(confirm).toBeChecked();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(recovery).not.toBeInTheDocument());
    const settings = screen.getByRole('dialog', { name: 'AI 설정' });
    await waitFor(() => expect(settings).toContainElement(document.activeElement as HTMLElement));
    await user.click(within(settings).getByRole('button', { name: 'AI 설정 닫기' }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.getByRole('dialog', { name: 'AI Chat' })).toBeInTheDocument();
  });

  it('closes recovery back to its chat opener and resets confirmation on reopen', async () => {
    const user = userEvent.setup();
    render(<Harness recovery />);
    const trigger = screen.getByRole('button', { name: 'Recover session' });
    await user.click(trigger);
    const recovery = await screen.findByRole('dialog', { name: '익명 인증 확인' });
    await user.click(within(recovery).getByRole('checkbox'));
    await user.click(within(recovery).getByRole('button', { name: '인증 확인 닫기' }));
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.click(trigger);
    const reopened = await screen.findByRole('dialog', { name: '익명 인증 확인' });
    expect(within(reopened).getByRole('checkbox')).not.toBeChecked();
    expect(within(reopened).getByRole('button', { name: '새 익명 세션 시작' })).toBeDisabled();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.getByRole('dialog', { name: 'AI Chat' })).toBeInTheDocument();
  });
});
