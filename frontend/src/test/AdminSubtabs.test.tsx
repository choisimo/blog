import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

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

  it('does not emit tab changes when reselecting the active tab', () => {
    const onTabChange = vi.fn();

    render(
      <AdminSubtabs
        tabs={tabs}
        activeTab="overview"
        onTabChange={onTabChange}
        ariaLabel="Admin test tabs"
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Overview' }), {
      key: 'Home',
    });

    expect(onTabChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: 'Secrets' }));

    expect(onTabChange).toHaveBeenCalledTimes(1);
    expect(onTabChange).toHaveBeenCalledWith('secrets');
  });

  it('normalizes tab ids before emitting changes', () => {
    const onTabChange = vi.fn();

    render(
      <AdminSubtabs
        tabs={[
          { id: ' overview ', label: 'Overview' },
          { id: 'secrets', label: 'Secrets' },
        ]}
        activeTab="overview"
        onTabChange={onTabChange}
        ariaLabel="Admin test tabs"
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Secrets' }));

    expect(onTabChange).toHaveBeenCalledWith('secrets');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'id',
      expect.stringMatching(/-overview$/),
    );
  });

  it('does not render tabs with polluted ids', () => {
    const onTabChange = vi.fn();

    render(
      <AdminSubtabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'secrets\r\nX-Injected: yes', label: 'Polluted' },
        ]}
        activeTab="overview"
        onTabChange={onTabChange}
        ariaLabel="Admin test tabs"
      />,
    );

    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Polluted' })).not.toBeInTheDocument();
  });

  it('rejects encoded control tab ids and normalizes tab labels before rendering', () => {
    render(
      <AdminSubtabs
        tabs={[
          { id: 'overview', label: ' Overview\u0000Tab\r\nNow ' },
          { id: 'secrets%00', label: 'Polluted' },
        ]}
        activeTab="overview"
        onTabChange={vi.fn()}
        ariaLabel="Admin test tabs"
      />,
    );

    expect(screen.getByRole('tab', { name: 'Overview Tab Now' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByRole('tab', { name: 'Polluted' })).not.toBeInTheDocument();
  });
});
