/* Polyfill Node.js Buffer for browser (needed by libraries like gray-matter) */
import { Buffer as BufferPolyfill } from 'buffer';

// Define Buffer globally if not present
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g: any = (typeof globalThis !== 'undefined' ? globalThis : window) as any;
if (g && !g.Buffer) {
  g.Buffer = BufferPolyfill;
}
