#!/usr/bin/env node
/**
 * Generate .env file from current config
 * Usage: node scripts/generate-env-from-config.js [output-path]
 */

import { config } from '../src/config.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const CONFIG_SCHEMA = {
  app: {
    name: 'Application',
    vars: [
      { key: 'APP_ENV', value: () => config.appEnv },
      { key: 'HOST', value: () => config.host },
      { key: 'PORT', value: () => config.port },
      { key: 'TRUST_PROXY', value: () => config.trustProxy },
      { key: 'LOG_LEVEL', value: () => config.logLevel },
      { key: 'RATE_LIMIT_MAX', value: () => config.rateLimit.max },
      { key: 'RATE_LIMIT_WINDOW_MS', value: () => config.rateLimit.windowMs },
    ],
  },
  urls: {
    name: 'URLs & CORS',
    vars: [
      { key: 'SITE_BASE_URL', value: () => config.siteBaseUrl },
      { key: 'API_BASE_URL', value: () => config.apiBaseUrl },
      { key: 'ALLOWED_ORIGINS', value: () => config.allowedOrigins.join(',') },
    ],
  },
  ai: {
    name: 'AI Services',
    vars: [
      { key: 'AI_GATEWAY_URL', value: () => config.ai?.gatewayUrl },
      { key: 'AI_BACKEND_URL', value: () => config.services?.aiBackendUrl },
      { key: 'AI_DEFAULT_MODEL', value: () => config.ai?.defaultModel },
      { key: 'AI_DEFAULT_PROVIDER', value: () => config.ai?.defaultProvider },
      { key: 'AI_API_KEY', value: () => config.ai?.apiKey, secret: true },
      { key: 'OPENCODE_BASE_URL', value: () => config.ai?.opencode?.baseUrl },
      { key: 'OPENCODE_API_KEY', value: () => config.ai?.opencode?.apiKey, secret: true },
    ],
  },
  services: {
    name: 'Service URLs',
    vars: [
      { key: 'INTERNAL_API_URL', value: () => config.services?.backendUrl },
      { key: 'N8N_BASE_URL', value: () => config.services?.n8nBaseUrl },
      { key: 'N8N_WEBHOOK_URL', value: () => config.services?.n8nWebhookUrl },
      { key: 'TERMINAL_SERVER_URL', value: () => config.services?.terminalServerUrl },
      { key: 'TERMINAL_GATEWAY_URL', value: () => config.services?.terminalGatewayUrl },
    ],
  },
  cloudflare: {
    name: 'Cloudflare',
    vars: [
      { key: 'CF_ACCOUNT_ID', value: () => process.env.CF_ACCOUNT_ID },
      { key: 'CF_API_TOKEN', value: () => process.env.CF_API_TOKEN, secret: true },
      { key: 'D1_DATABASE_ID', value: () => process.env.D1_DATABASE_ID },
      { key: 'R2_BUCKET_NAME', value: () => config.r2?.bucketName },
      { key: 'R2_ASSETS_BASE_URL', value: () => config.r2?.assetsBaseUrl },
    ],
  },
  github: {
    name: 'GitHub',
    vars: [
      { key: 'GITHUB_TOKEN', value: () => config.github?.token, secret: true },
      { key: 'GITHUB_REPO_OWNER', value: () => config.github?.owner },
      { key: 'GITHUB_REPO_NAME', value: () => config.github?.repo },
      { key: 'GIT_USER_NAME', value: () => config.github?.gitUserName },
      { key: 'GIT_USER_EMAIL', value: () => config.github?.gitUserEmail },
    ],
  },
  auth: {
    name: 'Authentication',
    vars: [
      { key: 'ADMIN_BEARER_TOKEN', value: () => config.admin?.bearerToken, secret: true },
      { key: 'JWT_SECRET', value: () => config.auth?.jwtSecret, secret: true },
      { key: 'JWT_EXPIRES_IN', value: () => config.auth?.jwtExpiresIn },
      { key: 'ADMIN_USERNAME', value: () => config.admin?.username },
      { key: 'ADMIN_PASSWORD', value: () => config.admin?.password, secret: true },
    ],
  },
  rag: {
    name: 'RAG Services',
    vars: [
      { key: 'TEI_URL', value: () => config.rag?.teiUrl },
      { key: 'CHROMA_URL', value: () => config.rag?.chromaUrl },
      { key: 'CHROMA_COLLECTION', value: () => config.rag?.chromaCollection },
    ],
  },
  redis: {
    name: 'Redis',
    vars: [
      { key: 'REDIS_URL', value: () => config.redis?.url },
    ],
  },
  consul: {
    name: 'Consul',
    vars: [
      { key: 'USE_CONSUL', value: () => config.consul?.enabled ? 'true' : 'false' },
      { key: 'CONSUL_HOST', value: () => config.consul?.host },
      { key: 'CONSUL_PORT', value: () => config.consul?.port },
    ],
  },
  features: {
    name: 'Feature Flags',
    vars: [
      { key: 'FEATURE_AI_ENABLED', value: () => config.features?.aiEnabled ? 'true' : 'false' },
      { key: 'FEATURE_RAG_ENABLED', value: () => config.features?.ragEnabled ? 'true' : 'false' },
      { key: 'FEATURE_TERMINAL_ENABLED', value: () => config.features?.terminalEnabled ? 'true' : 'false' },
      { key: 'FEATURE_AI_INLINE', value: () => config.features?.aiInline ? 'true' : 'false' },
      { key: 'FEATURE_COMMENTS_ENABLED', value: () => config.features?.commentsEnabled ? 'true' : 'false' },
    ],
  },
};

