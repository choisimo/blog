/**
 * FloatingActionBar - Modularized version
 *
 * This file now re-exports from the modularized fab/ directory.
 * The original 1790-line component has been split into:
 *
 * - fab/types.ts - Type definitions
 * - fab/hooks/usePostsManifest.ts - Post manifest loading
 * - fab/hooks/useVirtualFS.ts - Virtual filesystem for shell navigation
 * - fab/hooks/useFabState.ts - FAB state management hooks
 * - fab/hooks/useShellCommander.ts - Shell command execution
 * - fab/components/ShellModal.tsx - Mobile shell modal
 * - fab/components/ShellComponents.tsx - Shell UI components
 * - fab/components/TerminalDock.tsx - Terminal theme dock
 * - fab/components/DefaultDock.tsx - Default theme dock
 * - fab/index.tsx - Main component (~300 lines)
 */
export { default } from "./fab";
