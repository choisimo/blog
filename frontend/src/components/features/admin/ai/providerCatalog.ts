export interface CatalogProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyEnvVar: string;
  category: 'cloud' | 'local';
  description: string;
}

export const PROVIDER_CATALOG: CatalogProvider[] = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKeyEnvVar: 'OPENAI_API_KEY', category: 'cloud', description: 'GPT-4, GPT-3.5 and more' },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKeyEnvVar: 'OPENROUTER_API_KEY', category: 'cloud', description: 'Unified gateway to 100+ models' },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', apiKeyEnvVar: 'GROQ_API_KEY', category: 'cloud', description: 'Ultra-fast inference on LPUs' },
  { id: 'together', name: 'Together AI', baseUrl: 'https://api.together.xyz/v1', apiKeyEnvVar: 'TOGETHER_API_KEY', category: 'cloud', description: 'Open-source models at scale' },
  { id: 'fireworks', name: 'Fireworks AI', baseUrl: 'https://api.fireworks.ai/inference/v1', apiKeyEnvVar: 'FIREWORKS_API_KEY', category: 'cloud', description: 'Fast open-source model inference' },
  { id: 'mistral', name: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1', apiKeyEnvVar: 'MISTRAL_API_KEY', category: 'cloud', description: 'Mistral and Mixtral models' },
  { id: 'cohere', name: 'Cohere', baseUrl: 'https://api.cohere.com/v2', apiKeyEnvVar: 'COHERE_API_KEY', category: 'cloud', description: 'Enterprise NLP platform' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', apiKeyEnvVar: 'DEEPSEEK_API_KEY', category: 'cloud', description: 'DeepSeek reasoning models' },
  { id: 'xai', name: 'xAI (Grok)', baseUrl: 'https://api.x.ai/v1', apiKeyEnvVar: 'XAI_API_KEY', category: 'cloud', description: "Elon Musk's Grok models" },
  { id: 'cerebras', name: 'Cerebras', baseUrl: 'https://api.cerebras.ai/v1', apiKeyEnvVar: 'CEREBRAS_API_KEY', category: 'cloud', description: 'Wafer-scale chip inference' },
  { id: 'sambanova', name: 'SambaNova', baseUrl: 'https://fast-api.snova.ai/v1', apiKeyEnvVar: 'SAMBANOVA_API_KEY', category: 'cloud', description: 'High-throughput AI inference' },
  { id: 'perplexity', name: 'Perplexity AI', baseUrl: 'https://api.perplexity.ai', apiKeyEnvVar: 'PERPLEXITY_API_KEY', category: 'cloud', description: 'Search-augmented language models' },
  { id: 'google-ai', name: 'Google AI', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKeyEnvVar: 'GOOGLE_AI_API_KEY', category: 'cloud', description: 'Gemini models via Google AI' },
  { id: 'cloudflare', name: 'Cloudflare AI', baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1', apiKeyEnvVar: 'CLOUDFLARE_API_TOKEN', category: 'cloud', description: 'Workers AI edge inference' },
  { id: 'ollama', name: 'Ollama', baseUrl: 'http://localhost:11434/v1', apiKeyEnvVar: '', category: 'local', description: 'Run LLMs locally' },
  { id: 'lmstudio', name: 'LM Studio', baseUrl: 'http://localhost:1234/v1', apiKeyEnvVar: '', category: 'local', description: 'Local model GUI + server' },
  { id: 'gemini-cli', name: 'Gemini CLI', baseUrl: 'http://localhost:8080/v1', apiKeyEnvVar: '', category: 'local', description: 'Local Gemini CLI bridge' },
];
