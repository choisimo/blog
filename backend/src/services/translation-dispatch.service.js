/** Best-effort signal transport only. D1 jobs/outbox, not this process, own execution state. */
export function createTranslationDispatcher({ workerApiUrl, backendKey, fetchImpl = fetch, onError = () => {} }) {
  let active = null;
  let signalled = false;
  let endpoint = null;
  try {
    const url = new URL(workerApiUrl);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid Worker origin');
    endpoint = new URL('/api/v1/internal/translations/drain', url).href;
  } catch { /* Incomplete configuration must not silently report a usable executor. */ }
  async function drainOnce() {
    const response = await fetchImpl(endpoint, {
      method: 'POST', headers: { 'X-Backend-Key': backendKey, Accept: 'text/event-stream', 'Content-Type': 'application/json' },
      body: '{}', signal: AbortSignal.timeout(300_000), redirect: 'error',
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream') || !response.body) {
      await response.body?.cancel();
      throw new Error('Translation executor did not accept the callback');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', bytes = 0, done = null;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 65_536) throw new Error('Unexpected translation executor response');
        buffer += decoder.decode(chunk.value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
          if (!frame.startsWith('data: ')) continue;
          const value = JSON.parse(frame.slice(6));
          if (value.type === 'error') throw new Error('Translation executor is unavailable');
          if (value.type === 'done') done = value;
        }
      }
      if (!done) throw new Error('Translation execution observation disconnected');
      return Number(done.processed || 0) + Number(done.failed || 0) + Number(done.deferred || 0);
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  return {
    configured: Boolean(endpoint && backendKey),
    wake() {
      if (!endpoint || !backendKey) return false;
      signalled = true;
      if (!active) {
        active = Promise.resolve().then(async () => {
          // Coalesce overlapping wakes, but bound one pump. Cron recovers missed tail work.
          for (let index = 0; index < 4 && signalled; index++) {
            signalled = false;
            const count = await drainOnce();
            if (count > 0) signalled = true;
          }
        }).catch(() => onError('TRANSLATION_DISPATCH_UNAVAILABLE')).finally(() => { active = null; });
      }
      return true;
    },
    idle() { return active || Promise.resolve(); },
  };
}
