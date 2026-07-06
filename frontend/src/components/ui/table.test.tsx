import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

describe('Table text boundaries', () => {
  it('sanitizes table, caption, header, row, and cell text/accessibility attributes', () => {
    const { container } = render(
      <Table
        aria-label={'\u001b]0;Hidden table\u0007\u001b[31mRevenue\u0000 table'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mRevenue\u0007'}
      >
        <TableCaption
          aria-label={'\u001b]0;Hidden caption\u0007\u001b[33mCaption\u0000'}
          title={'\u001b]0;Hidden caption title\u0007\u001b[34mCaption title\u0007'}
        >
          {'\u001b]0;Hidden caption text\u0007\u001b[35mQuarterly revenue\u0000'}
        </TableCaption>
        <TableHeader aria-label={'\u001b]0;Hidden header\u0007\u001b[36mHeader\u0007'}>
          <TableRow aria-label={'\u001b]0;Hidden row\u0007\u001b[31mHeader row\u0000'}>
            <TableHead
              scope='col'
              aria-label={'\u001b]0;Hidden head\u0007\u001b[32mQuarter\u0007'}
              title={'\u001b]0;Hidden head title\u0007\u001b[33mQuarter title\u0000'}
            >
              {'\u001b]0;Hidden head text\u0007\u001b[34mQuarter\u0007'}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow title={'\u001b]0;Hidden body row\u0007\u001b[35mQ1 row\u0000'}>
            <TableCell colSpan={1}>
              {'\u001b]0;Hidden cell\u0007\u001b[36mQ1\u0007'}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    expect(screen.getByRole('table', { name: 'Revenue table' })).toHaveAttribute(
      'title',
      'Revenue'
    );
    expect(screen.getByText('Quarterly revenue')).toHaveAttribute(
      'aria-label',
      'Caption'
    );
    expect(screen.getByText('Quarterly revenue')).toHaveAttribute(
      'title',
      'Caption title'
    );
    expect(screen.getByText('Quarter')).toHaveAttribute('scope', 'col');
    expect(screen.getByText('Quarter')).toHaveAttribute(
      'aria-label',
      'Quarter'
    );
    expect(screen.getByText('Quarter')).toHaveAttribute(
      'title',
      'Quarter title'
    );
    expect(screen.getByText('Q1')).toHaveAttribute('colspan', '1');
    expect(screen.getByText('Q1').textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('Hidden');
  });

  it('sanitizes footer text and omits empty sanitized accessibility text', () => {
    const { container } = render(
      <Table
        aria-label={'\u001b]0;Hidden table\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      >
        <TableFooter
          aria-label={'\u001b]0;Hidden footer\u0007\u001b[32m\u0000'}
          title={'\u0008'}
        >
          <TableRow>
            <TableCell>
              {'\u001b]0;Hidden total\u0007\u001b[33mTotal\u0000'}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );

    const table = screen.getByRole('table');
    const footer = screen.getByText('Total').closest('tfoot');

    expect(table).not.toHaveAttribute('aria-label');
    expect(table).not.toHaveAttribute('title');
    expect(footer).not.toHaveAttribute('aria-label');
    expect(footer).not.toHaveAttribute('title');
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Hidden');
  });

  it('preserves rich child nodes', () => {
    render(
      <Table aria-label='rich table'>
        <TableBody>
          <TableRow>
            <TableCell>
              <span data-testid='rich-child'>{'\u001b[33mKeep\u0000 raw'}</span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
  });
});
