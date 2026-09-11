# Actual reader design preview

User correction: render a complete, real existing article page and create ten functional layout variants, not a standalone mock UI with fixed answers.

Verified source: src/App.tsx, pages/public/BlogPost.tsx, blog-post/BlogPostContent.tsx, features/sentio/SparkInline.tsx, ThoughtFeed.tsx, ThoughtCard.tsx, useCardExploration.ts. Article: public/posts/2026/current-crowd.md (30 SparkInline paragraphs, 6 headings, actual original image). Working tree contains extensive existing changes; do not overwrite them.

Architecture: separate Vite entry imports actual main/App; preview-only build transform swaps BrowserRouter for HashRouter so exported HTML routes work. A panel toolbar is inserted only in preview builds. The original view returns no added panel UI. Existing API clients, state hooks, auth, streaming, retries, card history, theme, TOC, reading controls remain their original owners. Layout tools only own presentation selection and optional local notes. No synthetic AI results.

Artifacts: actual page HTML, original baseline HTML, ten individual HTML entry files, shared compiled app assets; standalone baseline and selector HTML exports. Real article text and image are packaged. A loopback HTTP server serves files and proxies the verified public API for browser CORS compatibility. Local runtime API localhost:5080 is unavailable. Production public config at https://api.nodove.com/api/v1/public/config returned 200 with aiEnabled/aiInline true. Live AI success still requires verification.

Layouts: 01 inline focus, 02 right inspector, 03 index/detail, 04 guided steps, 05 chronological conversation, 06 parallel question board, 07 vertical reasoning path, 08 notes beside question, 09 bottom sheet, 10 questions paired with supporting content. Candidates differ in spatial composition and navigation/interaction; baseline retains original CSS.

Constraints: never replace API replies with fixtures; preserve native errors and disabled states. Keep cards mounted across layout changes and do not reparent React-owned DOM. Desktop inspector becomes flow content on small screens; bottom sheet is nonmodal with explicit close. Controls >=44px, visible focus, reduced motion. Verify real DOM equality to baseline, forms, modes, retained drafts, modal close, TOC, image lightbox, notes, mobile overflow, and real network response.

Completed verification: real feed returned seven cards; a real follow-up streamed 1,086 characters successfully. Final original + ten layouts passed 33 viewport combinations (1440/390/320), paragraph/draft preservation, native TOC and discussion navigation, reading settings/focus, image lightbox, question selection, note persistence, and standalone offline rendering. Evidence: design-previews/reading-page/verification/results.json and live-api-evidence.json. Loopback server is running at http://localhost:4320.
