/**
 * AI Console State Management Hook
 * 
 * Supports shared session with ChatWidget via localStorage
 */

import { useReducer, useCallback, useRef, useEffect } from 'react';
import type { ConsoleState, ConsoleAction, ConsoleMode, Citation, TraceEvent, ConsoleMessage } from './types';
import {
  SESSION_MESSAGES_PREFIX,
  getStoredSessionId,
} from '@/services/chat';

const CONSOLE_MESSAGES_KEY = 'ai_console_messages';
const ANSI_ESCAPE_PATTERN = /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g;
const MALFORMED_PERCENT_PATTERN = /%(?![0-9A-Fa-f]{2})/;
const ENCODED_CONTROL_PATTERN = /%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|7[Ff])/;
const ENCODED_SEPARATOR_PATTERN = /%(?:2[Ff]|5[Cc])/;
const CONSOLE_MODES = new Set<ConsoleMode>(['rag', 'agent', 'web']);
const TRACE_TYPES = new Set<TraceEvent['type']>([
  'search',
  'retrieve',
  'generate',
  'tool',
  'error',
]);
const TRACE_STATUSES = new Set<TraceEvent['status']>([
  'pending',
  'running',
  'done',
  'error',
]);

export function normalizeConsoleStateLine(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
}

export function normalizeConsoleStateBody(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

function normalizeConsoleStateChunk(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n');
}

function normalizeConsoleStateUrl(value: unknown): string | undefined {
  const url = normalizeConsoleStateLine(value);
  if (!url || /\s/.test(url)) return undefined;
  if (
    url.includes('\\') ||
    MALFORMED_PERCENT_PATTERN.test(url) ||
    ENCODED_CONTROL_PATTERN.test(url) ||
    ENCODED_SEPARATOR_PATTERN.test(url)
  ) {
    return undefined;
  }
  if (url.startsWith('/') && !url.startsWith('//')) return url;

  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return undefined;
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizeConsoleStateCitation(
  citation: unknown,
  index: number,
): Citation | null {
  if (!citation || typeof citation !== 'object') return null;
  const record = citation as Partial<Citation>;
  const id = normalizeConsoleStateLine(record.id, `cite-${index}`);
  const title = normalizeConsoleStateLine(record.title, 'Untitled');
  const url = normalizeConsoleStateUrl(record.url);
  const score =
    typeof record.score === 'number' && Number.isFinite(record.score)
      ? record.score
      : 0;

  return {
    id,
    title,
    ...(url ? { url } : {}),
    snippet: normalizeConsoleStateBody(record.snippet).slice(0, 200),
    score,
  };
}

export function normalizeConsoleStateMessage(
  message: unknown,
): ConsoleMessage | null {
  if (!message || typeof message !== 'object') return null;
  const record = message as Partial<ConsoleMessage>;
  const id = normalizeConsoleStateLine(record.id);
  const role =
    record.role === 'user' ||
    record.role === 'assistant' ||
    record.role === 'system'
      ? record.role
      : null;
  if (!id || !role) return null;

  const timestamp =
    typeof record.timestamp === 'number' && Number.isFinite(record.timestamp)
      ? record.timestamp
      : Date.now();
  const citations = Array.isArray(record.citations)
    ? record.citations.flatMap((citation, index) => {
        const normalized = normalizeConsoleStateCitation(citation, index);
        return normalized ? [normalized] : [];
      })
    : undefined;

  return {
    id,
    role,
    content: normalizeConsoleStateBody(record.content),
    timestamp,
    ...(normalizeConsoleStateLine(record.error)
      ? { error: normalizeConsoleStateLine(record.error) }
      : {}),
    ...(record.isStreaming === true ? { isStreaming: true } : {}),
    ...(citations && citations.length > 0 ? { citations } : {}),
  };
}

export function normalizeConsoleStateTraceEvent(
  trace: unknown,
): TraceEvent | null {
  if (!trace || typeof trace !== 'object') return null;
  const record = trace as Partial<TraceEvent>;
  const id = normalizeConsoleStateLine(record.id);
  const type = TRACE_TYPES.has(record.type as TraceEvent['type'])
    ? (record.type as TraceEvent['type'])
    : null;
  const label = normalizeConsoleStateLine(record.label);
  const status = TRACE_STATUSES.has(record.status as TraceEvent['status'])
    ? (record.status as TraceEvent['status'])
    : null;
  if (!id || !type || !label || !status) return null;

  return {
    id,
    type,
    label,
    ...(normalizeConsoleStateBody(record.detail)
      ? { detail: normalizeConsoleStateBody(record.detail) }
      : {}),
    timestamp:
      typeof record.timestamp === 'number' && Number.isFinite(record.timestamp)
        ? record.timestamp
        : Date.now(),
    ...(typeof record.duration === 'number' && Number.isFinite(record.duration)
      ? { duration: Math.max(0, record.duration) }
      : {}),
    status,
  };
}

function normalizeConsoleStateTraceUpdates(
  updates: Partial<TraceEvent>,
): Partial<TraceEvent> {
  const normalized: Partial<TraceEvent> = {};
  if ('id' in updates) {
    const id = normalizeConsoleStateLine(updates.id);
    if (id) normalized.id = id;
  }
  if ('type' in updates && TRACE_TYPES.has(updates.type as TraceEvent['type'])) {
    normalized.type = updates.type as TraceEvent['type'];
  }
  if ('label' in updates) {
    const label = normalizeConsoleStateLine(updates.label);
    if (label) normalized.label = label;
  }
  if ('detail' in updates) {
    const detail = normalizeConsoleStateBody(updates.detail);
    normalized.detail = detail || undefined;
  }
  if ('timestamp' in updates && typeof updates.timestamp === 'number' && Number.isFinite(updates.timestamp)) {
    normalized.timestamp = updates.timestamp;
  }
  if ('duration' in updates && typeof updates.duration === 'number' && Number.isFinite(updates.duration)) {
    normalized.duration = Math.max(0, updates.duration);
  }
  if ('status' in updates && TRACE_STATUSES.has(updates.status as TraceEvent['status'])) {
    normalized.status = updates.status as TraceEvent['status'];
  }
  return normalized;
}

function loadPersistedMessages(): ConsoleMessage[] {
  try {
    const raw = localStorage.getItem(CONSOLE_MESSAGES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.flatMap(message => {
          const normalized = normalizeConsoleStateMessage(message);
          return normalized ? [normalized] : [];
        });
      }
    }
    
    const chatMessages = loadChatWidgetSession();
    if (chatMessages.length > 0) {
      return chatMessages;
    }
  } catch {
    void 0;
  }
  return [];
}

function persistMessages(messages: ConsoleMessage[]): void {
  try {
    const normalizedMessages = messages.flatMap(message => {
      const normalized = normalizeConsoleStateMessage(message);
      return normalized ? [normalized] : [];
    });
    localStorage.setItem(CONSOLE_MESSAGES_KEY, JSON.stringify(normalizedMessages));
  } catch {
    void 0;
  }
}

function convertChatToConsole(chatMsg: { id: string; role: 'user' | 'assistant' | 'system'; text: string; sources?: Array<{ title?: string; url?: string; snippet?: string; score?: number }> }): ConsoleMessage | null {
  return normalizeConsoleStateMessage({
    id: chatMsg.id,
    role: chatMsg.role,
    content: chatMsg.text,
    timestamp: Date.now(),
    citations: chatMsg.sources?.map((s, i) => ({
      id: `src-${i}`,
      title: s.title || 'Untitled',
      url: s.url,
      snippet: s.snippet || '',
      score: s.score || 0,
    })),
  });
}

function loadChatWidgetSession(): ConsoleMessage[] {
  try {
    const sessionId = getStoredSessionId();
    if (!sessionId) return [];
    
    const raw = localStorage.getItem(`${SESSION_MESSAGES_PREFIX}${sessionId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.flatMap(message => {
          const normalized = convertChatToConsole(message);
          return normalized ? [normalized] : [];
        });
      }
    }
  } catch {
    void 0;
  }
  return [];
}

const initialState: ConsoleState = {
  messages: loadPersistedMessages(),
  citations: [],
  traces: [],
  input: '',
  isProcessing: false,
  mode: 'rag',
  error: null,
};

function consoleReducer(state: ConsoleState, action: ConsoleAction): ConsoleState {
  switch (action.type) {
    case 'SET_INPUT':
      return { ...state, input: normalizeConsoleStateBody(action.payload) };

    case 'SET_MODE':
      return {
        ...state,
        mode: CONSOLE_MODES.has(action.payload) ? action.payload : state.mode,
      };

    case 'LOAD_MESSAGES':
      return {
        ...state,
        messages: action.payload.flatMap(message => {
          const normalized = normalizeConsoleStateMessage(message);
          return normalized ? [normalized] : [];
        }),
      };

    case 'ADD_USER_MESSAGE':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: normalizeConsoleStateLine(action.payload.id, `user-${Date.now()}`),
            role: 'user',
            content: normalizeConsoleStateBody(action.payload.content),
            timestamp: Date.now(),
          },
        ],
        input: '',
        error: null,
      };

    case 'ADD_ASSISTANT_MESSAGE':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: normalizeConsoleStateLine(action.payload.id, `assistant-${Date.now()}`),
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
            citations: state.citations.flatMap((citation, index) => {
              const normalized = normalizeConsoleStateCitation(citation, index);
              return normalized ? [normalized] : [];
            }),
          },
        ],
      };

    case 'APPEND_ASSISTANT_CONTENT': {
      const id = normalizeConsoleStateLine(action.payload.id);
      if (!id) return state;
      const idx = state.messages.findIndex(m => m.id === id);
      if (idx === -1) return state;
      const updated = [...state.messages];
      updated[idx] = {
        ...updated[idx],
        content: updated[idx].content + normalizeConsoleStateChunk(action.payload.chunk),
      };
      return { ...state, messages: updated };
    }

    case 'FINISH_ASSISTANT_MESSAGE': {
      const id = normalizeConsoleStateLine(action.payload.id);
      if (!id) return state;
      const idx = state.messages.findIndex(m => m.id === id);
      if (idx === -1) return state;
      const updated = [...state.messages];
      updated[idx] = { ...updated[idx], isStreaming: false };
      return { ...state, messages: updated };
    }

    case 'SET_CITATIONS':
      return {
        ...state,
        citations: action.payload.flatMap((citation, index) => {
          const normalized = normalizeConsoleStateCitation(citation, index);
          return normalized ? [normalized] : [];
        }),
      };

    case 'ADD_TRACE': {
      const normalized = normalizeConsoleStateTraceEvent(action.payload);
      return normalized
        ? { ...state, traces: [...state.traces, normalized] }
        : state;
    }

    case 'UPDATE_TRACE': {
      const id = normalizeConsoleStateLine(action.payload.id);
      if (!id) return state;
      const idx = state.traces.findIndex(t => t.id === id);
      if (idx === -1) return state;
      const updated = [...state.traces];
      updated[idx] = {
        ...updated[idx],
        ...normalizeConsoleStateTraceUpdates(action.payload.updates),
      };
      return { ...state, traces: updated };
    }

    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };

    case 'SET_ERROR':
      return {
        ...state,
        error:
          action.payload === null
            ? null
            : normalizeConsoleStateLine(action.payload, 'Unknown console error'),
        isProcessing: false,
      };

    case 'CLEAR_ALL':
      return { ...initialState, mode: state.mode };

    default:
      return state;
  }
}

export function useConsoleState() {
  const [state, dispatch] = useReducer(consoleReducer, initialState);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (state.messages.length > 0) {
      persistMessages(state.messages);
    }
  }, [state.messages]);

  useEffect(() => {
    const handleSessionUpdate = () => {
      const chatMessages = loadChatWidgetSession();
      if (chatMessages.length > 0 && state.messages.length === 0) {
        dispatch({ type: 'LOAD_MESSAGES', payload: chatMessages } as ConsoleAction);
      }
    };

    window.addEventListener('aiChat:sessionsUpdated', handleSessionUpdate);
    return () => window.removeEventListener('aiChat:sessionsUpdated', handleSessionUpdate);
  }, [state.messages.length]);

  const setInput = useCallback((value: string) => {
    dispatch({ type: 'SET_INPUT', payload: value });
  }, []);

  const setMode = useCallback((mode: ConsoleMode) => {
    dispatch({ type: 'SET_MODE', payload: mode });
  }, []);

  const addUserMessage = useCallback((id: string, content: string) => {
    dispatch({ type: 'ADD_USER_MESSAGE', payload: { id, content } });
  }, []);

  const addAssistantMessage = useCallback((id: string) => {
    dispatch({ type: 'ADD_ASSISTANT_MESSAGE', payload: { id } });
  }, []);

  const appendAssistantContent = useCallback((id: string, chunk: string) => {
    dispatch({ type: 'APPEND_ASSISTANT_CONTENT', payload: { id, chunk } });
  }, []);

  const finishAssistantMessage = useCallback((id: string) => {
    dispatch({ type: 'FINISH_ASSISTANT_MESSAGE', payload: { id } });
  }, []);

  const setCitations = useCallback((citations: Citation[]) => {
    dispatch({ type: 'SET_CITATIONS', payload: citations });
  }, []);

  const addTrace = useCallback((trace: TraceEvent) => {
    dispatch({ type: 'ADD_TRACE', payload: trace });
  }, []);

  const updateTrace = useCallback((id: string, updates: Partial<TraceEvent>) => {
    dispatch({ type: 'UPDATE_TRACE', payload: { id, updates } });
  }, []);

  const setProcessing = useCallback((value: boolean) => {
    dispatch({ type: 'SET_PROCESSING', payload: value });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
    try {
      localStorage.removeItem(CONSOLE_MESSAGES_KEY);
    } catch {
      void 0;
    }
  }, []);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const createAbortController = useCallback(() => {
    abort();
    abortRef.current = new AbortController();
    return abortRef.current;
  }, [abort]);

  const syncFromChatWidget = useCallback(() => {
    const chatMessages = loadChatWidgetSession();
    if (chatMessages.length > 0) {
      dispatch({ type: 'LOAD_MESSAGES', payload: chatMessages });
    }
  }, []);

  return {
    state,
    actions: {
      setInput,
      setMode,
      addUserMessage,
      addAssistantMessage,
      appendAssistantContent,
      finishAssistantMessage,
      setCitations,
      addTrace,
      updateTrace,
      setProcessing,
      setError,
      clearAll,
      abort,
      createAbortController,
      syncFromChatWidget,
    },
  };
}
