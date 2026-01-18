/**
 * AI Console Types
 * 
 * Professional AI Console with RAG-first approach
 */

export type ConsoleMode = 'rag' | 'agent' | 'web';

export interface Citation {
  id: string;
  title: string;
  url?: string;
  slug?: string;
  year?: string;
  snippet: string;
  score: number;
  category?: string;
}

export interface ConsoleMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  citations?: Citation[];
  isStreaming?: boolean;
  error?: string;
}

export interface TraceEvent {
  id: string;
  type: 'search' | 'retrieve' | 'generate' | 'tool' | 'error';
  label: string;
  detail?: string;
  timestamp: number;
  duration?: number;
  status: 'pending' | 'running' | 'done' | 'error';
}

export interface ConsoleState {
  messages: ConsoleMessage[];
  citations: Citation[];
  traces: TraceEvent[];
  input: string;
  isProcessing: boolean;
  mode: ConsoleMode;
  error: string | null;
}

export type ConsoleAction =
  | { type: 'SET_INPUT'; payload: string }
  | { type: 'SET_MODE'; payload: ConsoleMode }
  | { type: 'ADD_USER_MESSAGE'; payload: { id: string; content: string } }
  | { type: 'ADD_ASSISTANT_MESSAGE'; payload: { id: string } }
  | { type: 'APPEND_ASSISTANT_CONTENT'; payload: { id: string; chunk: string } }
  | { type: 'FINISH_ASSISTANT_MESSAGE'; payload: { id: string } }
  | { type: 'SET_CITATIONS'; payload: Citation[] }
  | { type: 'ADD_TRACE'; payload: TraceEvent }
  | { type: 'UPDATE_TRACE'; payload: { id: string; updates: Partial<TraceEvent> } }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ALL' };
