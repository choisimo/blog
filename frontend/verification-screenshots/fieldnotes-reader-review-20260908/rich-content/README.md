# Rich article content verification

Run from `frontend/` against the production preview:

```sh
DESIGN_BASE_URL=http://127.0.0.1:4319 node scripts/design-verification/fieldnotes-rich-content-browser.mjs
```

The runner uses actual `teleport-config.md` diagram JSON and the three local simulators embedded in `teleport.md`. Local resources plus the simulators' actual Tailwind/font CDN dependencies are allowed. API requests are aborted without invented responses. It does not publish content or submit backend mutations.

Final four cases: light/dark at 390/1440. Checks include diagram selection, 19 authored diagram titles/node labels in each desktop PDF, iframe title/source links, 44px link targets, rendered paper colors, virtual-page control changes, reference input, actual FIFO simulation (two faults/one hit for `1, 2, 1`), preserved inputs/results through real settings theme changes, body-driven iframe height, no document overflow and zero runtime errors. Print checks hide all three frames, retain titles/paths and render the actual PDF page containing the links. Source and PDF contents are compared, and the dark diagram/iframe print pages are visually inspected.

`results.json` records these cases; `*-paging.png`, `*-chart.png`, `*-history.png` are final themed and auto-sized embeds. Earlier `before-*` captures preserve the observed gap. `before-dark-390-iframe.png` has a blocked Tailwind dependency and is diagnostic only; `before-loaded-dark-390-iframe.png` shows the actual loaded earlier style. No blocked-dependency screenshot is presented as the final application.

`standalone-results.json` records direct navigation to all three real simulator URLs at 390px: device dark/light changes, no document overflow and no runtime errors. The direct-page check was executed separately with repository Playwright and `/usr/bin/chromium`.

`height-stability.json` waits for each actual simulator's embedded marker and panel before measuring. The loaded mobile frames settle at 1180/557/1078px, and a second measurement one second later is identical. This verifies that auto-height does not keep growing with the iframe viewport.

Saved checks: successful production build and TypeScript; 15 existing renderer tests; 149 contracts; ESLint 0 errors/74 existing warnings; 51 browser regressions. The full regression run preceded the final body-height adapter; the final four rich-content cases specifically recheck that adapter and the current assets after rebuilding. No blanket rerun is used as a replacement for inspecting the actual frame geometry and output.

Scoped source review checked safe resolved URLs and preview isolation, same-origin-only parent access, unchanged algorithm ownership, canvas color updates, parent height clamp, body sizing without a viewport feedback loop, observer cleanup/restoration and retained state. A local chart helper name collision was corrected before browser validation. No unresolved correctness finding was identified in this scoped change. The authored simulators still depend on their existing external Tailwind/font resources; this change does not assert offline availability or redesign unrelated standalone HTML assets.
