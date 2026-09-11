import { describe, expect, it } from 'vitest';
import {
  nextScrollVisibility,
  type ScrollVisibility,
} from '@/hooks/ui/scrollVisibility';

describe('reading toolbar scroll direction', () => {
  it('accumulates slow downward reading and reveals promptly on an upward reversal', () => {
    let state: ScrollVisibility = { y: 100, distance: 0, hidden: false };
    for (let y = 101; y <= 148; y++)
      state = nextScrollVisibility(state, y, 2000);
    expect(state.hidden).toBe(true);
    state = nextScrollVisibility(state, 139, 2000);
    expect(state.hidden).toBe(true);
    state = nextScrollVisibility(state, 128, 2000);
    expect(state.hidden).toBe(false);
  });
  it('ignores alternating small movements and clamps overscroll', () => {
    let state: ScrollVisibility = { y: 100, distance: 0, hidden: false };
    for (let i = 0; i < 20; i++) {
      state = nextScrollVisibility(state, 102, 2000);
      state = nextScrollVisibility(state, 100, 2000);
    }
    expect(state.hidden).toBe(false);
    expect(nextScrollVisibility(state, -50, 2000)).toEqual({
      y: 0,
      distance: 0,
      hidden: false,
    });
  });
  it('keeps the reader hidden at the bottom while supporting the global footer exception', () => {
    const state = { y: 1700, distance: 0, hidden: true };
    expect(nextScrollVisibility(state, 2100, 2000).hidden).toBe(true);
    expect(nextScrollVisibility(state, 2000, 2000, true).hidden).toBe(false);
    expect(nextScrollVisibility(state, 40, 2000).hidden).toBe(false);
  });
});
