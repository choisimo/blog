import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AdminDashboard } from '@/pages/admin/AdminDashboard';

vi.mock('@/components/features/admin/health', () => ({
  SystemHealth: () => <div>health panel</div>,
}));

describe('AdminDashboard display boundaries', () => {
  it('normalizes control-contaminated user email before rendering', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/config/health']}>
        <Routes>
          <Route
            path='/admin/config/:section'
            element={
              <AdminDashboard
                userEmail={
                  ' admin\u0000@example.com\r\nX-Injected: yes\u001b[31m\u001b]0;osc-admin-payload\u0007 '
                }
                onLogout={vi.fn()}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByText('admin @example.com X-Injected: yes'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\u0000/)).not.toBeInTheDocument();
    expect(await screen.findByText('health panel')).toBeInTheDocument();
  });
});