function generateEnvContent(includeSecrets = false) {
  const lines = [
    '# Auto-generated environment configuration',
    `# Generated at: ${new Date().toISOString()}`,
    '#',
    '# Usage: Copy this file to .env and fill in the values',
    '',
  ];

  for (const [, category] of Object.entries(CONFIG_SCHEMA)) {
    lines.push(`# === ${category.name} ===`);
    
    for (const v of category.vars) {
      try {
        const val = v.value() || '';
        if (v.secret && !includeSecrets) {
          lines.push(`# ${v.key}=<secret>`);
        } else {
          lines.push(`${v.key}=${val}`);
        }
      } catch {
        lines.push(`# ${v.key}=<error>`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateDockerComposeEnv(includeSecrets = false) {
  const lines = ['    environment:'];

  for (const [, category] of Object.entries(CONFIG_SCHEMA)) {
    for (const v of category.vars) {
      try {
        const val = v.value() || '';
        if (v.secret && !includeSecrets) {
          lines.push(`      # - ${v.key}=\${${v.key}}`);
        } else if (val) {
          lines.push(`      - ${v.key}=${val}`);
        }
      } catch {
        // skip
      }
    }
  }

  return lines.join('\n');
}

function generateWranglerVars(includeSecrets = false) {
  const varsLines = ['[vars]'];
  const secretsLines = ['', '# Secrets (set via CLI):', '# wrangler secret put <KEY>'];

  for (const [, category] of Object.entries(CONFIG_SCHEMA)) {
    for (const v of category.vars) {
      try {
        const val = v.value() || '';
        if (v.secret) {
          secretsLines.push(`# wrangler secret put ${v.key}`);
        } else if (val) {
          varsLines.push(`${v.key} = "${val}"`);
        }
      } catch {
        // skip
      }
    }
  }

  return [...varsLines, ...secretsLines].join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const format = args.find(a => ['--env', '--docker', '--wrangler'].includes(a)) || '--env';
  const outputPath = args.find(a => !a.startsWith('-'));
  const includeSecrets = args.includes('--include-secrets');

  let content;
  let defaultFilename;

  switch (format) {
    case '--docker':
      content = generateDockerComposeEnv(includeSecrets);
      defaultFilename = 'docker-env.yml';
      break;
    case '--wrangler':
      content = generateWranglerVars(includeSecrets);
      defaultFilename = 'wrangler-vars.toml';
      break;
    default:
      content = generateEnvContent(includeSecrets);
      defaultFilename = '.env.generated';
  }

  if (outputPath) {
    const fullPath = path.resolve(process.cwd(), outputPath);
    await fs.writeFile(fullPath, content, 'utf8');
    console.log(`Written to: ${fullPath}`);
  } else {
    console.log(content);
  }
}

main().catch(console.error);
