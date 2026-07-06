import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProjectCardSkeleton } from './ProjectCardSkeleton';

describe('ProjectCardSkeleton', () => {
  it('exposes a sanitized loading status label and title', () => {
    const { container } = render(
      <ProjectCardSkeleton
        label={'\u001b[31mLoading projects\u0000'}
        title={'\u001b[32mProject placeholder\u0007'}
      />
    );

    expect(screen.getByRole('status', { name: 'Loading projects' })).toHaveAttribute(
      'aria-busy',
      'true'
    );
    expect(screen.getByRole('status', { name: 'Loading projects' })).toHaveAttribute(
      'title',
      'Project placeholder'
    );
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('keeps placeholder blocks hidden from the accessibility tree', () => {
    const { container } = render(<ProjectCardSkeleton />);

    expect(screen.getByRole('status', { name: 'Loading project card' })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(12);
  });
});
