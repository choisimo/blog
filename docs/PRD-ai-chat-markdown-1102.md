# PRD: AI Chat Markdown Rendering Refresh (1102)

- **Author**: Cascade (AI assistant)
- **Date**: 2025-11-02
- **Status**: Draft / For Review
- **Related initiative**: AI Chat UI/UX 개선

---

## 1. Background & Problem Statement

The in-page AI Chat widget currently streams assistant responses as plain text bubbles without Markdown semantics. This prevents code blocks, inline code, lists, links, and emphasis from rendering correctly, reducing readability for technical answers. The blog already ships a rich Markdown renderer (`frontend/src/components/features/blog/MarkdownRenderer.tsx`) that supports syntax highlighting, link styling, blockquotes, and Spark inline augmentations that could be reused for a consistent look and feel across the product.

## 2. Goals

1. Render AI assistant responses with full Markdown support (code, lists, inline formatting, links, blockquotes).
2. Scope the styling so only assistant chat bubbles adopt the Markdown look without impacting user bubbles or other UI components.
3. Maintain streaming UX—partial messages should progressively format without jank.
4. Preserve existing source references and follow-up button regions below the formatted response.

## 3. Non-Goals

- Changing backend streaming payloads.
- Altering message persistence or follow-up suggestion logic.
- Introducing new assistant content types beyond Markdown.

## 4. Current State Summary

- Chat messages render inside `ChatWidget` as `<div>`s with `whitespace-pre-wrap`; Markdown tokens are shown raw (e.g., ``` fenced code ```).
- The `MarkdownRenderer` component wraps `react-markdown`, `remark-gfm`, and `react-syntax-highlighter` with one-dark theme, copy buttons, and anchored headings; it assumes blog prose width and inline Spark injection.
- No CSS module currently targets assistant bubbles specifically, so introducing Markdown must not leak `.prose` typography globally.

## 5. User Stories & Acceptance Criteria

### Story A1 – Markdown rendering for assistant text

- Role: reader using the AI chat
- Goal: view Markdown syntax in answers rendered with typography, code highlighting, and clickable links
- Benefit: multi-format answers stay legible

#### Acceptance criteria – assistant responses

1. Triple-backtick code blocks appear inside a distinct container with monospace font, background, padding, and optional copy affordance.
2. Inline code renders with subtle background and monospace font.
3. Ordered/unordered lists respect indentation and bullet styling.
4. Bold, italics, strikethrough, and blockquotes match blog styling guidelines.
5. Links open in a new tab with hover states.

### Story A2 – Scoped styling

- Assistant bubbles use Markdown styles without affecting user/system message bubbles.
- Chat widget layout (max width, spacing) remains unchanged aside from typography inside assistant bubble.

### Story A3 – Streaming UX resilience

- Partial chunks (while streaming) should render without page reflow or flashing.
- Upon completion the message is fully formatted.

## 6. Functional Requirements

1. Integrate a Markdown renderer for assistant messages.
   - Option 1: Reuse `MarkdownRenderer` with props for chat context (disable Spark inline, slim spacing, limit heading sizes, adjust copy button placement).
   - Option 2: Create a trimmed chat-specific Markdown component sharing styling tokens.
2. Ensure the renderer is invoked only for `role === 'assistant'` messages.
3. Provide CSS isolation (e.g., wrapping bubble with `.chat-assistant-markdown` and using Tailwind `prose` classes or CSS modules).
4. Preserve newline handling for streaming text (avoid double formatting).
5. Provide fallback to plain text if Markdown parsing fails.

## 7. UX & Visual Guidelines

- Match blog code block palette (one-dark) but reduce margins to suit bubble width.
- Limit heading sizes to ~`text-base`–`text-lg` to avoid oversized titles inside chat.
- Add minimal spacing between paragraphs; prefer `max-w-full` inside bubble.
- Copy button: show top-right on hover similar to blog, but ensure icon remains tappable on mobile.

## 8. Technical Notes

- Evaluate memoization to avoid rerender storms while streaming (e.g., keep raw text state and let Markdown render on each diff, or throttle).
- Keep `whitespace-pre-wrap` for non-Markdown roles.
- Test with long code block streaming; ensure `overflow-auto` on `<pre>`.
- Confirm Tailwind classes available; otherwise add scoped CSS.

## 9. Analytics / Telemetry

- Track (optional) the number of assistant messages containing fenced code vs rendered, via existing telemetry pipeline if available.
- Monitor performance impact (render time) in dev tools.

## 10. Dependencies / Risks

- `react-markdown`, `remark-gfm`, `react-syntax-highlighter` already bundled; confirm tree-shaking unaffected.
- Potential increase in bundle size if new renderer duplicates dependencies—prefer reuse.
- Streaming state might break if Markdown parser expects complete document; mitigate with incremental rendering.
- Need to test in dark mode.

## 11. QA Checklist

- ✅ Markdown sample coverage (headings, list, nested list, blockquote, inline code, fenced code, links).
- ✅ Streaming message showing partial (simulate slow network).
- ✅ Mobile viewport (<= 375px) for code overflow.
- ✅ Source list + follow-up buttons still aligned under Markdown section.
- ✅ No regressions on user/system bubble styling.

## 12. Rollout Plan

- Behind feature flag? Optional if heavy change. Otherwise push with manual QA.
- Communicate update in changelog/blog.

## 13. Open Questions

1. Should copy button appear on mobile (tap) or remain hover-only?
2. Do we need to support tables? (Not mentioned but can piggyback on MarkdownRenderer capability.)

---

## Appendix A – Reference Artifacts

- Chat widget implementation: `frontend/src/components/features/chat/ChatWidget.tsx`
- Blog Markdown renderer: `frontend/src/components/features/blog/MarkdownRenderer.tsx`
