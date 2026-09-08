import type { PropsWithChildren, ReactNode } from 'react';

interface WorkspaceShellProps extends PropsWithChildren {
  className?: string;
  contentClassName?: string;
  header?: ReactNode;
  navigation?: ReactNode;
}

/** The route owns main and authorization; this component only arranges its children. */
export function WorkspaceShell({ children, className = '', contentClassName = '', header, navigation }: WorkspaceShellProps) {
  return (
    <div className={`ui-workspace ${className}`}>
      {header}
      <div className={navigation ? 'ui-workspace-body ui-workspace-with-nav' : 'ui-workspace-body'}>
        {navigation}
        <div className={`ui-workspace-content ${contentClassName}`}>{children}</div>
      </div>
    </div>
  );
}
