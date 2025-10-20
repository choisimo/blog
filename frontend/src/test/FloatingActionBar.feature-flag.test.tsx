import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import App from '../App';

const seedVisited = () => {
  const items = [
    { path: '/blog/2025/foo', title: 'Foo', year: '2025', slug: 'foo' },
    { path: '/blog/2025/bar', title: 'Bar', year: '2025', slug: 'bar' },
  ];
  window.localStorage.setItem('visited.posts', JSON.stringify(items));
};

const withFab = async (enabled: boolean) => {
  window.localStorage.setItem('aiMemo.fab.enabled', JSON.stringify(enabled));
  await act(async () => {
    render(<App />);
  });
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('FloatingActionBar feature flag', () => {
  it('hides VisitedPostsMinimap when FAB enabled', async () => {
    seedVisited();
    await withFab(true);
    const historyTriggers = screen.queryAllByLabelText('Open visited posts history');
    expect(historyTriggers.length).toBe(0);
  });

  it('shows VisitedPostsMinimap when FAB disabled', async () => {
    seedVisited();
    await withFab(false);
    const historyTriggers = screen.queryAllByLabelText('Open visited posts history');
    expect(historyTriggers.length).toBeGreaterThan(0);
  });

  it('renders FAB toolbar when enabled', async () => {
    await withFab(true);
    const toolbar = screen.queryByRole('toolbar', { name: 'Floating actions' });
    expect(toolbar).not.toBeNull();
  });
});
