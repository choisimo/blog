import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { AdminDashboard } from '@/pages/admin/AdminDashboard';

vi.mock('@/components/features/admin/ConfigManager', () => ({
  ConfigManager: () => <div>Env panel</div>,
}));

vi.mock('@/components/features/admin/WorkersManager', () => ({
  WorkersManager: () => <div>Workers panel</div>,
}));

vi.mock('@/components/features/admin/ai', () => ({
  AIManager: () => <div>AI panel</div>,
}));

vi.mock('@/components/features/admin/secrets', () => ({
  SecretsManager: () => <div>Secrets panel</div>,
}));

vi.mock('@/components/features/admin/rag', () => ({
  RAGManager: () => <div>RAG panel</div>,
}));

vi.mock('@/components/features/admin/health', () => ({
  SystemHealth: () => <div>Health panel</div>,
}));

vi.mock('@/components/features/admin/analytics', () => ({
  AnalyticsManager: () => <div>Analytics panel</div>,
}));

vi.mock('@/components/features/admin/logs', () => ({
  LogViewer: () => <div>Logs panel</div>,
}));

vi.mock('@/components/features/admin/content', () => ({
  ContentManager: () => <div>Content panel</div>,
}));

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="path">{location.pathname}</span>;
}

function renderDashboard(initialPath = '/admin/config/health') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/admin/config/:section"
          element={
            <>
              <LocationProbe />
              <AdminDashboard
                userEmail="admin@example.com"
                onLogout={() => {}}
              />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminDashboard navigation', () => {
  it('exposes top-level admin sections as tabs', async () => {
    renderDashboard();
    await screen.findByText('Health panel');

    expect(
      screen.getByRole('tablist', { name: 'Admin navigation' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Health' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'RAG' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      'admin-tab-health',
    );
  });

  it('moves between admin sections with keyboard navigation', async () => {
    renderDashboard();
    await screen.findByText('Health panel');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Health' }), {
      key: 'ArrowRight',
    });

    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent('/admin/config/rag');
    });
    expect(screen.getByRole('tab', { name: 'RAG' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await screen.findByText('RAG panel');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'RAG' }), {
      key: 'End',
    });

    await waitFor(() => {
      expect(screen.getByTestId('path')).toHaveTextContent(
        '/admin/config/workers',
      );
    });
    expect(screen.getByRole('tab', { name: 'Workers' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await screen.findByText('Workers panel');
  });
});
