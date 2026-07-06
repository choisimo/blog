import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Pagination from './Pagination';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

describe('Pagination', () => {
  it('sanitizes navigation title and control labels while preserving page changes', () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={onPageChange}
        label={'\u001b[35mPager\u0000'}
        title={'\u001b[34mPage controls\u0007'}
        firstPageLabel={'\u001b[31mFirst\u0000'}
        previousPageLabel={'\u001b[32mPrevious\u0000'}
        nextPageLabel={'\u001b[33mNext\u0000'}
        lastPageLabel={'\u001b[36mLast\u0000'}
        pageLabel={'\u001b[35mPg\u0000'}
      />
    );

    expect(screen.getByRole('navigation', { name: 'Pager' })).toHaveAttribute(
      'title',
      'Page controls'
    );
    expect(screen.getByRole('button', { name: 'First' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pg 2' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('clamps current page and ignores attempts to move beyond the last page', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={99}
        totalPages={5}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByRole('button', { name: 'Page 5' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Last page' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));

    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('sanitizes quick jump labels and submits the requested page', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={1}
        totalPages={12}
        onPageChange={onPageChange}
        showQuickJump
        jumpLabel={'\u001b[31mJump pages\u0000'}
        jumpInputLabel={'\u001b[32mPage number\u0000'}
        jumpPlaceholder={'\u001b[33mGo number\u0000'}
        jumpSubmitLabel={'\u001b[34mGo now\u0000'}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Jump pages' }));
    const input = screen.getByLabelText('Page number');

    expect(input).toHaveAttribute('placeholder', 'Go number');

    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go now' }));

    expect(onPageChange).toHaveBeenCalledWith(10);
  });

  it('renders nothing when there is only one page', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
