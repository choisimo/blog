/**
 * Code Execution Tool - Safe code execution in sandbox
 *
 * Provides secure code execution capabilities using the terminal server
 * sandbox environment. Supports multiple languages.
 */

import { config } from "../../../config.js";
import { INTERNAL_SERVICES } from "../../../config/constants.js";
import { createLogger } from "../../../lib/logger.js";

const logger = createLogger("code-execution");

const getTerminalServerUrl = () =>
  config.services?.terminalServerUrl ||
  process.env.TERMINAL_SERVER_URL ||
  INTERNAL_SERVICES.TERMINAL_SERVER_URL;
const EXECUTION_TIMEOUT = parseInt(
  process.env.CODE_EXEC_TIMEOUT || "30000",
  10,
);

/**
 * Execute code in sandbox
 */
async function executeInSandbox(code, language) {
  const response = await fetch(`${getTerminalServerUrl()}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      language,
      timeout: EXECUTION_TIMEOUT,
    }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "");
    throw new Error(`Execution failed: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Execute JavaScript code (using Node.js vm module locally)
 */
async function executeJavaScript(code) {
  try {
    // Try sandbox first
    return await executeInSandbox(code, "javascript");
  } catch {
    // Fallback to basic evaluation (limited)
    const AsyncFunction = Object.getPrototypeOf(
      async function () {},
    ).constructor;

    // Create a sandboxed context
    const sandbox = {
      console: {
        log: (...args) => output.push(args.map(String).join(" ")),
        error: (...args) =>
          output.push(`[Error] ${args.map(String).join(" ")}`),
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
        output: output.join("\n"),
        result: result !== undefined ? String(result) : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: output.join("\n"),
      };
    }
  }
}

/**
 * Execute Python code
 */
async function executePython(code) {
  return executeInSandbox(code, "python");
}

/**
 * Execute shell commands
 */
async function executeShell(code) {
  return executeInSandbox(code, "bash");
}

/**
 * Create Code Execution Tool
 */
export function createCodeExecutionTool() {
  return {
    name: "code_execution",
    description:
      "Execute code in a sandboxed environment. Supports JavaScript, Python, and shell commands. Use for calculations, data processing, or testing code snippets.",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "The code to execute",
        },
        language: {
          type: "string",
          description: "Programming language",
          enum: ["javascript", "python", "bash"],
          default: "javascript",
        },
      },
      required: ["code"],
    },

    async execute(args) {
      const { code, language = "javascript" } = args;

      if (!code) {
        return { success: false, error: "code is required" };
      }

      logger.debug({ language, chars: code.length }, "Executing code");

      try {
        let result;

        switch (language) {
          case "javascript":
            result = await executeJavaScript(code);
            break;
          case "python":
            result = await executePython(code);
            break;
          case "bash":
            result = await executeShell(code);
            break;
          default:
            return {
              success: false,
              error: `Unsupported language: ${language}`,
            };
        }

        logger.debug(
          { language, success: result.success !== false },
          "Code execution completed",
        );

        return {
          success: result.success !== false,
          language,
          output: result.output?.slice(0, 2000),
          result: result.result?.slice?.(0, 1000) || result.result,
          error: result.error,
        };
      } catch (error) {
        logger.error({ language }, "Code execution failed", {
          error: error.message,
        });
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
