import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './breadcrumb';

describe('Breadcrumb', () => {
  it('sanitizes navigation, list, item, link, page, and separator text boundaries', () => {
    const { container } = render(
      <Breadcrumb
        aria-label={'\u001b]0;Hidden trail\u0007\u001b[31mTrail\u0000'}
        title={'\u001b]0;Hidden path\u0007Path\u0007'}
      >
        <BreadcrumbList
          aria-label={'\u001b]0;Hidden steps\u0007\u001b[32mSteps\u0008'}
          title={'\u001b]0;Hidden list\u0007List\u0001'}
          data-testid='breadcrumb-list'
        >
          <BreadcrumbItem
            aria-label={'\u001b]0;Hidden item\u0007\u001b[33mItem\u0002'}
            title={'\u001b]0;Hidden item title\u0007Item title\u0003'}
            data-testid='breadcrumb-item'
          >
            <BreadcrumbLink
              href='/docs'
              aria-label={'\u001b]0;Hidden docs\u0007\u001b[34mDocs\u0004'}
              title={'\u001b]0;Hidden docs title\u0007Docs title\u0005'}
            >
              {'\u001b]0;Hidden docs text\u0007Doc\u0006s'}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator
            aria-label={'\u001b]0;Hidden sep\u0007\u001b[35mSep\u0007'}
            title={'\u001b]0;Hidden sep title\u0007Sep title\u0008'}
            data-testid='breadcrumb-separator'
          >
            {'\u001b]0;Hidden separator text\u0007\u001b[36m/\u0000'}
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage
              aria-label={'\u001b]0;Hidden current\u0007\u001b[37mCurrent\u0009'}
              title={'\u001b]0;Hidden page title\u0007Page title\u000a'}
            >
              {'\u001b]0;Hidden current text\u0007Cur\u000brent'}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );

    const navigation = screen.getByRole('navigation', { name: 'Trail' });
    const list = screen.getByTestId('breadcrumb-list');
    const item = screen.getByTestId('breadcrumb-item');
    const link = screen.getByRole('link', { name: 'Docs' });
    const page = screen.getByRole('link', { name: 'Current' });
    const separator = screen.getByTestId('breadcrumb-separator');

    expect(navigation).toHaveAttribute('title', 'Path');
    expect(list).toHaveAttribute('aria-label', 'Steps');
    expect(list).toHaveAttribute('title', 'List');
    expect(item).toHaveAttribute('aria-label', 'Item');
    expect(item).toHaveAttribute('title', 'Item title');
    expect(link).toHaveTextContent('Docs');
    expect(link).toHaveAttribute('href', '/docs');
    expect(link).toHaveAttribute('title', 'Docs title');
    expect(page).toHaveTextContent('Current');
    expect(page).toHaveAttribute('aria-current', 'page');
    expect(page).toHaveAttribute('aria-disabled', 'true');
    expect(page).toHaveAttribute('title', 'Page title');
    expect(separator).toHaveTextContent('/');
    expect(separator).toHaveAttribute('aria-label', 'Sep');
    expect(separator).toHaveAttribute('aria-hidden', 'true');
    expect(container.textContent).not.toContain('Hidden');
  });

  it('preserves defaults, asChild links, ellipsis content, and empty sanitized text omission', () => {
    const { container } = render(
      <>
        <Breadcrumb>
          <BreadcrumbList
            aria-label={'\u001b]0;Hidden list\u0007\u001b[31m\u0000'}
            title={'\u0007'}
            data-testid='empty-list'
          >
            {'\u0000'}
            <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                aria-label={'\u001b]0;Hidden rich link\u0007\u001b[32mRich link\u0008'}
              >
                <a href='/rich'>
                  <span data-testid='rich-link-child'>Rich node</span>
                </a>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator data-testid='default-separator' />
            <BreadcrumbEllipsis
              aria-label={'\u001b]0;Hidden ellipsis\u0007\u001b[33mMore items\u0009'}
              title={'\u001b]0;Hidden overflow\u0007Overflow\u000a'}
              data-testid='breadcrumb-ellipsis'
            />
          </BreadcrumbList>
        </Breadcrumb>
      </>
    );

    const navigation = screen.getByRole('navigation', { name: 'breadcrumb' });
    const list = screen.getByTestId('empty-list');
    const richLink = screen.getByRole('link', { name: 'Rich link' });
    const defaultSeparator = screen.getByTestId('default-separator');
    const ellipsis = screen.getByTestId('breadcrumb-ellipsis');

    expect(navigation).toBeInTheDocument();
    expect(list).not.toHaveAttribute('aria-label');
    expect(list).not.toHaveAttribute('title');
    expect(richLink).toHaveAttribute('href', '/rich');
    expect(screen.getByTestId('rich-link-child')).toHaveTextContent('Rich node');
    expect(defaultSeparator.querySelector('svg')).toBeInTheDocument();
    expect(ellipsis).toHaveAttribute('aria-label', 'More items');
    expect(ellipsis).toHaveAttribute('title', 'Overflow');
    expect(ellipsis).toHaveTextContent('More');
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0007');
    expect(container.textContent).not.toContain('Hidden');
  });
});
