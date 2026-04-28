/**
 * Code Execution Tool - Safe code execution in sandbox
 *
 * Provides secure code execution capabilities using the backend execute route,
 * which fronts the shared Piston sandbox.
 */

import { config } from '../../../config.js';
import { createLogger } from '../../../lib/logger.js';

const logger = createLogger('code-execution');

const getExecuteUrl = () => {
  const baseUrl =
    config.services?.backendUrl ||
    config.apiBaseUrl ||
    process.env.INTERNAL_API_URL ||
    `http://localhost:${config.port}`;
  return `${String(baseUrl).replace(/\/$/, '')}/api/v1/execute`;
};
const EXECUTION_TIMEOUT = parseInt(process.env.CODE_EXEC_TIMEOUT || '30000', 10);

/**
 * Execute code in sandbox
 */
async function executeInSandbox(code, language) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (config.backendKey) {
    headers['X-Backend-Key'] = config.backendKey;
  }

  const response = await fetch(getExecuteUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      language,
      files: [{ content: code }],
      run_timeout: EXECUTION_TIMEOUT,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage =
      payload?.error?.message ||
      payload?.error ||
      payload?.message ||
      '';
    throw new Error(`Execution failed: ${response.status} ${errorMessage}`.trim());
  }

  if (!payload?.ok || !payload.data) {
    throw new Error('Execution failed: malformed execute response');
  }

  const run = payload.data.run || {};
  return {
    success: typeof run.code === 'number' ? run.code === 0 : true,
    output: [run.stdout, run.stderr].filter(Boolean).join(''),
    result: run.output ?? run.stdout ?? undefined,
    error: typeof run.code === 'number' && run.code !== 0 ? run.stderr || `Exit code ${run.code}` : undefined,
    run,
  };
}

/**
 * Execute JavaScript code through the configured sandbox only.
 */
async function executeJavaScript(code) {
  return executeInSandbox(code, 'javascript');
}

/**
 * Execute Python code
 */
async function executePython(code) {
  return executeInSandbox(code, 'python');
}

/**
 * Execute shell commands
 */
async function executeShell(code) {
  return executeInSandbox(code, 'bash');
}

/**
 * Create Code Execution Tool
 */
export function createCodeExecutionTool() {
  if (config.features?.codeExecutionEnabled !== true) {
    logger.info({ feature: 'code_execution' }, 'Code execution tool disabled by feature flag');
    return null;
  }

  return {
    name: 'code_execution',
    description: 'Execute code in a sandboxed environment. Supports JavaScript, Python, and shell commands. Use for calculations, data processing, or testing code snippets.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The code to execute',
        },
        language: {
          type: 'string',
          description: 'Programming language',
          enum: ['javascript', 'python', 'bash'],
          default: 'javascript',
        },
      },
      required: ['code'],
    },

    async execute(args) {
      const { code, language = 'javascript' } = args;

      if (!code) {
        return { success: false, error: 'code is required' };
      }

      logger.debug({ language, chars: code.length }, 'Executing code');

      try {
        let result;

        switch (language) {
          case 'javascript':
            result = await executeJavaScript(code);
            break;
          case 'python':
            result = await executePython(code);
            break;
          case 'bash':
            result = await executeShell(code);
            break;
          default:
            return {
              success: false,
              error: `Unsupported language: ${language}`,
            };
        }

        logger.debug({ language, success: result.success !== false }, 'Code execution completed');

        return {
          success: result.success !== false,
          language,
          output: result.output?.slice(0, 2000),
          result: result.result?.slice?.(0, 1000) || result.result,
          error: result.error,
        };
      } catch (error) {
        logger.error({ language }, 'Code execution failed', { error: error.message });
        return {
          success: false,
          language,
          error: error.message,
        };
      }
    },
  };
}

export default createCodeExecutionTool;
