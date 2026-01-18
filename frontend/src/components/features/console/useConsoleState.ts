/**
 * AI Console State Management Hook
 */

import { useReducer, useCallback, useRef } from 'react';
import type { ConsoleState, ConsoleAction, ConsoleMode, Citation, TraceEvent } from './types';

const initialState: ConsoleState = {
  messages: [],
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
    },
  };
}
