# Fieldnotes final delivery

The user accepted the design work already made and stopped further general iteration. Their final requested patch is limited to hiding the TOC scrollbar, removing unnecessary copy, and reducing the visual weight of citations, followed by a PR and merge of the completed session work.

## Final behavior

- Desktop and mobile TOC scrollbars are invisible. The actual Radix viewport still supports mouse wheel, touch scrolling, keyboard focus and PageDown; active-heading tracking stays with its existing owner.
- Removed both language variants of the reading slogans, the dated GitHub collection explanation, the archive slogan, redundant About invitation and the discussion introduction. Action labels, errors, recovery instructions and content descriptions remain.
- A final section explicitly titled 출처, 참고 문헌, 참고 자료, 참고 링크, References, Sources, Bibliography or Citations now renders its bibliography in a native disclosure. The heading and full text stay in the document; ordinary sections and an already authored disclosure stay intact.
- GFM footnotes use their own disclosure. Generated footnote links point to the IDs retained by the sanitizer; sanitizer restrictions remain unchanged. Deep links reveal the target. Print opens the bibliography and restores its previous state afterwards.
- In-article search opens a disclosure containing its selected hit before measuring and scrolling to that hit. Disclosure controls themselves are excluded from prose search. This keeps a citation found by search visible even when the bibliography started closed.
- Reduced-motion transitions are fully disabled (`0s`). The expanded CI suite caught the shared stylesheet overriding the diagrams' existing zero-duration rule with a tiny nonzero duration; the stylesheet is corrected without weakening that regression test.
- The intelligence essay retains all 43 bibliography entries and links. Two AEA query values use an equivalent literal slash so the existing URL policy no longer leaves those two references as plain text. The supplied 40-page PDF is retained unchanged. The final cover is a restrained pen-and-ink editorial illustration; rejected image variants are not needed by the published article.
- The earlier global search fix keeps results and recent-history rows in the top sheet's normal flow. Its own scrolling makes long result sets reachable in short viewports. Mobile input text is 16px.

## Verification

- `npm run type-check`; `npm run lint` (0 errors, 74 existing warnings); `npm run build`; `npm run korean:scan:ci`; root `npm run config:generate:check`.
- `ArticleReferences.test.tsx`, `TableOfContents.test.tsx` and `src/test/MarkdownRenderer.test.tsx`: 11 passing tests. These exercise real Markdown processing, safe links, preserved bibliography content/footnote IDs, authored disclosures and print-state restoration.
- Citation/search follow-up: `ArticleReferences.test.tsx` plus `articleSearch.test.ts`, 11 passing tests. All six real-content browser cases additionally search for the final OECD citation from a closed bibliography and require the opened source link to be in the viewport.
- `npm run test:deploy`: 46 passing tests. `node --test scripts/ui-foundation-contracts.test.mjs scripts/ui-remaining-pages.test.mjs`: 149 passing contracts.
- Design Playwright regression suite: 51 passing cases. These existing regressions supplement, rather than replace, real-content rendering.
- The full CI browser suite initially passed 85 cases and found nine identical reduced-motion transition failures. After correcting the shared rule, all 23 article-diagram cases passed locally with system Chromium; the existing zero-duration expectations are unchanged.
- `scripts/design-verification/fieldnotes-final-polish-browser.mjs`: six real-content cases, light/dark at 320/390/1440. TOC wheel/PageDown with hidden bars, native Enter/Space disclosure, all 43 source URLs, removed copy, page overflow and runtime errors are checked. Both desktop PDFs retain 43 full reference entries, and the light reference page was rendered and visually inspected.
- Global search follow-up: seven real-content cases (light/dark at 320/390/1440, terminal at 390) cover visible results, selected-article navigation, recent history after clearing, empty search, scrolling to the last result at 400px height and Escape focus return. Evidence: `verification-screenshots/fieldnotes-final-audit-20260908/search-results.json`.
- Current final-polish screenshots and PDFs: `verification-screenshots/fieldnotes-final-polish-20260908/`. Earlier public, reader, companion and administrator evidence remains in the dated Fieldnotes review directories.

Real-content browser checks use bundled posts and actual components, abort unavailable API/external requests, and do not substitute successful responses or auth credentials. Production authentication, successful AI generation and server mutations are not established by these checks.

## Scoped review and limits

The reference transform runs after HTML sanitization and creates only fixed native elements. It neither fetches citations nor changes their claims. Existing heading generation, TOC scrolling, services and authorization remain the owners of their behavior. Reference-body handlers are local to the disclosure and clean up print/hash listeners. No new dependency, config or secret key is introduced.

The supplemental legacy `src/test/HeaderSearchBar.test.tsx` suite still has one exact-label mismatch: it expects `Remove from history`, while both HEAD and the current source expose `Remove from history: <query>`. Five other search tests passed. This predates the search layout patch and is not rewritten as part of the final scope.

During the stopped general audit, the chat option sheet was observed to clip its final option at a 500px viewport height. No additional chat redesign was made after the user ended that iteration. Older inventory and review documents remain historical evidence, not a claim that this unrequested issue was fixed.
