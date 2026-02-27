/**
 * Chat Service - Legacy Compatibility Export
 *
 * 기존 import 경로 호환성을 위한 re-export
 * 새로운 코드는 '@/services/chat' 에서 직접 import 권장
 *
 * @deprecated Use '@/services/chat' instead
 */

export {
  type ChatSession,
  type ChatTaskMode,
  type InvokeChatTaskInput,
  type InvokeChatTaskResult,
  type ChatStreamEvent,
  type StreamChatInput,
  type ChatImageUploadResult,
  type ChatSessionMeta,
  type LiveRoom,
  isUnifiedTasksEnabled,
  SESSION_ID_KEY,
  SESSIONS_INDEX_KEY,
  SESSION_MESSAGES_PREFIX,
  PERSIST_OPTIN_KEY,
  generateLocalSessionId,
  getStoredSessionId,
  storeSessionId,
  clearStoredSessionId,
  getSessionMessagesKey,
  storeSessionMessages,
  loadSessionMessages,
  clearSessionMessages,
  loadSessionsIndex,
  storeSessionsIndex,
  updateSessionInIndex,
  removeSessionFromIndex,
  isPersistEnabled,
  setPersistEnabled,
  createBackendSession,
  ensureSession,
  startNewSession,
  switchToSession,
  invokeChatTask,
  streamChatEvents,
  streamChatMessage,
  uploadChatImage,
  invokeChatAggregate,
  connectLiveChatStream,
  sendLiveChatMessage,
  getLiveChatConfig,
  updateLiveChatConfig,
  getLiveRoomStats,
  getLiveRooms,
} from './chat/index';
