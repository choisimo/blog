import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// Tail events include request headers. Retain them only in memory, and emit
// exclusively the fixed-format state transport diagnostics, never raw events.
let captured = '';
const child = spawn('npx', ['wrangler', 'tail', '--env', 'production', '--format', 'json'], {
  cwd: 'workers/api-gateway', detached: true, stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', chunk => { if (captured.length < 8 * 1024 * 1024) captured += chunk.toString(); });
child.stderr.on('data', () => {});
const completion = new Promise(resolve => { child.once('error', () => resolve()); child.once('close', resolve); });
try {
  await delay(8000);
  const r = await fetch('https://api.nodove.com/api/v1/auth/anonymous', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(25000),
  });
  const payload = await r.json().catch(() => ({}));
  console.log(`Anonymous admission probe: HTTP ${r.status}; ok=${payload.ok === true}`);
  await delay(12000);
} finally {
  if (child.pid) { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
  await Promise.race([completion, delay(3000)]);
  const diagnostics = [...new Set(captured.match(/\[backend-state\] phase=(?:transport|decode|response) status=\d{1,3} code=[A-Z0-9_]{1,80}/g) || [])];
  console.log(JSON.stringify({ diagnostics }));
}
