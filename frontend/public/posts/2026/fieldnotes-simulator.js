// Only the three authored paging simulators opt into this presentation adapter.
// Same-origin theme updates leave simulator inputs, timers and algorithm state intact.
(() => {
  let parentRoot;
  try {
    if (window.parent !== window && window.parent.location.origin === window.location.origin) {
      parentRoot = window.parent.document.documentElement;
    }
  } catch {
    // A separately hosted parent owns its theme; use the device preference here.
  }
  const preference = window.matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  root.dataset.embedded = String(Boolean(parentRoot));
  const tokens = ['paper', 'ink', 'text', 'muted', 'line', 'soft', 'accent'];
  const sync = () => {
    const theme = parentRoot
      ? parentRoot.classList.contains('terminal') ? 'terminal' : parentRoot.classList.contains('dark') ? 'dark' : 'light'
      : preference.matches ? 'dark' : 'light';
    root.dataset.theme = theme;
    const parentStyle = parentRoot && window.parent.getComputedStyle(parentRoot);
    for (const token of tokens) {
      const value = parentStyle?.getPropertyValue(`--rd-${token}`).trim();
      if (value && theme !== 'terminal') root.style.setProperty(`--embed-${token}`, value);
      else root.style.removeProperty(`--embed-${token}`);
    }
    window.dispatchEvent(new Event('fieldnotes-theme-change'));
  };
  const observer = new MutationObserver(sync);
  let heightFrame = 0;
  const reportHeight = () => {
    if (!parentRoot || heightFrame) return;
    heightFrame = requestAnimationFrame(() => {
      heightFrame = 0;
      window.parent.postMessage({
        type: 'blog-iframe-auto-height',
        height: Math.ceil(document.body.getBoundingClientRect().height),
      }, window.location.origin);
    });
  };
  const sizeObserver = new ResizeObserver(reportHeight);
  const observe = () => {
    if (parentRoot) observer.observe(parentRoot, { attributes: true, attributeFilter: ['class', 'style', 'data-reading-paper'] });
    if (parentRoot) sizeObserver.observe(document.body);
    sync();
    reportHeight();
  };
  preference.addEventListener('change', sync);
  window.addEventListener('pagehide', () => {
    observer.disconnect();
    sizeObserver.disconnect();
    cancelAnimationFrame(heightFrame);
    heightFrame = 0;
  });
  window.addEventListener('message', event => {
    if (event.source === window.parent && event.origin === window.location.origin && event.data?.type === 'blog-iframe-request-height') reportHeight();
  });
  window.addEventListener('pageshow', observe);
  observe();
})();
