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
