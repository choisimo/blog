export * from './types/ai';

export { 
  getAIConfig, 
  setAIConfig, 
  getProvider, 
  getEnabledProviders,
  isModelAvailable,
  PROVIDERS,
  DEFAULT_AI_CONFIG,
  AI_URLS,
  TIMEOUTS,
} from './ai/config';

export {
  type IAIClient,
  type ITaskClient,
  BaseAIClient,
  tryParseJson,
  safeTruncate,
  AIError,
  CircuitOpenError,
  TimeoutError,
} from './ai/client';

export {
  aiLogger,
  generateRequestId,
} from './ai/logger';

export {
  TRACE_ID_HEADER,
  type SpanType,
  type TraceStatus,
  type TraceSpan,
  type Trace,
  type TraceContext,
  generateTraceId,
  generateSpanId,
  getTraceIdFromHeaders,
  ensureTraceId,
  createSpan,
  completeSpan,
  isValidTraceId,
  getTraceTimestamp,
  createTraceContext,
} from './tracing';
