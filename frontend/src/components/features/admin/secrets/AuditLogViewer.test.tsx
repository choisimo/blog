import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
        error: 'Audit\u0000 log\r\nunavailable\u007F',
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

  it('resets pagination offset when the action filter changes', async () => {
    mockUseAuditLog.mockReturnValue(
      createUseAuditLogValue({
        pagination: {
          total: 45,
          limit: 20,
          offset: 0,
        },
      }),
    );

    render(<AuditLogViewer />);

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    await waitFor(() => {
      expect(mockFetchLogs).toHaveBeenCalledWith({
        action: undefined,
        limit: 20,
        offset: 20,
      });
    });

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: 'Deleted' }));

    await waitFor(() => {
      expect(mockFetchLogs).toHaveBeenCalledWith({
        action: 'deleted',
        limit: 20,
        offset: 0,
      });
    });
  });

  it('normalizes safe audit log metadata before rendering rows', async () => {
    mockUseAuditLog.mockReturnValue(
      createUseAuditLogValue({
        logs: [
          {
            id: 1,
            secret_id: 'secret-1',
            action: 'accessed',
            old_value_hash: null,
            new_value_hash: null,
            changed_by: 'admin@example.com\u0000\r\nInjected\u007F',
            ip_address: '127.0.0.1\u0000\r\nInjected\u007F',
            user_agent: null,
            metadata: null,
            created_at: '2026-01-01T00:00:00.000Z',
            key_name: 'API_KEY',
          },
        ],
      }),
    );

    render(<AuditLogViewer />);

    expect(screen.getByText('API_KEY')).toBeInTheDocument();
    expect(screen.getByText('by admin@example.com Injected')).toBeInTheDocument();
    expect(screen.getByText('127.0.0.1 Injected')).toBeInTheDocument();
  });

  it('filters audit log rows with polluted actions or selectors', async () => {
    mockUseAuditLog.mockReturnValue(
      createUseAuditLogValue({
        logs: [
          {
            id: 1,
            secret_id: 'secret-1\r\nX-Injected: yes',
            action: 'accessed',
            old_value_hash: null,
            new_value_hash: null,
            changed_by: null,
            ip_address: null,
            user_agent: null,
            metadata: null,
            created_at: '2026-01-01T00:00:00.000Z',
            key_name: 'API_KEY\r\nX-Injected: yes',
          },
          {
            id: 2,
            secret_id: 'secret-2',
            action: 'accessed\r\nX-Injected: yes',
            old_value_hash: null,
            new_value_hash: null,
            changed_by: null,
            ip_address: null,
            user_agent: null,
            metadata: null,
            created_at: '2026-01-01T00:00:00.000Z',
            key_name: 'SAFE_KEY',
          },
        ],
      }),
    );

    render(<AuditLogViewer />);

    expect(screen.getByText('No audit logs found')).toBeInTheDocument();
    expect(screen.queryByText('SAFE_KEY')).not.toBeInTheDocument();
    expect(screen.queryByText(/API_KEY/)).not.toBeInTheDocument();
  });
});
