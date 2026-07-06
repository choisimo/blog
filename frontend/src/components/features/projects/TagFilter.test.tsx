import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  normalizeProjectFilterTags,
  normalizeProjectFilterText,
  TagFilter,
} from './TagFilter';

describe('TagFilter', () => {
  it('sanitizes group labels, all label, tags, and selected state', () => {
    const { container } = render(
      <TagFilter
        tags={[
          '\u001b[31mReact\u0000',
          'React',
          '\u0000',
          'All',
          '\u001b[32mTypeScript\u0007',
        ]}
        selectedTag={'\u001b[31mReact\u0000'}
        onSelect={vi.fn()}
        label={'\u001b[35mFilters\u0000'}
        title={'\u001b[34mTag filters\u0007'}
        allLabel={'\u001b[36mEverything\u0000'}
      />
    );

    expect(screen.getByRole('group', { name: 'Filters' })).toHaveAttribute(
      'title',
      'Tag filters'
    );
    expect(screen.getByRole('button', { name: 'Everything' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('button', { name: 'React' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'TypeScript' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.queryByText('All')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('emits the sanitized displayed tag when a filter is selected', () => {
    const onSelect = vi.fn();
    render(
      <TagFilter
        tags={['\u001b[31mReact\u0000']}
        selectedTag=''
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'React' }));

    expect(onSelect).toHaveBeenCalledWith('React');
  });

  it('normalizes tags with dedupe, empty filtering, and all-label filtering', () => {
    expect(
      normalizeProjectFilterTags(
        [' AI ', '\u001b[31mAI\u0000', '\u0000', 'Everything', 'all', 'UX\u0007'],
        'Everything'
      )
    ).toEqual(['Everything', 'AI', 'UX']);
  });

  it('strips OSC and CSI ANSI escape sequences from filter text', () => {
    expect(
      normalizeProjectFilterText(
        '\u001b]0;Hidden title\u0007Visible \u001b[31mtag\u001b[0m\u0000'
      )
    ).toBe('Visible tag');
  });
});
