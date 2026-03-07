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

import { createRAGSearchTool } from './rag-search.tool.js';
import { createBlogOpsTool } from './blog-ops.tool.js';
import { createMCPClientTool } from './mcp-client.tool.js';
import { createWebSearchTool } from './web-search.tool.js';
import { createCodeExecutionTool } from './code-execution.tool.js';

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this._initialized = false;
  }

  async initialize() {
    if (this._initialized) return;

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

  register(tool) {
    if (!tool.name || !tool.execute) {
      throw new Error('Tool must have name and execute function');
    }

    this.tools.set(tool.name, tool);
    console.log(`[ToolRegistry] Registered tool: ${tool.name}`);
  }

  unregister(name) {
    this.tools.delete(name);
  }

  getTool(name) {
    return this.tools.get(name);
  }

  getToolNames() {
    return Array.from(this.tools.keys());
  }

  getToolCount() {
    return this.tools.size;
  }

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

  async execute(name, args) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    return tool.execute(args);
  }
}

let _registry = null;

export function getToolRegistry() {
  if (!_registry) {
    _registry = new ToolRegistry();
    _registry.initialize().catch(err => {
      console.error('[ToolRegistry] Initialization error:', err);
    });
  }
  return _registry;
}

export function createToolRegistry() {
  return new ToolRegistry();
}

export default ToolRegistry;
