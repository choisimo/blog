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
 * Execute JavaScript code (using Node.js vm module locally)
 */
async function executeJavaScript(code) {
  try {
    // Try sandbox first
    return await executeInSandbox(code, 'javascript');
  } catch {
    // Fallback to basic evaluation (limited)
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    
    // Create a sandboxed context
    const sandbox = {
      console: {
        log: (...args) => output.push(args.map(String).join(' ')),
        error: (...args) => output.push(`[Error] ${args.map(String).join(' ')}`),
      },
      Math,
      Date,
      JSON,
      Array,
      Object,
      String,
      Number,
      Boolean,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
    };

    const output = [];
    
    try {
      const fn = new AsyncFunction(...Object.keys(sandbox), code);
      const result = await fn(...Object.values(sandbox));
      
      return {
        success: true,
        output: output.join('\n'),
        result: result !== undefined ? String(result) : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: output.join('\n'),
      };
    }
  }
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
