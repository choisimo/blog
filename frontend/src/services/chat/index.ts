/**
 * Chat Service - Main Export
 *
 * 모듈화된 채팅 서비스의 통합 export
 */

// Types
export type {
  ChatSession,
  ChatTaskMode,
  InvokeChatTaskInput,
  InvokeChatTaskResult,
  ChatStreamEvent,
  StreamChatInput,
  ChatImageUploadResult,
  PageContext,
  ContentPart,
  ChatErrorCode,
} from './types';

export { ChatError } from './types';

// Config
export {
  getChatBaseUrl,
  getChatApiKey,
  isUnifiedTasksEnabled,
  buildChatUrl,
  buildChatHeaders,
} from './config';

// Session
export {
  ensureSession,
  getStoredSessionId,
  storeSessionId,
  clearStoredSessionId,
} from './session';

// Context
export {
  getPageContext,
  getArticleTextSnippet,
  CHAT_STYLE_PROMPT,
  buildContextPrompt,
  buildImageContext,
  buildRAGContextPrompt,
  buildMemoryContextPrompt,
} from './context';

// Stream parsing
export {
  extractTexts,
  parseStreamObject,
  parseSSEFrame,
  createFirstTokenTracker,
  createSSEParser,
  createNDJSONParser,
  createJSONParser,
  createPlainTextParser,
  getParserForContentType,
} from './stream';
export type { StreamParser } from './stream';

// API functions
export {
  invokeChatTask,
  streamChatEvents,
  streamChatMessage,
  uploadChatImage,
  invokeChatAggregate,
} from './api';
