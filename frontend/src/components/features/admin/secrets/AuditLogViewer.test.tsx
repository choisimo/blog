import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchLogs = vi.hoisted(() => vi.fn());
const mockUseAuditLog = vi.hoisted(() => vi.fn());

vi.mock('./hooks', () => ({
  useAuditLog: mockUseAuditLog,
}));

function createUseAuditLogValue(overrides = {}) {
  return {
    logs: [],
    loading: false,
    error: null,
    pagination: {
      total: 0,
      limit: 20,
      offset: 0,
    },
    fetchLogs: mockFetchLogs,
    ...overrides,
  };
}

import { AuditLogViewer } from './AuditLogViewer';

describe('AuditLogViewer', () => {
  beforeEach(() => {
    mockFetchLogs.mockReset();
    mockUseAuditLog.mockReset();
    mockFetchLogs.mockResolvedValue(undefined);
    mockUseAuditLog.mockReturnValue(createUseAuditLogValue());
  });

  it('shows audit log errors without also showing the empty state', async () => {
    mockUseAuditLog.mockReturnValue(
      createUseAuditLogValue({
        error: 'Audit log unavailable',
      }),
    );

    render(<AuditLogViewer />);

    expect(screen.getByText('Audit log unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No audit logs found')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockFetchLogs).toHaveBeenCalledWith({
        action: undefined,
        limit: 20,
        offset: 0,
      });
    });
  });

  it('labels the audit log refresh control', async () => {
    render(<AuditLogViewer />);

    expect(screen.getByRole('button', { name: 'Refresh audit log' }))
      .toHaveAttribute('title', 'Refresh audit log');
    await waitFor(() => {
      expect(mockFetchLogs).toHaveBeenCalledWith({
        action: undefined,
        limit: 20,
        offset: 0,
      });
    });
  });
});
