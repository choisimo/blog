import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Pagination from '@/components/features/navigation/Pagination';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

describe('Pagination', () => {
  it('clamps invalid current page values before rendering and navigation', () => {
    const onPageChange = vi.fn();

    render(
      <Pagination
        currentPage={Number.POSITIVE_INFINITY}
        totalPages={5.8}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(
      screen.getByRole('button', { name: 'Previous page' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'First page' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByRole('button', { name: 'Last page' }));
    expect(onPageChange).toHaveBeenCalledWith(5);
  });

  it('clamps direct page button and quick-jump values through one boundary', () => {
    const onPageChange = vi.fn();

    render(
      <Pagination
        currentPage={2}
        totalPages={10}
        onPageChange={onPageChange}
        showQuickJump
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Page 4' }));
    expect(onPageChange).toHaveBeenCalledWith(4);

    fireEvent.click(screen.getAllByRole('button', { name: 'Jump to page' })[0]);
    const input = screen.getByPlaceholderText('Go to');
    // Native number inputs reject nonnumeric strings before React sees them.
    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    expect(onPageChange).toHaveBeenCalledWith(10);
  });

  it('does not render when normalized total pages are not pageable', () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={Number.NaN}
        onPageChange={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
