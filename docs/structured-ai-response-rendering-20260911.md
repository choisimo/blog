# Structured AI response rendering repair — 2026-09-11

The production inline reading panel displayed serialized JSON in a lens card's
heading, summary, evidence and bullets. A browser reproduction on
`/blog/2026/organizing-intelligence-era`, using the paragraph about 74% internet
access, returned the same corrupt content as a ready `snapshot`. The original
unparsed provider response is unavailable; the stored display fields are already
truncated, so the exact original JSON syntax failure cannot be established.

## Verified data flow

| Stage | Input and transformation | State / failure |
| --- | --- | --- |
| Model generation | Lens and thought prompts request an `items` JSON array. | Parsing can fail on malformed or wrapped JSON. |
| Feed normalization | Previously, failure to extract items sent raw text through paragraph-to-card projection. | Serialized JSON became a title, summary/body and bullets. |
| Artifact generation | Any non-null normalized page was stored as ready. | Broken cards were reusable snapshots, not transient rendering errors. |
| Snapshot lookup | Exact and stale pages were returned without checking display content. | Refreshing could return the same malformed output. |
| Frontend | Feed/task responses were cast or weakly validated; hooks normalized text but did not distinguish JSON wire text. | Lens, thought, summary and task views could display serialized responses. |

The related sketch, prism, chain, summary and quiz paths were inspected in both
Worker and Express task services. Their parsing/prose-projection boundaries and
frontend normalization now use the same structured response parser and guards.
Normal conversational text and unrelated code samples remain supported.

## New behavior

- A shared bounded parser decodes strict, fenced, wrapped-in-prose and
  double-encoded JSON; deterministic repairs cover raw controls inside strings
  and trailing commas without rewriting valid strings.
- Incomplete outer objects never become successful nested-item responses.
  Unrecoverable structured output is rejected rather than projected as prose.
- Expected task/feed schemas are checked before rendering or caching; malformed
  cached display content is also guarded in the frontend.
- Both exact and stale contaminated snapshots are excluded from serving.
  Feed schema version 3 gives regeneration a new outbox/version identity;
  healthy old snapshots can still be served while a replacement warms.
- Feed output budgets scale with requested card count and prompts bound field
  lengths; the backend auto-chat fallback also receives the token limit. This
  reduces truncation risk but does not establish truncation as the original cause.
- Failed generations use existing error/fallback states. They are not stored as
  successful generated analysis. Existing database snapshots are not deleted.

## Verification

Shared parser tests cover decoding, deterministic repairs, truncation, nested
containers, false positives and bounded traversal. Worker tests cover both feed
types, task schemas, pagination/deduplication, and corrupt exact/stale snapshots
using the real local D1 test runtime. Frontend and backend regression tests cover
normalization and rendering of structured task results.

## Follow-up: empty sketch and stretched Markdown lists

After deployment, fresh lens and thought snapshots rendered normal Korean cards
on both 390px and 1440px production viewports. The separate sketch request still
failed. A production provider call reproduced an empty answer at 1,024 tokens:
`finishReason: length`, 1,024 output tokens, including 1,021 reasoning tokens.
The same model (`nodove-mspark-1.3c`) returned complete sketch JSON with a
4,096-token ceiling and `finishReason: stop`. Structured task defaults now allow
4,096 tokens for sketch, prism, chain, summary and quiz. This is a ceiling, not a
required response length; schema validation still rejects incomplete answers.

The additional screenshot's vertical Korean code labels had a separate cause:
`.sentio-thought li` applied `display: flex` inside `CardExplorationBody`'s rich
Markdown. Text, inline code and paragraphs became competing flex items. Card
bullet rules now target only direct card lists. Markdown keeps ordinary inline
and list flow, including nested and ordered lists. A real-component Playwright
fixture checks Korean code labels, paragraph stacking, overflow and original
card bullets at 390px and 1280px.
