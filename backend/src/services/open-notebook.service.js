import { config } from '../config/index.js';
import { TIMEOUTS } from '../config/constants.js';

const OPEN_NOTEBOOK_BASE_URL = config.services?.openNotebookUrl || 'http://open-notebook:8501';

async function fetchOpenNotebook(endpoint, options = {}) {
  const url = `${OPEN_NOTEBOOK_BASE_URL}${endpoint}`;
  const timeout = options.timeout || TIMEOUTS.DEFAULT;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Open Notebook API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Open Notebook request timeout after ${timeout}ms`);
    }
    throw err;
  }
}

export async function searchOpenNotebook(query, options = {}) {
  const { limit = 5, notebookId = null } = options;

  const body = {
    query,
    limit,
  };

  if (notebookId) {
    body.notebook_id = notebookId;
  }

  const result = await fetchOpenNotebook('/api/search', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return result.results || [];
}

export async function askOpenNotebook(query, options = {}) {
  const { notebookId = null } = options;

  let defaults = {};
  try {
    defaults = await fetchOpenNotebook('/api/models/defaults', {
      method: 'GET',
    });
  } catch {
    defaults = {};
  }

  let languageModelId = defaults.default_chat_model || null;

  if (!languageModelId) {
    const models = await fetchOpenNotebook('/api/models', {
      method: 'GET',
    });

    const fallbackModel = Array.isArray(models)
      ? models.find(m => m?.type === 'language' && m?.id)
      : null;

    languageModelId = fallbackModel?.id || null;
  }

  if (!languageModelId) {
    throw new Error('Open Notebook language model is not configured');
  }

  const body = {
    question: query,
    strategy_model: languageModelId,
    answer_model: languageModelId,
    final_answer_model: languageModelId,
  };

  if (notebookId) {
    body.notebook_id = notebookId;
  }

  const result = await fetchOpenNotebook('/api/search/ask/simple', {
    method: 'POST',
    body: JSON.stringify(body),
    timeout: TIMEOUTS.LONG,
  });

  return {
    answer: result.answer || result.response || '',
    sources: result.sources || [],
    context: result.context || [],
  };
}

export async function listNotebooks() {
  const result = await fetchOpenNotebook('/api/notebooks', {
    method: 'GET',
  });

  return result.notebooks || [];
}

export async function createNotebook(name, description = '') {
  const result = await fetchOpenNotebook('/api/notebooks', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });

  return result;
}

export async function addSource(notebookId, source) {
  const { type, content, url, title } = source;

  const body = {
    notebook_id: notebookId,
    source_type: type,
  };

  if (type === 'text') {
    body.content = content;
    body.title = title || 'Untitled';
  } else if (type === 'url') {
    body.url = url;
  }

  const result = await fetchOpenNotebook('/api/sources', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return result;
}

export async function healthCheck() {
  try {
    const result = await fetchOpenNotebook('/health', {
      method: 'GET',
      timeout: 5000,
    });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function isOpenNotebookEnabled() {
  return config.features?.openNotebookEnabled === true;
}

export default {
  search: searchOpenNotebook,
  ask: askOpenNotebook,
  listNotebooks,
  createNotebook,
  addSource,
  healthCheck,
  isEnabled: isOpenNotebookEnabled,
};
