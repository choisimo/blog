/**
 * Tool Registry - Central registry for all available tools
 * 
 * Manages tool definitions and execution for the Agent Coordinator.
 * Tools are defined in OpenAI function calling format.
 * 
 * Usage:
 *   const registry = getToolRegistry();
 *   registry.register(myTool);
 *   const tools = registry.getToolDefinitions();
 */

import { createRAGSearchTool } from './rag-search.js';
import { createBlogOpsTool } from './blog-ops.js';
import { createMCPClientTool } from './mcp-client.js';
import { createWebSearchTool } from './web-search.js';
import { createCodeExecutionTool } from './code-execution.js';

// ============================================================================
// Tool Interface
// ============================================================================

/**
 * Tool Definition Interface
 * @typedef {object} Tool
 * @property {string} name - Unique tool identifier
 * @property {string} description - Human-readable description
 * @property {object} parameters - JSON Schema for parameters
 * @property {function} execute - Async function to execute the tool
 */

// ============================================================================
// Tool Registry Class
// ============================================================================

export class ToolRegistry {
  constructor() {
    /** @type {Map<string, Tool>} */
    this.tools = new Map();
    this._initialized = false;
  }

  /**
   * Initialize with default tools
   */
  async initialize() {
    if (this._initialized) return;

    // Register built-in tools
    const builtInTools = [
      createRAGSearchTool(),
      createBlogOpsTool(),
      createWebSearchTool(),
      createCodeExecutionTool(),
    ];

    for (const tool of builtInTools) {
      if (tool) {
        this.register(tool);
      }
    }

    // Try to initialize MCP tools (optional)
    try {
      const mcpTool = await createMCPClientTool();
      if (mcpTool) {
        this.register(mcpTool);
      }
    } catch (error) {
      console.warn('[ToolRegistry] MCP tool initialization failed:', error.message);
    }

    this._initialized = true;
    console.log(`[ToolRegistry] Initialized with ${this.tools.size} tools`);
  }

  /**
   * Register a tool
   * @param {Tool} tool
   */
  register(tool) {
    if (!tool.name || !tool.execute) {
      throw new Error('Tool must have name and execute function');
    }

    this.tools.set(tool.name, tool);
    console.log(`[ToolRegistry] Registered tool: ${tool.name}`);
  }

  /**
   * Unregister a tool
   * @param {string} name
   */
  unregister(name) {
    this.tools.delete(name);
  }

  /**
   * Get a tool by name
   * @param {string} name
   * @returns {Tool|undefined}
   */
  getTool(name) {
    return this.tools.get(name);
  }

  /**
   * Get all tool names
   * @returns {string[]}
   */
  getToolNames() {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tool count
   * @returns {number}
   */
  getToolCount() {
    return this.tools.size;
  }

  /**
   * Get tool definitions in OpenAI format
   * @returns {Array<{type: 'function', function: object}>}
   */
  getToolDefinitions() {
    const definitions = [];

    for (const tool of this.tools.values()) {
      definitions.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters || {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      });
    }

    return definitions;
  }

  /**
   * Execute a tool by name
   * @param {string} name
   * @param {object} args
   * @returns {Promise<any>}
   */
  async execute(name, args) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    return tool.execute(args);
  }
}

// ============================================================================
// Singleton & Exports
// ============================================================================

let _registry = null;

/**
 * Get the singleton ToolRegistry instance
 */
export function getToolRegistry() {
  if (!_registry) {
    _registry = new ToolRegistry();
    // Initialize asynchronously
    _registry.initialize().catch(err => {
      console.error('[ToolRegistry] Initialization error:', err);
    });
  }
  return _registry;
}

/**
 * Create a new ToolRegistry instance
 */
export function createToolRegistry() {
  return new ToolRegistry();
}

export default ToolRegistry;
