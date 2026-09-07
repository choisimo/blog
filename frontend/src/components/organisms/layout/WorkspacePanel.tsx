import { useId, type HTMLAttributes, type ReactNode } from 'react';

interface WorkspacePanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title' | 'aria-labelledby'> {
  id: string;
  title: string;
  as?: 'aside' | 'section';
  headingLevel?: 2 | 3;
  description?: string;
  actions?: ReactNode;
  footer?: ReactNode;
}

/** Presentation only: no local open state, data copy, request, modal, or extra main landmark. */
export function WorkspacePanel({ id, title, as: Element = 'section', headingLevel = 2,
  description, actions, footer, children, className = '', ...props }: WorkspacePanelProps) {
  const uniqueId = useId();
  const headingId = `${uniqueId}-heading`;
  const descriptionId = `${uniqueId}-description`;
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  return <Element {...props} id={id} className={`ui-workspace-panel ${className}`.trim()}
    aria-labelledby={headingId} aria-describedby={[description && descriptionId, props['aria-describedby']].filter(Boolean).join(' ') || undefined}>
    <header className="ui-workspace-panel__header">
      <div className="ui-workspace-panel__copy">
        <Heading id={headingId} className="ui-workspace-panel__title">{title}</Heading>
        {description && <p id={descriptionId} className="ui-workspace-panel__description">{description}</p>}
      </div>
      {actions && <div className="ui-workspace-panel__actions">{actions}</div>}
    </header>
    <div className="ui-workspace-panel__body">{children}</div>
    {footer && <footer className="ui-workspace-panel__footer">{footer}</footer>}
  </Element>;
}
