import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdminSubtabs } from './AdminSubtabs';

const TestIcon = () => <svg data-testid='admin-subtab-icon' />;

describe('AdminSubtabs', () => {
  it('sanitizes tablist and tab labels while preserving active state and styling', () => {
    render(
      <AdminSubtabs
        tabs={[
          {
            id: 'posts',
            label: '\u001b]0;Hidden posts\u0007\u001b[31mPosts\u0000',
            icon: <TestIcon />,
          },
          {
            id: 'settings',
            label: '\u001b]0;Hidden settings\u0007Settings\u0007',
          },
        ]}
        activeTab='posts'
        onTabChange={vi.fn()}
        ariaLabel={'\u001b]0;Hidden aria\u0007\u001b[32mAdmin tabs\u0008'}
        title={'\u001b]0;Hidden title\u0007Admin\u0009 sections'}
        className='custom-admin-tabs'
      />
    );

    const tablist = screen.getByRole('tablist', { name: 'Admin tabs' });
    const postsTab = screen.getByRole('tab', { name: 'Posts' });
    const settingsTab = screen.getByRole('tab', { name: 'Settings' });

    expect(tablist).toHaveAttribute('title', 'Admin sections');
    expect(tablist).toHaveClass('custom-admin-tabs');
    expect(postsTab).toHaveAttribute('aria-selected', 'true');
    expect(settingsTab).toHaveAttribute('aria-selected', 'false');
    expect(postsTab).toHaveTextContent('Posts');
    expect(screen.getByTestId('admin-subtab-icon').parentElement).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    expect(tablist.textContent).not.toContain('Hidden');
    expect(tablist.textContent).not.toContain('\u001b');
    expect(tablist.textContent).not.toContain('\u0007');
  });

  it('filters unsafe tabs and falls back when accessibility text sanitizes empty', () => {
    render(
      <AdminSubtabs
        tabs={[
          { id: 'safe-tab', label: 'Safe tab' },
          { id: 'unsafe/path', label: 'Unsafe tab' },
          { id: 'empty-label', label: '\u001b]0;Hidden empty\u0007\u001b[31m\u0000' },
        ]}
        activeTab='missing'
        onTabChange={vi.fn()}
        ariaLabel={'\u001b]0;Hidden aria\u0007\u001b[32m\u0007'}
        title={'\u0008'}
      />
    );

    const tablist = screen.getByRole('tablist', {
      name: 'Admin section tabs',
    });
    const safeTab = screen.getByRole('tab', { name: 'Safe tab' });

    expect(tablist).not.toHaveAttribute('title');
    expect(safeTab).toHaveAttribute('tabindex', '0');
    expect(screen.queryByRole('tab', { name: 'Unsafe tab' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Navigation' })).not.toBeInTheDocument();
  });

  it('emits normalized tab ids on click and keyboard navigation', () => {
    const onTabChange = vi.fn();

    render(
      <AdminSubtabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'posts', label: 'Posts' },
        ]}
        activeTab='overview'
        onTabChange={onTabChange}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Posts' }));
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Overview' }), {
      key: 'ArrowRight',
    });

    expect(onTabChange).toHaveBeenNthCalledWith(1, 'posts');
    expect(onTabChange).toHaveBeenNthCalledWith(2, 'posts');
  });

  it('passes sanitized tabs to custom renderers', () => {
    render(
      <AdminSubtabs
        tabs={[
          {
            id: 'custom',
            label: '\u001b]0;Hidden custom\u0007\u001b[31mCustom\u0000',
          },
        ]}
        activeTab='custom'
        onTabChange={vi.fn()}
        renderTab={(tab, isActive) => (
          <span data-testid='custom-tab'>
            {tab.id}:{tab.label}:{String(isActive)}
          </span>
        )}
      />
    );

    expect(screen.getByTestId('custom-tab')).toHaveTextContent(
      'custom:Custom:true'
    );
  });
});
