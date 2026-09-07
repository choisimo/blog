import { describe, expect, it } from 'vitest';
import { isHeaderSearchShortcut } from './headerSearchShortcut';

type ShortcutEvent = Parameters<typeof isHeaderSearchShortcut>[0];
const event = (patch: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
  key: '/', ctrlKey: false, metaKey: false, altKey: false,
  isComposing: false, defaultPrevented: false, repeat: false, ...patch,
});

describe('header search shortcut', () => {
  it('supports slash and Ctrl/Cmd K while the search dialog is closed', () => {
    expect(isHeaderSearchShortcut(event(), false)).toBe(true);
    expect(isHeaderSearchShortcut(event({ key: 'k', ctrlKey: true }), false)).toBe(true);
    expect(isHeaderSearchShortcut(event({ key: 'K', metaKey: true }), false)).toBe(true);
  });

  it('does not steal editing, IME, already handled, or repeated input', () => {
    expect(isHeaderSearchShortcut(event(), true)).toBe(false);
    expect(isHeaderSearchShortcut(event({ isComposing: true }), false)).toBe(false);
    expect(isHeaderSearchShortcut(event({ defaultPrevented: true }), false)).toBe(false);
    expect(isHeaderSearchShortcut(event({ repeat: true }), false)).toBe(false);
  });

  it('ignores ordinary letters and modified slash', () => {
    expect(isHeaderSearchShortcut(event({ key: 'k' }), false)).toBe(false);
    expect(isHeaderSearchShortcut(event({ altKey: true }), false)).toBe(false);
    expect(isHeaderSearchShortcut(event({ ctrlKey: true }), false)).toBe(false);
  });
});
