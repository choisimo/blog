import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  normalizeProjectFilterTags,
  TagFilter,
} from '@/components/features/projects/TagFilter';

describe('normalizeProjectFilterTags', () => {
  it('trims tags, drops blanks, removes duplicate All, and deduplicates values', () => {
    expect(
      normalizeProjectFilterTags([
        'All',
        ' react ',
        '',
        'react',
        '  ',
        'TypeScript',
        'all',
      ])
    ).toEqual(['All', 'react', 'TypeScript']);
  });
});

describe('TagFilter', () => {
  it('renders one normalized button per filter value', () => {
    render(
      <TagFilter
        tags={['All', ' react ', '', 'react', 'TypeScript']}
        selectedTag=''
        onSelect={vi.fn()}
      />
    );

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'react' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'TypeScript' })
    ).toBeInTheDocument();
  });

  it('emits normalized tag values when a filter is selected', () => {
    const onSelect = vi.fn();

    render(
      <TagFilter tags={[' react ']} selectedTag='All' onSelect={onSelect} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'react' }));

    expect(onSelect).toHaveBeenCalledWith('react');
  });
});
