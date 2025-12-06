/**
 * Chat Service - Legacy Compatibility Export
 *
 * 기존 import 경로 호환성을 위한 re-export
 * 새로운 코드는 '@/services/chat' 에서 직접 import 권장
 *
 * @deprecated Use '@/services/chat' instead
 */

export {
  // Types
  type ChatSession,
  type ChatTaskMode,
  type InvokeChatTaskInput,
  type InvokeChatTaskResult,
  type ChatStreamEvent,
  type StreamChatInput,
  type ChatImageUploadResult,
  // Config
  isUnifiedTasksEnabled,
  // Session
  ensureSession,
  // API
  invokeChatTask,
  streamChatEvents,
  streamChatMessage,
  uploadChatImage,
  invokeChatAggregate,
} from './chat/index';
