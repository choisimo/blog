export interface AIProvider {
  id: string;
  name: string;
  display_name: string;
  api_base_url: string | null;
  api_key_env: string | null;
  is_enabled: number;
  health_status: string;
  last_health_check: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIModel {
  id: string;
  provider_id: string;
  model_name: string;
  display_name: string;
  model_identifier: string;
  description: string | null;
  context_window: number | null;
  max_tokens: number | null;
  input_cost_per_1k: number | null;
  output_cost_per_1k: number | null;
  supports_vision: number;
  supports_streaming: number;
  supports_function_calling: number;
  is_enabled: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface AIRoute {
  id: string;
  name: string;
  description: string | null;
  routing_strategy: string;
  primary_model_id: string | null;
  fallback_model_ids: string | null;
  context_window_fallback_ids: string | null;
  num_retries: number;
  timeout_seconds: number;
  is_default: number;
  is_enabled: number;
  created_at: string;
  updated_at: string;
}

export interface AIUsageLog {
  id: string;
  model_id: string | null;
  route_id: string | null;
  request_type: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: number | null;
  latency_ms: number | null;
  status: string | null;
  error_message: string | null;
  user_id: string | null;
  metadata: string | null;
  created_at: string;
}

export interface AIUsageDaily {
  date: string;
  model_id: string;
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cost: number;
  success_count: number;
  error_count: number;
  avg_latency_ms: number | null;
}

export interface PlaygroundHistory {
  id: string;
  user_id: string | null;
  title: string | null;
  system_prompt: string | null;
  user_prompt: string;
  model_id: string | null;
  model_name: string | null;
  provider_id: string | null;
  provider_name: string | null;
  response: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  estimated_cost: number | null;
  temperature: number;
  max_tokens: number | null;
  status: string;
  error_message: string | null;
  metadata: string | null;
  created_at: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  system_prompt: string | null;
  user_prompt_template: string;
  variables: string | null;
  default_model_id: string | null;
  default_temperature: number;
  default_max_tokens: number | null;
  is_public: number;
  usage_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
