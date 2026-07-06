import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/components/ui/button', async () => {
  const React = await import('react');

  type ButtonProps = ReactTypes.ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: string;
    variant?: string;
  };

  const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ children, size, variant, ...props }, ref) => (
      <button
        ref={ref}
        data-size={size}
        data-variant={variant}
        type='button'
        {...props}
      >
        {children}
      </button>
    )
  );
  Button.displayName = 'Button';

  return { Button };
});

vi.mock('@/components/ui/input', async () => {
  const React = await import('react');

  const Input = React.forwardRef<
    HTMLInputElement,
    ReactTypes.InputHTMLAttributes<HTMLInputElement>
  >((props, ref) => <input ref={ref} {...props} />);
  Input.displayName = 'Input';

  return { Input };
});

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children?: ReactTypes.ReactNode }) => (
    <>{children}</>
  ),
  TooltipContent: ({ children }: { children?: ReactTypes.ReactNode }) => (
    <>{children}</>
  ),
  TooltipProvider: ({ children }: { children?: ReactTypes.ReactNode }) => (
    <>{children}</>
  ),
  TooltipTrigger: ({ children }: { children?: ReactTypes.ReactNode }) => (
    <>{children}</>
  ),
}));

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from './sidebar';

describe('Sidebar text boundaries', () => {
  it('sanitizes provider and sidebar text/accessibility attributes', () => {
    render(
      <SidebarProvider
        aria-label={'\u001b[31mLayout\u0000 wrapper'}
        title={'\u001b[32mWrapper\u0007'}
      >
        <Sidebar
          collapsible='none'
          aria-label={'\u001b[33mPrimary\u0000 sidebar'}
          title={'\u001b[34mSidebar\u0007'}
        >
          {'\u001b[35mNavigation\u0000'}
        </Sidebar>
      </SidebarProvider>
    );

    expect(screen.getByLabelText('Layout wrapper')).toHaveAttribute(
      'title',
      'Wrapper'
    );
    expect(screen.getByLabelText('Primary sidebar')).toHaveAttribute(
      'title',
      'Sidebar'
    );
    expect(screen.getByLabelText('Primary sidebar')).toHaveTextContent(
      'Navigation'
    );
    expect(screen.getByLabelText('Primary sidebar').textContent).not.toContain(
      '\u001b'
    );
  });

  it('sanitizes trigger, rail, inset, input, and header text/accessibility attributes', () => {
    render(
      <SidebarProvider>
        <SidebarTrigger
          aria-label={'\u001b[31mOpen\u0000 sidebar'}
          title={'\u001b[32mTrigger\u0007'}
        >
          {'\u001b[33mMenu\u0000'}
        </SidebarTrigger>
        <SidebarRail
          aria-label={'\u001b[34mResize\u0000 sidebar'}
          title={'\u001b[35mRail\u0007'}
        >
          {'\u001b[36mRail text\u0007'}
        </SidebarRail>
        <SidebarInset
          aria-label={'\u001b[31mContent\u0000 area'}
          title={'\u001b[32mContent\u0007'}
        >
          {'\u001b[33mMain content\u0000'}
        </SidebarInset>
        <SidebarInput
          aria-label={'\u001b[34mSearch\u0000 sidebar'}
          placeholder={'\u001b[35mFilter\u0007'}
          title={'\u001b[36mSearch\u0000'}
        />
        <SidebarHeader
          aria-label={'\u001b[31mHeader\u0000 section'}
          title={'\u001b[32mHeader\u0007'}
        >
          {'\u001b[33mHeader text\u0000'}
        </SidebarHeader>
      </SidebarProvider>
    );

    const trigger = screen.getByRole('button', { name: /Open sidebar/ });
    const rail = screen.getByRole('button', { name: /Resize sidebar/ });
    const input = screen.getByRole('textbox', { name: 'Search sidebar' });

    expect(trigger).toHaveAttribute('title', 'Trigger');
    expect(trigger).toHaveTextContent('Menu');
    expect(trigger).toHaveTextContent('Toggle Sidebar');
    expect(rail).toHaveAttribute('title', 'Rail');
    expect(rail).toHaveTextContent('Rail text');
    expect(screen.getByLabelText('Content area')).toHaveAttribute(
      'title',
      'Content'
    );
    expect(screen.getByLabelText('Content area')).toHaveTextContent(
      'Main content'
    );
    expect(input).toHaveAttribute('placeholder', 'Filter');
    expect(input).toHaveAttribute('title', 'Search');
    expect(screen.getByLabelText('Header section')).toHaveAttribute(
      'title',
      'Header'
    );
    expect(screen.getByLabelText('Header section')).toHaveTextContent(
      'Header text'
    );
  });

  it('omits empty sanitized accessibility text and preserves rich child nodes', () => {
    render(
      <SidebarProvider aria-label={'\u001b[31m\u0000'} title={'\u0007'}>
        <Sidebar collapsible='none'>
          <span data-testid='rich-child'>{'\u001b[33mKeep\u0000 raw'}</span>
        </Sidebar>
      </SidebarProvider>
    );

    expect(screen.getByTestId('rich-child').closest('.group\\/sidebar-wrapper')).not.toHaveAttribute(
      'aria-label'
    );
    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
  });

  it('sanitizes footer, content, group, label, action, and separator boundaries', () => {
    render(
      <SidebarProvider>
        <SidebarFooter
          aria-label={'\u001b[31mFooter\u0000 area'}
          title={'\u001b[32mFooter\u0007'}
        >
          {'\u001b[33mFooter text\u0000'}
        </SidebarFooter>
        <SidebarContent
          aria-label={'\u001b[34mContent\u0000 area'}
          title={'\u001b[35mContent\u0007'}
        >
          {'\u001b[36mContent text\u0007'}
        </SidebarContent>
        <SidebarGroup
          aria-label={'\u001b[31mGroup\u0000 area'}
          title={'\u001b[32mGroup\u0007'}
        >
          <SidebarGroupLabel
            aria-label={'\u001b[33mGroup\u0000 label'}
            title={'\u001b[34mLabel\u0007'}
          >
            {'\u001b[35mProjects\u0000'}
          </SidebarGroupLabel>
          <SidebarGroupAction
            aria-label={'\u001b[36mAdd\u0007 project'}
            title={'\u001b[31mAdd\u0000'}
          >
            {'\u001b[32m+\u0007'}
          </SidebarGroupAction>
          <SidebarGroupContent
            aria-label={'\u001b[33mGroup\u0000 content'}
            title={'\u001b[34mGroup content\u0007'}
          >
            {'\u001b[35mGroup body\u0000'}
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator
          data-testid='sidebar-separator'
          aria-label={'\u001b[36mSeparator\u0007'}
          title={'\u001b[31mBreak\u0000'}
        />
      </SidebarProvider>
    );

    expect(screen.getByLabelText('Footer area')).toHaveAttribute(
      'title',
      'Footer'
    );
    expect(screen.getByLabelText('Footer area')).toHaveTextContent(
      'Footer text'
    );
    expect(screen.getByLabelText('Content area')).toHaveAttribute(
      'title',
      'Content'
    );
    expect(screen.getByLabelText('Content area')).toHaveTextContent(
      'Content text'
    );
    expect(screen.getByLabelText('Group area')).toHaveAttribute(
      'title',
      'Group'
    );
    expect(screen.getByLabelText('Group label')).toHaveTextContent('Projects');
    expect(screen.getByRole('button', { name: 'Add project' })).toHaveAttribute(
      'title',
      'Add'
    );
    expect(screen.getByLabelText('Group content')).toHaveTextContent(
      'Group body'
    );
    expect(screen.getByTestId('sidebar-separator')).toHaveAttribute(
      'aria-label',
      'Separator'
    );
    expect(screen.getByTestId('sidebar-separator')).toHaveAttribute(
      'title',
      'Break'
    );
  });

  it('sanitizes menu item, button, action, badge, skeleton, and sub-menu boundaries', () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <SidebarMenu
          aria-label={'\u001b[31mPrimary\u0000 menu'}
          title={'\u001b[32mMenu\u0007'}
        >
          <SidebarMenuItem
            aria-label={'\u001b[33mMenu\u0000 item'}
            title={'\u001b[34mItem\u0007'}
          >
            <SidebarMenuButton
              aria-label={'\u001b[35mDashboard\u0000'}
              title={'\u001b[36mDashboard title\u0007'}
              tooltip={'\u001b[31mDashboard tooltip\u0000'}
            >
              {'\u001b[32mDashboard\u0007'}
            </SidebarMenuButton>
            <SidebarMenuAction
              aria-label={'\u001b[33mMore\u0000 actions'}
              title={'\u001b[34mMore\u0007'}
            >
              {'\u001b[35m...\u0000'}
            </SidebarMenuAction>
            <SidebarMenuBadge
              aria-label={'\u001b[36mUnread\u0007 count'}
              title={'\u001b[31mCount\u0000'}
            >
              {'\u001b[32m12\u0007'}
            </SidebarMenuBadge>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenuSkeleton
          aria-label={'\u001b[33mLoading\u0000 menu'}
          title={'\u001b[34mLoading\u0007'}
          showIcon
        />
        <SidebarMenuSub
          aria-label={'\u001b[35mSub\u0000 menu'}
          title={'\u001b[36mSub\u0007'}
        >
          <SidebarMenuSubItem
            aria-label={'\u001b[31mSub\u0000 item'}
            title={'\u001b[32mSub item\u0007'}
          >
            <SidebarMenuSubButton
              href='/docs'
              aria-label={'\u001b[33mDocs\u0000'}
              title={'\u001b[34mDocs title\u0007'}
            >
              {'\u001b[35mDocs\u0000'}
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        </SidebarMenuSub>
      </SidebarProvider>
    );

    expect(screen.getByLabelText('Primary menu')).toHaveAttribute(
      'title',
      'Menu'
    );
    expect(screen.getByLabelText('Menu item')).toHaveAttribute('title', 'Item');
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute(
      'title',
      'Dashboard title'
    );
    expect(screen.getByText('Dashboard tooltip')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions' })).toHaveTextContent(
      '...'
    );
    expect(screen.getByLabelText('Unread count')).toHaveTextContent('12');
    expect(screen.getByLabelText('Loading menu')).toHaveAttribute(
      'title',
      'Loading'
    );
    expect(screen.getByLabelText('Sub menu')).toHaveAttribute('title', 'Sub');
    expect(screen.getByLabelText('Sub item')).toHaveAttribute(
      'title',
      'Sub item'
    );
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'href',
      '/docs'
    );
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'title',
      'Docs title'
    );
  });
});
