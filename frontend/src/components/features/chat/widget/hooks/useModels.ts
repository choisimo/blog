import { useState, useEffect, useCallback } from 'react';
import { getApiBaseUrl } from '@/utils/apiBase';

export type AIModel = {
  id: string;
  name: string;
  provider: string;
  description?: string;
  isDefault?: boolean;
  capabilities?: string[];
};

export type ModelsResponse = {
  models: AIModel[];
  default: string;
  provider: string;
  warning?: string;
};

const SELECTED_MODEL_KEY = 'chat_selected_model';
const MODELS_CACHE_KEY = 'chat_models_cache';
const MODELS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

type CachedModels = {
  data: ModelsResponse;
  timestamp: number;
};

/**
 * Hook to fetch and manage AI model selection
 */
export function useModels() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>('');
  const [selectedModel, setSelectedModelState] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(SELECTED_MODEL_KEY) || '';
    } catch {
      return '';
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch models from API
  const fetchModels = useCallback(async (force = false) => {
    // Check cache first
    if (!force && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(MODELS_CACHE_KEY);
        if (cached) {
          const parsed: CachedModels = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < MODELS_CACHE_TTL) {
            setModels(parsed.data.models);
            setDefaultModel(parsed.data.default);
            if (!selectedModel) {
              setSelectedModelState(parsed.data.default);
            }
            setLoading(false);
            return;
          }
        }
      } catch {
        // Cache miss or invalid, continue to fetch
      }
    }

    setLoading(true);
    setError(null);

    try {
      const base = getApiBaseUrl();
      const url = `${base.replace(/\/$/, '')}/api/v1/ai/models`;
      
      const res = await fetch(url);
      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.error || 'Failed to fetch models');
      }

      const data: ModelsResponse = json.data;
      setModels(data.models);
      setDefaultModel(data.default);
      
      // Set selected model if not already set
      if (!selectedModel) {
        setSelectedModelState(data.default);
      }

      // Cache the response
      if (typeof window !== 'undefined') {
        try {
          const cached: CachedModels = {
            data,
            timestamp: Date.now(),
          };
          localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify(cached));
        } catch {
          // Cache write failed, ignore
        }
      }
    } catch (err: any) {
      console.error('[useModels] Failed to fetch models:', err);
      setError(err.message || 'Failed to load models');
      
      // Use fallback models on error
      const fallback: AIModel[] = [
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google', isDefault: true },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
        { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
      ];
      setModels(fallback);
      setDefaultModel('gemini-1.5-flash');
      if (!selectedModel) {
        setSelectedModelState('gemini-1.5-flash');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedModel]);

  // Fetch models on mount
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Set selected model with persistence
  const setSelectedModel = useCallback((modelId: string) => {
    setSelectedModelState(modelId);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SELECTED_MODEL_KEY, modelId);
      } catch {
        // Storage write failed, ignore
      }
    }
  }, []);

  // Get the current model object
  const currentModel = models.find((m) => m.id === selectedModel) || 
                       models.find((m) => m.isDefault) ||
                       models[0];

  // Group models by provider for UI
  const modelsByProvider = models.reduce<Record<string, AIModel[]>>((acc, model) => {
    const provider = model.provider || 'Other';
    if (!acc[provider]) {
      acc[provider] = [];
    }
    acc[provider].push(model);
    return acc;
  }, {});

  return {
    models,
    modelsByProvider,
    defaultModel,
    selectedModel: selectedModel || defaultModel,
    currentModel,
    setSelectedModel,
    loading,
    error,
    refresh: () => fetchModels(true),
  };
}
