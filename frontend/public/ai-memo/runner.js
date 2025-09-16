'use strict';
// Minimal iframe sandbox runtime for Dev Mode (placeholder for now)
// Receives context via postMessage and exposes to window.context
(() => {
  window.context = {};
  window.addEventListener('message', e => {
    const data = e?.data;
    if (!data) return;
    if (data.type === 'init' && data.context) {
      window.context = data.context;
      if (typeof window.onContextReady === 'function') {
        try {
          window.onContextReady();
        } catch (_) {}
      }
    }
  });
})();
