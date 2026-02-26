/**
 * Chat Service - Stream Parser
 *
 * SSE/NDJSON 스트림 파싱 유틸리티
 */

import type { ChatStreamEvent } from "./types";

/**
 * 응답 객체에서 텍스트 추출
 */
export function extractTexts(obj: any): string[] {
  const out: string[] = [];
  if (!obj || typeof obj !== "object") return out;

  // 직접 text (백엔드 SSE 형식: { type: 'text', text: '...' })
  if (typeof obj.text === "string") out.push(obj.text);

  // 직접 content
  if (typeof obj.content === "string") out.push(obj.content);

  // parts 배열
  if (Array.isArray(obj.parts)) {
    for (const p of obj.parts) {
      if (p) {
        if (typeof (p as any).text === "string") out.push((p as any).text);
        else if (typeof (p as any).content === "string")
          out.push((p as any).content);
      }
    }
  }

  // message.content
  if (obj.message && typeof obj.message.content === "string") {
    out.push(obj.message.content);
  }

  // OpenAI 스타일 choices
  if (Array.isArray(obj.choices)) {
    for (const c of obj.choices) {
      const delta = c?.delta?.content ?? c?.message?.content;
      if (typeof delta === "string") out.push(delta);
    }
  }

  // delta 필드
  if (typeof obj.delta === "string") out.push(obj.delta);

  return out;
}

/**
 * JSON 객체를 ChatStreamEvent로 변환
 */
export function parseStreamObject(obj: any): ChatStreamEvent[] {
  const events: ChatStreamEvent[] = [];

  // 세션 이벤트
  if (obj?.type === "session" && typeof obj?.sessionId === "string") {
    events.push({ type: "session", sessionId: obj.sessionId });
  }

  // 에러 이벤트
  if (obj?.type === "error") {
    const message =
      (typeof obj?.error === "string" && obj.error) ||
      (typeof obj?.message === "string" && obj.message) ||
      "Chat failed";
    const code = typeof obj?.code === "string" ? obj.code : undefined;
    events.push({ type: "error", message, code });
  }

  // 완료 이벤트
  if (obj?.type === "done") {
    events.push({ type: "done" });
  }

  // 텍스트 추출
  const texts = extractTexts(obj);
  for (const t of texts) {
    if (t) events.push({ type: "text", text: t });
  }

  // 소스
  const srcs = obj?.sources;
  if (Array.isArray(srcs)) {
    events.push({ type: "sources", sources: srcs });
  }

  // 후속 질문
  const fups = obj?.followups || obj?.suggestions;
  if (Array.isArray(fups)) {
    events.push({ type: "followups", questions: fups });
  }

  // 컨텍스트
  const ctx = obj?.context;
  if (ctx && typeof ctx === "object") {
    events.push({ type: "context", page: ctx.page || ctx });
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
