/**
 * ChatWidget - AI Chat Widget Component
 *
 * This file re-exports from the modularized ./widget directory.
 * The original 1645-line monolithic component has been split into:
 *
 * - types.ts: Type definitions (SourceLink, ChatMessage, UploadedChatImage, etc.)
 * - constants.ts: Storage keys, quick prompts, helper functions
 * - hooks/: State management hooks
 *   - useChatState.ts: Main chat state (messages, input, sessions, refs)
 *   - useChatSession.ts: Session management (load, toggle, aggregate)
 *   - useChatActions.ts: Chat actions (send, stop, clearAll)
 *   - useChatKeyboard.ts: Keyboard handling hooks
 * - components/: UI components
 *   - ChatHeader.tsx: Header with controls
 *   - ChatSessionPanel.tsx: Session list, ModeSelector
 *   - ChatMessages.tsx: Message rendering (terminal + default styles)
 *   - ChatInput.tsx: Input area (terminal + default styles)
 *   - ChatDialogs.tsx: ImageDrawer, MobileActionSheet
 * - index.tsx: Main component (~240 lines)
 */

export { default } from "./widget";
export type { SourceLink, ChatMessage, QuestionMode } from "./widget/types";
