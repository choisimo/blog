import { Router } from 'express';
import { config } from '../config.js';
import requireAdmin from '../middleware/adminAuth.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const router = Router();

const CONFIG_CATEGORIES = [
  {
    id: 'app',
    name: 'Application',
    description: '서버 기본 설정',
    variables: [
      { key: 'APP_ENV', type: 'select', options: ['development', 'staging', 'production', 'test'], description: '실행 환경' },
      { key: 'HOST', type: 'text', default: '0.0.0.0', description: '서버 호스트' },
      { key: 'PORT', type: 'number', default: '5080', description: '서버 포트' },
      { key: 'LOG_LEVEL', type: 'select', options: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'], description: '로그 레벨' },
      { key: 'TRUST_PROXY', type: 'number', default: '1', description: 'Proxy 신뢰 레벨' },
      { key: 'RATE_LIMIT_MAX', type: 'number', default: '60', description: '분당 최대 요청 수' },
      { key: 'RATE_LIMIT_WINDOW_MS', type: 'number', default: '60000', description: 'Rate limit 윈도우 (ms)' },
    ],
  },
  {
    id: 'cors',
    name: 'CORS & URLs',
    description: 'CORS 허용 도메인 및 URL 설정',
    variables: [
      { key: 'ALLOWED_ORIGINS', type: 'textarea', delimiter: ',', description: 'CORS 허용 도메인 (쉼표 구분)' },
      { key: 'API_BASE_URL', type: 'url', description: 'API 기본 URL' },
      { key: 'SITE_BASE_URL', type: 'url', description: '사이트 기본 URL' },
    ],
  },
  {
    id: 'ai',
    name: 'AI Services',
    description: 'AI 모델 및 서비스 설정',
    variables: [
      { key: 'AI_SERVER_URL', type: 'url', default: 'https://api.openai.com/v1', description: 'OpenAI SDK 호환 서버 URL' },
      { key: 'AI_API_KEY', type: 'password', isSecret: true, description: 'AI API Key' },
      { key: 'AI_DEFAULT_MODEL', type: 'text', default: 'gpt-4.1', description: '기본 AI 모델' },
    ],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    description: 'D1, R2, Workers 설정',
    variables: [
      { key: 'CF_ACCOUNT_ID', type: 'text', description: 'Cloudflare Account ID' },
      { key: 'CF_API_TOKEN', type: 'password', isSecret: true, description: 'Cloudflare API Token' },
      { key: 'D1_DATABASE_ID', type: 'text', description: 'D1 Database ID' },
      { key: 'R2_BUCKET_NAME', type: 'text', default: 'blog', description: 'R2 Bucket 이름' },
      { key: 'R2_ASSETS_BASE_URL', type: 'url', default: 'https://assets-b.nodove.com', description: 'R2 Assets URL' },
    ],
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'GitHub 통합 설정',
    variables: [
      { key: 'GITHUB_TOKEN', type: 'password', isSecret: true, description: 'GitHub Personal Access Token' },
      { key: 'GITHUB_REPO_OWNER', type: 'text', description: 'GitHub Repo Owner' },
      { key: 'GITHUB_REPO_NAME', type: 'text', description: 'GitHub Repo Name' },
      { key: 'GIT_USER_NAME', type: 'text', description: 'Git User Name' },
      { key: 'GIT_USER_EMAIL', type: 'text', description: 'Git User Email' },
    ],
  },
  {
    id: 'rag',
    name: 'RAG Services',
    description: 'TEI, ChromaDB 설정',
    variables: [
      { key: 'TEI_URL', type: 'url', default: 'http://embedding-server:80', description: 'TEI Embedding Server URL' },
      { key: 'CHROMA_URL', type: 'url', default: 'http://chromadb:8000', description: 'ChromaDB URL' },
      { key: 'CHROMA_COLLECTION', type: 'text', default: 'blog-posts-all-MiniLM-L6-v2', description: 'ChromaDB Collection' },
    ],
  },
  {
    id: 'auth',
    name: 'Authentication',
    description: '인증 및 보안 설정',
    variables: [
      { key: 'ADMIN_BEARER_TOKEN', type: 'password', isSecret: true, description: 'Admin Bearer Token' },
      { key: 'JWT_SECRET', type: 'password', isSecret: true, description: 'JWT Secret' },
      { key: 'ADMIN_USERNAME', type: 'text', description: 'Admin Username' },
      { key: 'ADMIN_PASSWORD', type: 'password', isSecret: true, description: 'Admin Password' },
    ],
  },
  {
    id: 'features',
    name: 'Feature Flags',
    description: '기능 활성화/비활성화 설정',
    variables: [
      { key: 'FEATURE_AI_ENABLED', type: 'select', options: ['true', 'false'], default: 'true', description: 'AI 서비스 활성화' },
      { key: 'FEATURE_RAG_ENABLED', type: 'select', options: ['true', 'false'], default: 'true', description: 'RAG 검색 활성화' },
      { key: 'FEATURE_TERMINAL_ENABLED', type: 'select', options: ['true', 'false'], default: 'true', description: '터미널 서비스 활성화' },
      { key: 'FEATURE_AI_INLINE', type: 'select', options: ['true', 'false'], default: 'true', description: '인라인 AI 기능 활성화' },
      { key: 'FEATURE_COMMENTS_ENABLED', type: 'select', options: ['true', 'false'], default: 'true', description: '댓글 기능 활성화' },
    ],
  },
  {
    id: 'consul',
    name: 'Consul',
    description: 'Consul 서비스 디스커버리 설정',
    variables: [
      { key: 'USE_CONSUL', type: 'select', options: ['true', 'false'], default: 'false', description: 'Consul KV 활성화' },
      { key: 'CONSUL_HOST', type: 'text', default: 'consul', description: 'Consul 호스트' },
      { key: 'CONSUL_PORT', type: 'number', default: '8500', description: 'Consul 포트' },
    ],
  },
];

router.get('/categories', requireAdmin, (req, res) => {
  res.json({ ok: true, data: { categories: CONFIG_CATEGORIES } });
});

router.get('/current', requireAdmin, (req, res) => {
  const currentConfig = {};

  CONFIG_CATEGORIES.forEach((cat) => {
    cat.variables.forEach((variable) => {
      const value = process.env[variable.key];
      currentConfig[variable.key] = {
        value: variable.isSecret ? (value ? '********' : '') : value || '',
        isSecret: variable.isSecret || false,
        isSet: !!value,
        default: variable.default || '',
      };
    });
  });

  res.json({ ok: true, data: { config: currentConfig } });
});

router.post('/validate', requireAdmin, (req, res) => {
  const { key, value } = req.body;

  const category = CONFIG_CATEGORIES.find((cat) => cat.variables.some((v) => v.key === key));
  if (!category) {
    return res.status(404).json({ ok: false, error: 'Unknown variable' });
  }

  const variable = category.variables.find((v) => v.key === key);
  const validation = validateVariable(variable, value);

  res.json({ ok: true, data: validation });
});

function validateVariable(variable, value) {
  if (!value && variable.isRequired) {
    return { valid: false, error: 'Value is required' };
  }

  if (!value) return { valid: true };

  switch (variable.type) {
    case 'number':
      if (isNaN(Number(value))) {
        return { valid: false, error: 'Must be a number' };
      }
      break;
    case 'url':
      try {
        new URL(value);
      } catch {
        return { valid: false, error: 'Invalid URL format' };
      }
      break;
    case 'select':
      if (variable.options && !variable.options.includes(value)) {
        return { valid: false, error: `Must be one of: ${variable.options.join(', ')}` };
      }
      break;
  }

  return { valid: true };
}

router.post('/export', requireAdmin, (req, res) => {
  const { format = 'env', includeSecrets = false } = req.body;

  let output = '';

  if (format === 'env') {
    output = generateEnvFile(includeSecrets);
  } else if (format === 'docker-compose') {
    output = generateDockerComposeEnv(includeSecrets);
  } else if (format === 'wrangler') {
    output = generateWranglerVars(includeSecrets);
  } else {
    return res.status(400).json({ ok: false, error: 'Invalid format' });
  }

  res.json({ ok: true, data: { content: output, format } });
});

function generateEnvFile(includeSecrets = false) {
  const lines = ['# Generated environment configuration', `# Generated at: ${new Date().toISOString()}`, ''];

  CONFIG_CATEGORIES.forEach((cat) => {
    lines.push(`# === ${cat.name} ===`);
    cat.variables.forEach((v) => {
      const value = process.env[v.key] || v.default || '';
      if (v.isSecret && !includeSecrets) {
        lines.push(`# ${v.key}=<secret>`);
      } else {
        lines.push(`${v.key}=${value}`);
      }
    });
    lines.push('');
  });

  return lines.join('\n');
}

function generateDockerComposeEnv(includeSecrets = false) {
  const lines = ['    environment:'];

  CONFIG_CATEGORIES.forEach((cat) => {
    cat.variables.forEach((v) => {
      const value = process.env[v.key] || v.default || '';
      if (v.isSecret && !includeSecrets) {
        lines.push(`      # - ${v.key}=<secret>`);
      } else if (value) {
        lines.push(`      - ${v.key}=${value}`);
      }
    });
  });

  return lines.join('\n');
}

function generateWranglerVars(includeSecrets = false) {
  const lines = ['[vars]'];
  const secretLines = ['', '# Secrets (set via wrangler secret put):'];

  CONFIG_CATEGORIES.forEach((cat) => {
    cat.variables.forEach((v) => {
      const value = process.env[v.key] || v.default || '';
      if (v.isSecret) {
        secretLines.push(`# wrangler secret put ${v.key}`);
      } else if (value) {
        lines.push(`${v.key} = "${value}"`);
      }
    });
  });

  return [...lines, ...secretLines].join('\n');
}

router.post('/save-env', requireAdmin, async (req, res) => {
  const { variables, target = 'backend' } = req.body;

  if (!variables || typeof variables !== 'object') {
    return res.status(400).json({ ok: false, error: 'variables object required' });
  }

  try {
    let envPath;
    if (target === 'root') {
      envPath = path.join(config.content.repoRoot, '.env');
    } else {
      envPath = path.join(config.content.repoRoot, 'backend', '.env');
    }

    const lines = [];
    const allVars = {};

    CONFIG_CATEGORIES.forEach((cat) => {
      cat.variables.forEach((v) => {
        allVars[v.key] = process.env[v.key] || v.default || '';
      });
    });

    Object.entries(variables).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        allVars[key] = value;
      }
    });

    lines.push(`# Auto-generated at ${new Date().toISOString()}`);
    lines.push('');

    CONFIG_CATEGORIES.forEach((cat) => {
      lines.push(`# === ${cat.name} ===`);
      cat.variables.forEach((v) => {
        const val = allVars[v.key] || '';
        if (val || !v.isSecret) {
          lines.push(`${v.key}=${val}`);
        }
      });
      lines.push('');
    });

    await fs.writeFile(envPath, lines.join('\n'), 'utf8');

    res.json({ ok: true, data: { path: envPath, message: 'Environment file saved' } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/schema', requireAdmin, (req, res) => {
  const schema = CONFIG_CATEGORIES.map((cat) => ({
    id: cat.id,
    name: cat.name,
    description: cat.description,
    variables: cat.variables.map((v) => ({
      key: v.key,
      type: v.type,
      options: v.options,
      default: v.default,
      isSecret: v.isSecret || false,
      description: v.description,
    })),
  }));

  res.json({ ok: true, data: { schema } });
});

export default router;
