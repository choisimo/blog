/**
 * Agent Mode Registry
 *
 * Single source of truth for all agent conversation modes.
 * - buildSystemPrompt (system.js) derives its dispatch from this registry
 * - GET /api/v1/agent/modes derives its response from this registry
 * - Route-level alias normalization uses this registry
 *
 * IMPORTANT: Do NOT mix with chat task modes (sketch/prism/chain/...).
 * Those live in src/config/constants.js → VALID_TASK_MODES.
 */

// ============================================================================
// Registry Definition
// ============================================================================

/**
 * @typedef {Object} AgentModeDefinition
 * @property {string}   id          - Canonical mode identifier used in API responses
 * @property {string}   name        - Human-readable display name
 * @property {string}   description - Short description for API consumers
 * @property {string[]} aliases     - Alternative identifiers accepted on input (normalized to id)
 */

/** @type {AgentModeDefinition[]} */
export const AGENT_MODE_REGISTRY = [
  {
    id: 'default',
    name: 'General',
    description: 'General conversation and assistance',
    aliases: [],
  },
  {
    id: 'research',
    name: 'Research',
    description: 'In-depth information gathering',
    aliases: [],
  },
  {
    id: 'coding',
    name: 'Coding',
    description: 'Programming assistance',
    aliases: [],
  },
  {
    id: 'blog',
    name: 'Blog',
    description: 'Blog content management',
    aliases: [],
  },
  {
    id: 'article',
    name: 'Article Q&A',
    description: 'Questions about specific articles',
    aliases: [],
  },
  {
    id: 'terminal',
    name: 'Terminal',
    description: 'System administration tasks',
    aliases: [],
  },
  {
    id: 'performance',
    name: 'Performance Audit',
    description: 'Frontend/runtime performance investigation',
    aliases: ['performance_audit', 'performance-audit'],
  },
];

// ============================================================================
// Derived Lookups (built once at module load)
// ============================================================================

/** Map from canonical id → definition */
const BY_ID = new Map(AGENT_MODE_REGISTRY.map(m => [m.id, m]));

/** Map from alias → canonical id */
const ALIAS_TO_ID = new Map(
  AGENT_MODE_REGISTRY.flatMap(m => m.aliases.map(a => [a, m.id]))
);

// ============================================================================
// Public API
// ============================================================================

/**
 * Normalize a raw mode string (which may be an alias) to its canonical id.
 * Unknown or empty values fall back to 'default'.
 *
 * @param {string | undefined | null} raw
 * @returns {string} Canonical mode id
 */
export function normalizeMode(raw) {
  if (!raw || typeof raw !== 'string') return 'default';
  const trimmed = raw.trim().toLowerCase();
  if (BY_ID.has(trimmed)) return trimmed;
  const fromAlias = ALIAS_TO_ID.get(trimmed);
  if (fromAlias) return fromAlias;
  return 'default';
}

/**
 * Return true if raw is a valid canonical id OR a registered alias.
 *
 * @param {string | undefined | null} raw
 * @returns {boolean}
 */
export function isValidAgentMode(raw) {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim().toLowerCase();
  return BY_ID.has(trimmed) || ALIAS_TO_ID.has(trimmed);
}

/**
 * Return the list of mode definitions suitable for API responses.
 * Only canonical ids are exposed — aliases remain internal.
 *
 * @returns {{ id: string, name: string, description: string }[]}
 */
export function listAgentModes() {
  return AGENT_MODE_REGISTRY.map(({ id, name, description }) => ({
    id,
    name,
    description,
  }));
}

/**
 * Return the definition for a canonical id, or undefined if not found.
 *
 * @param {string} id - Must be a canonical id (use normalizeMode first)
 * @returns {AgentModeDefinition | undefined}
 */
export function getModeDefinition(id) {
  return BY_ID.get(id);
}
