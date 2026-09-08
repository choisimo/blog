import { useState } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OverlayDialog } from './OverlayDialog';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

describe('OverlayDialog focus and layer boundaries', () => {
  it('contains Tab and closes only the topmost nested Sheet or AlertDialog on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open chat</button>
          <OverlayDialog
            open={open}
            onClose={() => {
              onClose();
              setOpen(false);
            }}
            label='Chat'
          >
            <div>
              <Sheet>
                <SheetTrigger asChild>
                  <button>Open menu</button>
                </SheetTrigger>
                <SheetContent hideClose aria-describedby={undefined}>
                  <SheetTitle>Chat menu</SheetTitle>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button>Delete chat</button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogTitle>Delete confirmation</AlertDialogTitle>
                      <AlertDialogDescription>
                        Confirm deletion.
                      </AlertDialogDescription>
                      <AlertDialogCancel>Cancel deletion</AlertDialogCancel>
                    </AlertDialogContent>
                  </AlertDialog>
                </SheetContent>
              </Sheet>
              <button onClick={() => setOpen(false)}>Close chat</button>
            </div>
          </OverlayDialog>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open chat' });
    await user.click(opener);
    const menuButton = screen.getByRole('button', { name: 'Open menu' });
    await waitFor(() => expect(menuButton).toHaveFocus());
    screen.getByRole('button', { name: 'Close chat' }).focus();
    await user.tab();
    expect(menuButton).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Close chat' })).toHaveFocus();

    await user.click(menuButton);
    await user.click(screen.getByRole('button', { name: 'Delete chat' }));
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole('dialog', { name: 'Chat menu' })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Delete chat' })).toHaveFocus()
    );

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Chat menu' })
      ).not.toBeInTheDocument()
    );
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(menuButton).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(opener).toHaveFocus());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps a nonmodal desktop window open when interacting with the page', async () => {
    const onClose = vi.fn();
    render(
      <>
        <button>Page action</button>
        <OverlayDialog
          open
          modal={false}
          label='Desktop chat'
          onClose={onClose}
        >
          <div>
            <button>Chat action</button>
          </div>
        </OverlayDialog>
      </>
    );
    await act(async () =>
      screen.getByRole('button', { name: 'Page action' }).focus()
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Page action' }));
    expect(screen.getByRole('button', { name: 'Page action' })).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole('dialog', { name: 'Desktop chat' })
    ).not.toHaveAttribute('aria-modal', 'true');
  });
});
