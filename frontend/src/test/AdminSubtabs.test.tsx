import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import {
  AdminSubtabs,
  type AdminSubtabsTab,
} from '@/components/molecules/AdminSubtabs';

const tabs: AdminSubtabsTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'secrets', label: 'Secrets' },
  { id: 'workers', label: 'Workers' },
];

function AdminSubtabsHarness() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <AdminSubtabs
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      ariaLabel="Admin test tabs"
    />
  );
}

describe('AdminSubtabs', () => {
  it('exposes tab semantics and selected state', () => {
    render(<AdminSubtabsHarness />);

    expect(
      screen.getByRole('tablist', { name: 'Admin test tabs' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Secrets' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('activates tabs from keyboard navigation', () => {
    render(<AdminSubtabsHarness />);

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Overview' }), {
      key: 'ArrowRight',
    });

    expect(screen.getByRole('tab', { name: 'Secrets' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Secrets' }), {
      key: 'End',
    });

    expect(screen.getByRole('tab', { name: 'Workers' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
