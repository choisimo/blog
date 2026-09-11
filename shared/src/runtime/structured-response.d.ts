/**
 * Parse strict, fenced, prose-embedded, or encoded JSON. Repairs literal control
 * characters inside strings and trailing commas. Never unwraps application
 * envelopes. Objects/arrays pass through by identity; other nonstrings return null.
 * Invalid/truncated input returns null. String input is limited to 1 MiB in UTF-16
 * code units, 64 container levels, and four JSON decoding passes.
 */
export function parseStructuredResponse(value: unknown): unknown | null;

/**
 * Detect strong response keys and malformed generic envelope fragments, including
 * JSON fences, explicit JSON/response introductions, and encoded JSON. Valid JSON
 * with only generic keys (title/data/text/result/output/payload/_raw) is allowed.
 * Also detects malformed string arrays and incomplete bracket/comma-only fragments.
 * Complete empty containers and arrays consisting only of strings are allowed.
 * Fences may put JSON on the same line. Unrelated objects, numeric arrays, ordinary prose,
 * and non-JSON code fences are excluded.
 * Examines at most 1 MiB of UTF-16 code units and four encoding levels.
 */
export function isStructuredResponseText(value: unknown): boolean;

/**
 * Detect response-like text in own enumerable data-property string leaves.
 * Cycle-safe; skips getters and inaccessible properties. Limited to 64 object
 * levels, 4096 scheduled nodes, and 1 MiB total string code units. Unvisited
 * leaves beyond those budgets do not contribute to the result.
 */
export function hasStructuredResponseText(value: unknown): boolean;
