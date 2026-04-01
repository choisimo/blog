/**
 * Chat Service - Stream Parser
 *
 * SSE/NDJSON 스트림 파싱 유틸리티
 */

import type { ChatStreamEvent } from "./types";

/**
 * 응답 객체에서 텍스트 추출
 */
export function extractTexts(obj: unknown): string[] {
  const out: string[] = [];
  if (!obj || typeof obj !== "object") return out;
  const o = obj as Record<string, unknown>;

  if (typeof o.text === "string") out.push(o.text);
  if (typeof o.content === "string") out.push(o.content);

  if (Array.isArray(o.parts)) {
    for (const p of o.parts) {
      if (p && typeof p === 'object') {
        const part = p as Record<string, unknown>;
        if (typeof part.text === "string") out.push(part.text);
        else if (typeof part.content === "string") out.push(part.content);
      }
    }
  }

  if (o.message && typeof o.message === 'object') {
    const msg = o.message as Record<string, unknown>;
    if (typeof msg.content === "string") out.push(msg.content);
  }

  if (Array.isArray(o.choices)) {
    for (const c of o.choices) {
      if (c && typeof c === 'object') {
        const ch = c as Record<string, unknown>;
        const delta = ch.delta && typeof ch.delta === 'object'
          ? (ch.delta as Record<string, unknown>).content
          : undefined;
        const msg = ch.message && typeof ch.message === 'object'
          ? (ch.message as Record<string, unknown>).content
          : undefined;
        const text = delta ?? msg;
        if (typeof text === "string") out.push(text);
      }
    }
  }

  if (typeof o.delta === "string") out.push(o.delta);

  return out;
}

/**
 * JSON 객체를 ChatStreamEvent로 변환
 */
export function parseStreamObject(obj: unknown): ChatStreamEvent[] {
  const events: ChatStreamEvent[] = [];
  if (!obj || typeof obj !== 'object') return events;
  const o = obj as Record<string, unknown>;

  if (o.type === "session" && typeof o.sessionId === "string") {
    events.push({ type: "session", sessionId: o.sessionId });
  }

  if (o.type === "error") {
    const message =
      (typeof o.error === "string" && o.error) ||
      (typeof o.message === "string" && o.message) ||
      "Chat failed";
    const code = typeof o.code === "string" ? o.code : undefined;
    events.push({ type: "error", message, code });
  }

  if (o.type === "done") {
    events.push({ type: "done" });
  }

  const texts = extractTexts(obj);
  for (const t of texts) {
    if (t) events.push({ type: "text", text: t });
  }

  const srcs = o.sources;
  if (Array.isArray(srcs)) {
    events.push({ type: "sources", sources: srcs });
  }

  const fups = o.followups ?? o.suggestions;
  if (Array.isArray(fups)) {
    events.push({ type: "followups", questions: fups });
  }

  const ctx = o.context;
  if (ctx && typeof ctx === "object") {
    const ctxObj = ctx as Record<string, unknown>;
    events.push({ type: "context", page: ctxObj.page ?? ctx });
  }

  return events;
}

/**
 * SSE 프레임 파싱
 */
export function parseSSEFrame(frame: string): {
  data: string;
  event?: string;
} | null {
  const lines = frame.split(/\r?\n/);
  const datas: string[] = [];
  let evt: string | undefined;

  for (const raw of lines) {
    const ln = raw.replace(/\r$/, "");
    if (!ln || ln.startsWith(":")) continue;

    const sep = ln.indexOf(":");
    const field = sep >= 0 ? ln.slice(0, sep) : ln;
    let value = sep >= 0 ? ln.slice(sep + 1) : "";
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "data") datas.push(value);
    else if (field === "event") evt = value;
  }

  const data = datas.join("\n");
  if (!data) return null;

  return { data, event: evt };
}

function findSSEFrameBoundary(
  buffer: string,
): { index: number; size: number } | null {
  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");

  if (lf < 0 && crlf < 0) return null;
  if (lf < 0) return { index: crlf, size: 4 };
  if (crlf < 0) return { index: lf, size: 2 };
  return lf < crlf ? { index: lf, size: 2 } : { index: crlf, size: 4 };
}

