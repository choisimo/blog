import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-resizable-panels', async () => {

  type PanelGroupProps = ReactTypes.HTMLAttributes<HTMLDivElement> & {
    direction?: 'horizontal' | 'vertical';
  };

  const PanelGroup = ({
    children,
    direction = 'horizontal',
    ...props
  }: PanelGroupProps) => (
    <div
      data-panel-group-direction={direction}
      data-testid='panel-group'
      {...props}
    >
      {children}
    </div>
  );

  type PanelProps = ReactTypes.HTMLAttributes<HTMLDivElement> & {
    defaultSize?: number;
    id?: string;
    order?: number;
  };

  const Panel = ({ children, defaultSize, id, order, ...props }: PanelProps) => (
    <div
      data-default-size={defaultSize}
      data-order={order}
      data-panel-id={id}
      data-testid='panel'
      {...props}
    >
      {children}
    </div>
  );

  const PanelResizeHandle = ({
    children,
    ...props
  }: ReactTypes.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid='handle' {...props}>
      {children}
    </div>
  );

  return {
    Panel,
    PanelGroup,
    PanelResizeHandle,
  };
});

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from './resizable';

describe('Resizable text boundaries', () => {
  it('sanitizes group and panel text/accessibility attributes while preserving layout props', () => {
    render(
      <ResizablePanelGroup
        direction='vertical'
        aria-label={'\u001b]0;Hidden group\u0007\u001b[31mEditor\u0000 panes'}
        title={'\u001b]0;Hidden layout\u0007\u001b[32mLayout\u0007'}
      >
        <ResizablePanel
          id='left'
          order={1}
          defaultSize={40}
          aria-label={'\u001b]0;Hidden panel\u0007\u001b[33mLeft\u0000 pane'}
          title={'\u001b]0;Hidden left\u0007\u001b[34mLeft\u0007'}
        >
          {'\u001b]0;Hidden content\u0007\u001b[35mPanel content\u0000'}
        </ResizablePanel>
      </ResizablePanelGroup>
    );

    expect(screen.getByTestId('panel-group')).toHaveAttribute(
      'aria-label',
      'Editor panes'
    );
    expect(screen.getByTestId('panel-group')).toHaveAttribute(
      'data-panel-group-direction',
      'vertical'
    );
    expect(screen.getByTestId('panel-group')).toHaveAttribute('title', 'Layout');
    expect(screen.getByTestId('panel')).toHaveAttribute(
      'aria-label',
      'Left pane'
    );
    expect(screen.getByTestId('panel')).toHaveAttribute('data-panel-id', 'left');
    expect(screen.getByTestId('panel')).toHaveAttribute('data-order', '1');
    expect(screen.getByTestId('panel')).toHaveAttribute(
      'data-default-size',
      '40'
    );
    expect(screen.getByTestId('panel')).toHaveTextContent('Panel content');
    expect(screen.getByTestId('panel').textContent).not.toContain('\u001b');
    expect(screen.getByTestId('panel').textContent).not.toContain('Hidden');
  });

  it('sanitizes handle text/accessibility attributes while preserving grip rendering', () => {
    render(
      <ResizableHandle
        withHandle
        aria-label={'\u001b]0;Hidden handle\u0007\u001b[31mResize\u0000 panes'}
        title={'\u001b]0;Hidden resize\u0007\u001b[32mResize\u0007'}
      >
        {'\u001b]0;Hidden drag\u0007\u001b[33mDrag\u0000'}
      </ResizableHandle>
    );

    expect(screen.getByTestId('handle')).toHaveAttribute(
      'aria-label',
      'Resize panes'
    );
    expect(screen.getByTestId('handle')).toHaveAttribute('title', 'Resize');
    expect(screen.getByTestId('handle')).toHaveTextContent('Drag');
    expect(screen.getByTestId('handle').textContent).not.toContain('Hidden');
    expect(screen.getByTestId('handle').querySelector('svg')).toBeInTheDocument();
  });

  it('omits empty sanitized accessibility text and preserves rich child nodes', () => {
    render(
      <ResizablePanelGroup
        direction='horizontal'
        aria-label={'\u001b]0;Hidden group\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      >
        <ResizablePanel>
          <span data-testid='rich-child'>{'\u001b[33mKeep\u0000 raw'}</span>
        </ResizablePanel>
      </ResizablePanelGroup>
    );

    expect(screen.getByTestId('panel-group')).not.toHaveAttribute('aria-label');
    expect(screen.getByTestId('panel-group')).not.toHaveAttribute('title');
    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
  });
});
