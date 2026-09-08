import type { PropsWithChildren } from 'react';

/** No router, provider, network, or storage ownership is introduced here. */
export function PublicShell({ children }: PropsWithChildren) {
  return (
    <div className="ui-public-shell fn-app">
      <a className="ui-skip-link" href="#main-content">본문으로 이동</a>
      {children}
    </div>
  );
}
