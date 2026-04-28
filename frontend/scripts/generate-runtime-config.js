#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'url';
import { buildPublicRuntimeConfig } from '../../shared/src/contracts/public-runtime-config.js';
import { resolveSiteBaseUrl } from './lib/resolve-site-url.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const outputPath = path.join(frontendRoot, 'public', 'runtime-config.json');

function loadRuntimeConfigEnv() {
  dotenv.config({ path: path.join(repoRoot, '.env') });
  dotenv.config({ path: path.join(repoRoot, '.env.local') });
  dotenv.config({ path: path.join(frontendRoot, '.env'), override: true });
  dotenv.config({ path: path.join(frontendRoot, '.env.local'), override: true });
}

function readFlag(env, directKey, viteKey) {
  return env[directKey] === 'true' || env[viteKey] === 'true';
}

export function buildRuntimeConfigFromEnv(
  env = process.env,
  options = {}
) {
  const siteBaseUrl = options.siteBaseUrl || resolveSiteBaseUrl();
  const apiBaseUrl =
    env.API_BASE_URL ||
    env.VITE_API_BASE_URL ||
    (env.NODE_ENV === 'production' ? '' : 'http://localhost:5080');

  if (!apiBaseUrl) {
    throw new Error(
      'Missing API base URL. Set API_BASE_URL or VITE_API_BASE_URL before generating runtime-config.json.'
    );
  }

  return buildPublicRuntimeConfig({
    env: env.APP_ENV || env.NODE_ENV || 'development',
    siteBaseUrl,
    apiBaseUrl,
    chatBaseUrl:
      env.CHAT_BASE_URL ||
      env.VITE_CHAT_BASE_URL ||
      apiBaseUrl,
    chatWsBaseUrl:
      env.CHAT_WS_BASE_URL ||
      env.VITE_CHAT_WS_BASE_URL ||
      undefined,
    terminalGatewayUrl:
      env.TERMINAL_GATEWAY_URL ||
      env.VITE_TERMINAL_GATEWAY_URL ||
      undefined,
    // Keep generated runtime config aligned with the live edge route.
    supportsChatWebSocket: false,
    ai: {
      defaultModel:
        env.AI_DEFAULT_MODEL ||
        env.VITE_AI_DEFAULT_MODEL ||
        undefined,
      visionModel:
        env.AI_VISION_MODEL ||
        env.VITE_AI_VISION_MODEL ||
        undefined,
    },
    features: {
      aiEnabled: readFlag(env, 'FEATURE_AI_ENABLED', 'VITE_FEATURE_AI_ENABLED'),
      ragEnabled: readFlag(env, 'FEATURE_RAG_ENABLED', 'VITE_FEATURE_RAG_ENABLED'),
      terminalEnabled: readFlag(
        env,
        'FEATURE_TERMINAL_ENABLED',
        'VITE_FEATURE_TERMINAL_ENABLED'
      ),
      aiInline: readFlag(env, 'FEATURE_AI_INLINE', 'VITE_FEATURE_AI_INLINE'),
      codeExecutionEnabled: readFlag(
        env,
        'FEATURE_CODE_EXECUTION_ENABLED',
        'VITE_FEATURE_CODE_EXECUTION_ENABLED'
      ),
      commentsEnabled: readFlag(
        env,
        'FEATURE_COMMENTS_ENABLED',
        'VITE_FEATURE_COMMENTS_ENABLED'
      ),
    },
  });
}

export function writeRuntimeConfig(env = process.env) {
  const runtimeConfig = buildRuntimeConfigFromEnv(env);
  fs.writeFileSync(outputPath, `${JSON.stringify(runtimeConfig, null, 2)}\n`);
  return runtimeConfig;
}

const isCliEntry =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCliEntry) {
  loadRuntimeConfigEnv();
  writeRuntimeConfig();
  console.log(`runtime config written to ${path.relative(frontendRoot, outputPath)}`);
}
