export type SSEFrame = {
  event: string | null;
  data: string;
};

export function findSSEFrameBoundary(
  buffer: string,
): { index: number; size: number } | null {
  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");

  if (lf < 0 && crlf < 0) return null;
  if (lf < 0) return { index: crlf, size: 4 };
  if (crlf < 0) return { index: lf, size: 2 };
  return lf < crlf ? { index: lf, size: 2 } : { index: crlf, size: 4 };
}

export function parseSSEFrame(frameText: string): SSEFrame | null {
  const lines = frameText.split(/\r?\n/);
  let event: string | null = null;
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    if (!line) continue;
    if (line.startsWith(":")) continue;

    if (line.startsWith("event:")) {
      event = line.slice(6).trim() || null;
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}
