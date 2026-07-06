export type SSEFrame = {
  event: string | null;
  data: string;
};

export const MAX_SSE_FRAME_CHARS = 1_000_000;

export function findSSEFrameBoundary(
  buffer: string,
): { index: number; size: number } | null {
  if (typeof buffer !== "string" || !buffer) return null;

  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");

  if (lf < 0 && crlf < 0) return null;
  if (lf < 0) return { index: crlf, size: 4 };
  if (crlf < 0) return { index: lf, size: 2 };
  return lf < crlf ? { index: lf, size: 2 } : { index: crlf, size: 4 };
}

function normalizeEventName(value: string): string | null {
  const normalized = value.trim();
  if (!normalized || !/^[A-Za-z0-9_.:-]+$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function stripUnsafeDataControls(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

export function parseSSEFrame(frameText: string): SSEFrame | null {
  if (
    typeof frameText !== "string" ||
    frameText.length > MAX_SSE_FRAME_CHARS ||
    !frameText.trim()
  ) {
    return null;
  }

  const lines = frameText.split(/\r?\n/);
  let event: string | null = null;
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    if (!line) continue;
    if (line.startsWith(":")) continue;

    if (line.startsWith("event:")) {
      event = normalizeEventName(line.slice(6));
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(stripUnsafeDataControls(line.slice(5).trimStart()));
    }
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}
