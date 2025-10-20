import { render, screen, cleanup, waitFor } from '@testing-library/react';
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
  // Ensure any stubbed ai-memo-pad elements are removed between tests
  document.querySelectorAll('ai-memo-pad').forEach((el) => el.remove());
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

  it('shows memo action buttons when memo is open under FAB', async () => {
    // Enable FAB
    window.localStorage.setItem('aiMemo.fab.enabled', 'true');

    // Stub ai-memo web component with a shadow root and an open panel
    const aiMemo = document.createElement('ai-memo-pad') as any;
    const shadow = aiMemo.attachShadow ? aiMemo.attachShadow({ mode: 'open' }) : (aiMemo as any).shadowRoot;
    const panel = document.createElement('div');
    panel.id = 'panel';
    panel.className = 'open';
    shadow.appendChild(panel);
    document.body.appendChild(aiMemo);

    // Render app
    await act(async () => {
      render(<App />);
    });

    // Wait for FAB toolbar
    await waitFor(() => {
      expect(screen.queryByRole('toolbar', { name: 'Floating actions' })).not.toBeNull();
    });

    // Expect memo action buttons visible in FAB (queried by aria-label)
    expect(screen.queryByRole('button', { name: '선택 추가' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: '그래프에 추가' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'AI 요약' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Catalyst' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: '메모 다운로드' })).not.toBeNull();
  });

  it('hides FAB while legacy history overlay is open and shows after close', async () => {
    // Enable FAB
    window.localStorage.setItem('aiMemo.fab.enabled', 'true');

    // Stub ai-memo web component with a shadow root and a visible history overlay
    const aiMemo = document.createElement('ai-memo-pad') as any;
    const shadow = aiMemo.attachShadow ? aiMemo.attachShadow({ mode: 'open' }) : (aiMemo as any).shadowRoot;
    const overlay = document.createElement('div');
    overlay.id = 'historyOverlay';
    overlay.style.display = 'block'; // simulate overlay open
    shadow.appendChild(overlay);
    document.body.appendChild(aiMemo);

    // Render app
    await act(async () => {
      render(<App />);
    });

    // FAB should be hidden while overlay is open
    await waitFor(() => {
      const toolbar = screen.queryByRole('toolbar', { name: 'Floating actions' });
      expect(toolbar).toBeNull();
    });

    // Close overlay and expect FAB to appear
    overlay.style.display = 'none';
    await waitFor(() => {
      const toolbar = screen.queryByRole('toolbar', { name: 'Floating actions' });
      expect(toolbar).not.toBeNull();
    });
  });
});
