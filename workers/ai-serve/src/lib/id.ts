export function newSessionId(): string {
  // Simple URL-safe session id prefix 'ses_' + random base36
  const rand = Math.random().toString(36).slice(2) + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  return `ses_${rand.slice(0, 16)}`;
}
