import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VisitedPostsMinimap } from '@/components/features/navigation/VisitedPostsMinimap';
import { ThemeProvider } from '@/contexts/ThemeContext';

const wrap = (ui: React.ReactNode, initialEntries: string[] = ['/']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <ThemeProvider>
        <Routes>
          <Route path='/' element={<>{ui}</>} />
          <Route path='/blog/:year/:slug' element={<div>Post Page</div>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );

describe('VisitedPostsMinimap', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not render when there are no visited posts', () => {
    wrap(<VisitedPostsMinimap />);
    // Should not be present when there are no visited posts
    expect(
      screen.queryByLabelText(/open visited posts history/i)
    ).not.toBeInTheDocument();
  });

  it('renders when visited posts exist and toggles open state', () => {
    localStorage.setItem(
      'visited.posts',
      JSON.stringify([
        { path: '/blog/2025/foo', title: 'Foo', year: '2025', slug: 'foo' },
        { path: '/blog/2025/bar', title: 'Bar', year: '2025', slug: 'bar' },
      ])
    );
    wrap(<VisitedPostsMinimap />);

    const btn = screen.getByRole('button', {
      name: /open visited posts history/i,
    });
    expect(btn).toBeInTheDocument();

    // Initially collapsed, clicking opens list
    fireEvent.click(btn);
    expect(screen.getByText(/Recently visited/i)).toBeInTheDocument();

    // Close via Close button
    fireEvent.click(screen.getByRole('button', { name: /close history/i }));
    expect(screen.queryByText(/Recently visited/i)).not.toBeInTheDocument();
  });

  it('reacts to visitedposts:update and storage events', async () => {
    localStorage.setItem('visited.posts', JSON.stringify([]));
    wrap(<VisitedPostsMinimap />);

    // Update storage directly
    localStorage.setItem(
      'visited.posts',
      JSON.stringify([
        { path: '/blog/2025/foo', title: 'Foo', year: '2025', slug: 'foo' },
      ])
    );
    // Dispatch custom event to trigger refresh and wait for update
    await act(async () => {
      window.dispatchEvent(new CustomEvent('visitedposts:update'));
    });

    // Now the minimap should appear
    const btn = await screen.findByRole('button', {
      name: /open visited posts history/i,
    });
    expect(btn).toBeInTheDocument();
  });

  it('navigates to selected post when clicking an item', () => {
    localStorage.setItem(
      'visited.posts',
      JSON.stringify([
        { path: '/blog/2025/foo', title: 'Foo', year: '2025', slug: 'foo' },
      ])
    );
    wrap(<VisitedPostsMinimap />);

    fireEvent.click(
      screen.getByRole('button', { name: /open visited posts history/i })
    );

    // Click the list item button which has text Foo
    fireEvent.click(screen.getByRole('button', { name: /foo/i }));

    // The router renders Post Page at the target route
    expect(screen.getByText('Post Page')).toBeInTheDocument();
  });
});
