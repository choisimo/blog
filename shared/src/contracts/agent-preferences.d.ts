export type AgentPreferences = {
  role: 'assistant' | 'researcher' | 'critic' | 'coach' | 'custom'; customRole: string;
  tone: 'natural' | 'formal' | 'friendly' | 'direct'; length: 'brief' | 'balanced' | 'detailed';
  language: 'ko' | 'en' | 'ja'; evidence: boolean; tables: 'auto' | 'prefer' | 'avoid';
  imageMode: 'auto' | 'always' | 'manual' | 'off'; imageStyle: 'editorial' | 'diagram' | 'photographic';
  imageSize: '1024x1024' | '1536x1024' | '1024x1536';
};
export const DEFAULT_AGENT_PREFERENCES: Readonly<AgentPreferences>;
export function normalizeAgentPreferences(input: unknown): AgentPreferences;
export function buildAgentPreferenceContext(input: unknown): string;
export function shouldAutoIllustrate(prompt: string, mode: AgentPreferences['imageMode'], purpose?: 'chat' | 'debate'): boolean;
