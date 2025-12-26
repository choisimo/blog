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
    name: 'AI Services (VAS)',
    vars: [
      { key: 'AI_SERVE_BASE_URL', value: () => config.aiServe.baseUrl },
      { key: 'VAS_CORE_URL', value: () => config.aiServe.vasCoreUrl },
      { key: 'AI_SERVE_DEFAULT_PROVIDER', value: () => config.aiServe.defaultProvider },
      { key: 'AI_SERVE_DEFAULT_MODEL', value: () => config.aiServe.defaultModel },
      { key: 'GEMINI_API_KEY', value: () => config.gemini.apiKey, secret: true },
      { key: 'GEMINI_MODEL', value: () => config.gemini.model },
      { key: 'OPENROUTER_API_KEY', value: () => config.openrouter.apiKey, secret: true },
    ],
  },
  cloudflare: {
    name: 'Cloudflare',
    vars: [
      { key: 'CF_ACCOUNT_ID', value: () => process.env.CF_ACCOUNT_ID },
      { key: 'CF_API_TOKEN', value: () => process.env.CF_API_TOKEN, secret: true },
      { key: 'D1_DATABASE_ID', value: () => process.env.D1_DATABASE_ID },
      { key: 'R2_BUCKET_NAME', value: () => process.env.R2_BUCKET_NAME || 'blog' },
      { key: 'R2_ASSETS_BASE_URL', value: () => process.env.R2_ASSETS_BASE_URL },
    ],
  },
  github: {
    name: 'GitHub',
    vars: [
      { key: 'GITHUB_TOKEN', value: () => config.github.token, secret: true },
      { key: 'GITHUB_REPO_OWNER', value: () => config.github.owner },
      { key: 'GITHUB_REPO_NAME', value: () => config.github.repo },
      { key: 'GIT_USER_NAME', value: () => config.github.gitUserName },
      { key: 'GIT_USER_EMAIL', value: () => config.github.gitUserEmail },
    ],
  },
  firebase: {
    name: 'Firebase',
    vars: [
      { key: 'FIREBASE_PROJECT_ID', value: () => config.firebase.projectId },
      { key: 'FIREBASE_SERVICE_ACCOUNT_JSON', value: () => config.firebase.serviceAccountJson, secret: true },
    ],
  },
  auth: {
    name: 'Authentication',
    vars: [
      { key: 'ADMIN_BEARER_TOKEN', value: () => config.admin.bearerToken, secret: true },
      { key: 'JWT_SECRET', value: () => config.auth.jwtSecret, secret: true },
      { key: 'ADMIN_USERNAME', value: () => config.admin.username },
      { key: 'ADMIN_PASSWORD', value: () => config.admin.password, secret: true },
    ],
  },
  rag: {
    name: 'RAG Services',
    vars: [
      { key: 'TEI_URL', value: () => config.rag.teiUrl },
      { key: 'CHROMA_URL', value: () => config.rag.chromaUrl },
      { key: 'CHROMA_COLLECTION', value: () => config.rag.chromaCollection },
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
