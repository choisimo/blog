# Companion tool verification

Run from `frontend/`:

```sh
DESIGN_BASE_URL=http://127.0.0.1:4319 node scripts/design-verification/fieldnotes-companion-tools-browser.mjs
```

Six cases use the actual bundled `c-lang-2` article at 320/390/1440 in light/dark. API/external calls fail through request aborts; no backend response is fulfilled with test data. Prism and ThoughtFeed are the application's existing fallback after those failures, explicitly recorded in `results.json`; the actual AI-disabled follow-up input stays disabled. Successful generated analysis is not claimed.

The runner checks mode selection, sketch error/retry, fallback status, evidence/summary keyboard focus, perspective navigation, close/reopen, quiz study mode, answer selection, feedback, all ten answers, completion and restart. An actual ten-answer stall was reproduced before the idle pre-generation effect was limited to the idle quiz state. All six cases pass after the fix.

Screenshots and `checks/` retain 17 focused tests, TypeScript/build, 149 contracts, ESLint (0 errors/74 existing warnings), 51 browser regressions and the six-case output. Later authored diagram verification is reproducible in `../rich-content/`; the older diagram captures here remain evidence from that earlier pass. These results do not establish remote AI availability or the whole-site design's completion.
