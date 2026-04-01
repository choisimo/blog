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

function loadPersistedMessages(): ConsoleMessage[] {
  try {
    const raw = localStorage.getItem(CONSOLE_MESSAGES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
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
    localStorage.setItem(CONSOLE_MESSAGES_KEY, JSON.stringify(messages));
  } catch {
    void 0;
  }
}

function convertChatToConsole(chatMsg: { id: string; role: 'user' | 'assistant' | 'system'; text: string; sources?: Array<{ title?: string; url?: string; snippet?: string; score?: number }> }): ConsoleMessage {
  return {
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
  };
}

function loadChatWidgetSession(): ConsoleMessage[] {
  try {
    const sessionId = getStoredSessionId();
    if (!sessionId) return [];
    
    const raw = localStorage.getItem(`${SESSION_MESSAGES_PREFIX}${sessionId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(convertChatToConsole);
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
      return { ...state, input: action.payload };

    case 'SET_MODE':
      return { ...state, mode: action.payload };

    case 'LOAD_MESSAGES':
      return { ...state, messages: action.payload };

    case 'ADD_USER_MESSAGE':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: action.payload.id,
            role: 'user',
            content: action.payload.content,
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
            id: action.payload.id,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
            citations: state.citations,
          },
        ],
      };

    case 'APPEND_ASSISTANT_CONTENT': {
      const idx = state.messages.findIndex(m => m.id === action.payload.id);
      if (idx === -1) return state;
      const updated = [...state.messages];
      updated[idx] = {
        ...updated[idx],
        content: updated[idx].content + action.payload.chunk,
      };
      return { ...state, messages: updated };
    }

    case 'FINISH_ASSISTANT_MESSAGE': {
      const idx = state.messages.findIndex(m => m.id === action.payload.id);
      if (idx === -1) return state;
      const updated = [...state.messages];
      updated[idx] = { ...updated[idx], isStreaming: false };
      return { ...state, messages: updated };
    }

    case 'SET_CITATIONS':
      return { ...state, citations: action.payload };

    case 'ADD_TRACE':
      return { ...state, traces: [...state.traces, action.payload] };

    case 'UPDATE_TRACE': {
      const idx = state.traces.findIndex(t => t.id === action.payload.id);
      if (idx === -1) return state;
      const updated = [...state.traces];
      updated[idx] = { ...updated[idx], ...action.payload.updates };
      return { ...state, traces: updated };
    }

    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isProcessing: false };

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