/**
 * First Token 타이밍 트래커
 */
export function createFirstTokenTracker(
  onFirstToken?: (ms: number) => void,
): () => void {
  const started =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  let firstEmitted = false;

  return () => {
    if (!firstEmitted) {
      firstEmitted = true;
      const now =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now();
      if (typeof onFirstToken === "function") {
        onFirstToken(Math.max(0, Math.round(now - started)));
      }
    }
  };
}

/**
 * 스트림 타입별 파서
 */
export type StreamParser = {
  processChunk: (chunk: string) => ChatStreamEvent[];
  flush: () => ChatStreamEvent[];
};

export function createSSEParser(): StreamParser {
  let buffer = "";

  const parseFrame = (frame: string): ChatStreamEvent[] => {
    const parsed = parseSSEFrame(frame);
    if (!parsed) return [];

    const { data, event } = parsed;

    if (data === "[DONE]" || event === "done") {
      return [{ type: "done" }];
    }

    if (event === "error") {
      return [{ type: "error", message: data || "Chat failed" }];
    }

    try {
      const obj = JSON.parse(data);
      return parseStreamObject(obj);
    } catch {
      // JSON 파싱 실패 시 텍스트로 처리
      return [{ type: "text", text: data }];
    }
  };

  return {
    processChunk(chunk: string): ChatStreamEvent[] {
      buffer += chunk;
      const events: ChatStreamEvent[] = [];

      while (true) {
        const boundary = findSSEFrameBoundary(buffer);
        if (!boundary) break;

        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.size);
        events.push(...parseFrame(frame));
      }

      return events;
    },
    flush(): ChatStreamEvent[] {
      const remaining = buffer.trim();
      buffer = "";
      if (!remaining) return [];
      return parseFrame(remaining);
    },
  };
}

export function createNDJSONParser(): StreamParser {
  let buffer = "";

  return {
    processChunk(chunk: string): ChatStreamEvent[] {
      buffer += chunk;
      const events: ChatStreamEvent[] = [];

      while (true) {
        const nl = buffer.indexOf("\n");
        if (nl < 0) break;

        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);

        if (!line) continue;

        if (line === "[DONE]") {
          events.push({ type: "done" });
          continue;
        }

        try {
          const obj = JSON.parse(line);
          events.push(...parseStreamObject(obj));
        } catch {
          events.push({ type: "text", text: line });
        }
      }

      return events;
    },
    flush(): ChatStreamEvent[] {
      const events: ChatStreamEvent[] = [];
      const lines = buffer.split("\n");

      for (const s of lines) {
        const line = s.trim();
        if (!line) continue;

        if (line === "[DONE]") {
          events.push({ type: "done" });
          continue;
        }

        try {
          const obj = JSON.parse(line);
          events.push(...parseStreamObject(obj));
        } catch {
          events.push({ type: "text", text: line });
        }
      }

      buffer = "";
      return events;
    },
  };
}

export function createJSONParser(): StreamParser {
  let buffer = "";

  return {
    processChunk(chunk: string): ChatStreamEvent[] {
      buffer += chunk;
      return []; // JSON은 끝까지 모아서 파싱
    },
    flush(): ChatStreamEvent[] {
      if (!buffer) return [];

      try {
        const obj = JSON.parse(buffer);
        return parseStreamObject(obj);
      } catch {
        return [{ type: "text", text: buffer }];
      }
    },
  };
}

export function createPlainTextParser(): StreamParser {
  return {
    processChunk(chunk: string): ChatStreamEvent[] {
      return [{ type: "text", text: chunk }];
    },
    flush(): ChatStreamEvent[] {
      return [];
    },
  };
}

/**
 * Content-Type에 따른 파서 선택
 */
export function getParserForContentType(contentType: string): StreamParser {
  const ct = contentType.toLowerCase();

  if (ct.includes("text/event-stream")) {
    return createSSEParser();
  }
  if (ct.includes("ndjson") || ct.includes("jsonl")) {
    return createNDJSONParser();
  }
  if (ct.includes("application/json")) {
    return createJSONParser();
  }
  if (ct.includes("text/plain")) {
    return createPlainTextParser();
  }

  // 기본값: SSE
  return createSSEParser();
}
