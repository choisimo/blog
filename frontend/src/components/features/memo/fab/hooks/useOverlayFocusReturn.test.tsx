import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { OverlayDialog } from '@/components/molecules/OverlayDialog';
import { useOverlayFocusReturn } from './useOverlayFocusReturn';

function Harness({ changeRoute = false }: { changeRoute?: boolean }) {
  const [mode, setMode] = useState<'closed' | 'shell' | 'real'>('closed');
  const [blocked, setBlocked] = useState(false);
  const { registerTrigger, rememberFocus, requestFocusReturn } =
    useOverlayFocusReturn({ active: mode !== 'closed', blocked });
  return (
    <>
      <main id='main-content' tabIndex={-1}>
        Page
      </main>
      {!blocked && (
        <button
          ref={node => registerTrigger('shell', node)}
          onClick={() => {
            rememberFocus('shell');
            setBlocked(true);
            setMode('shell');
          }}
        >
          Open shell
        </button>
      )}
      <button onClick={() => setBlocked(false)}>Release modal presence</button>
      {mode === 'shell' && (
        <OverlayDialog
          open
          label='Shell'
          onClose={() => setMode('closed')}
          onReturnFocus={requestFocusReturn}
        >
          <div>
            <button onClick={() => setMode('real')}>Switch terminal</button>
          </div>
        </OverlayDialog>
      )}
      {mode === 'real' && (
        <OverlayDialog
          open
          label='Real'
          onClose={() => setMode('closed')}
          onReturnFocus={requestFocusReturn}
        >
          <div>
            <button
              onClick={() => {
                if (changeRoute)
                  window.history.replaceState({}, '', '/changed-route');
                setMode('closed');
              }}
            >
              Close terminal
            </button>
          </div>
        </OverlayDialog>
      )}
    </>
  );
}

describe('FAB overlay focus return', () => {
  it('focuses main content when navigation unmounts the FAB owner and its opener together', async () => {
    const user = userEvent.setup();
    function Owner({ onNavigate }: { onNavigate: () => void }) {
      const [open, setOpen] = useState(false);
      const { rememberFocus, requestFocusReturn } = useOverlayFocusReturn({
        active: open,
        blocked: false,
      });
      return (
        <>
          <button
            onClick={() => {
              rememberFocus();
              setOpen(true);
            }}
          >
            Open owner shell
          </button>
          <OverlayDialog
            open={open}
            label='Owner shell'
            onClose={() => setOpen(false)}
            onReturnFocus={requestFocusReturn}
          >
            <div>
              <button onClick={onNavigate}>Navigate to blog</button>
            </div>
          </OverlayDialog>
        </>
      );
    }
    function RouteHarness() {
      const [showOwner, setShowOwner] = useState(true);
      return (
        <>
          <main id='main-content' tabIndex={-1}>
            Route content
          </main>
          {showOwner && <Owner onNavigate={() => setShowOwner(false)} />}
        </>
      );
    }
    render(<RouteHarness />);
    await user.click(screen.getByRole('button', { name: 'Open owner shell' }));
    await user.click(screen.getByRole('button', { name: 'Navigate to blog' }));
    await waitFor(() =>
      expect(document.getElementById('main-content')).toHaveFocus()
    );
    expect(
      screen.queryByRole('button', { name: 'Open owner shell' })
    ).not.toBeInTheDocument();
  });

  it('waits through Shell/Real transitions and modal presence, then focuses the remounted original action', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const initialTrigger = screen.getByRole('button', { name: 'Open shell' });
    await user.click(initialTrigger);
    expect(initialTrigger.isConnected).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Switch terminal' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Close terminal' })
      ).toHaveFocus()
    );
    expect(document.getElementById('main-content')).not.toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Close terminal' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(
      screen.queryByRole('button', { name: 'Open shell' })
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Release modal presence' })
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Open shell' })).toHaveFocus()
    );
  });

  it('uses main content after navigation instead of focusing an unrelated new-page trigger', async () => {
    const user = userEvent.setup();
    const originalPath = window.location.pathname;
    render(<Harness changeRoute />);
    await user.click(screen.getByRole('button', { name: 'Open shell' }));
    await user.click(screen.getByRole('button', { name: 'Switch terminal' }));
    await user.click(screen.getByRole('button', { name: 'Close terminal' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Release modal presence' })
    );
    await waitFor(() =>
      expect(document.getElementById('main-content')).toHaveFocus()
    );
    window.history.replaceState({}, '', originalPath);
  });
});
