import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BlogSidebar from '@/components/features/blog/BlogSidebar';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

describe('BlogSidebar', () => {
  it('normalizes category names and counts before rendering and callbacks', () => {
    const onCategorySelect = vi.fn();

    render(
      <BlogSidebar
        categories={[
          { name: ' AI\u0000\nSearch ', count: 3.8 },
          { name: 'Bad%09Category', count: 2 },
          { name: '\u0000', count: Number.NaN },
        ]}
        selectedCategory=" AI Search "
        onCategorySelect={onCategorySelect}
      />,
    );

    const categoryButton = screen.getByRole('button', { name: /AI Search/i });
    expect(categoryButton).toHaveTextContent('AI Search');
    expect(categoryButton).toHaveTextContent('(3)');
    expect(screen.queryByText(/Bad%09Category/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\u0000/)).not.toBeInTheDocument();

    fireEvent.click(categoryButton);
    expect(onCategorySelect).toHaveBeenCalledWith('AI Search');
  });

  it('normalizes tag labels and callback payloads', () => {
    const onTagSelect = vi.fn();

    render(
      <BlogSidebar
        tags={[' tag\u0000\none ', '\u0000', 'tag-two', 'tag%09bad']}
        selectedTags={['tag one']}
        onTagSelect={onTagSelect}
      />,
    );

    expect(screen.getByText('#tag one')).toBeInTheDocument();
    expect(screen.getByText('#tag-two')).toBeInTheDocument();
    expect(screen.queryByText('#tag%09bad')).not.toBeInTheDocument();
    expect(screen.queryByText('#')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('#tag one'));
    expect(onTagSelect).toHaveBeenCalledWith('tag one');
  });
});
