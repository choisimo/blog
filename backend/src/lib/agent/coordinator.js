/**
 * Agent Coordinator - AI Agent Orchestration Layer
 * 
 * Core orchestration engine that manages:
 *   - Multi-turn conversations with context
 *   - Tool selection and execution (function calling)
 *   - Memory management (session/persistent/vector)
 *   - Task decomposition and planning
 * 
 * Architecture:
 *   Request -> Coordinator -> Tool Selection -> Tool Execution -> Response
 *                   ↓                                    ↑
 *              Memory Store <─────────────────────────────┘
 * 
 * AI Provider:
 *   - LLM calls: OpenCode Backend (http://opencode-backend:7016)
 *   - RAG/Embeddings: TEI + ChromaDB (via existing containers)
 *   - n8n: Workflow orchestration only (AI model calls proxied to OpenCode)
 * 
 * Usage:
 *   const coordinator = getAgentCoordinator();
 *   const response = await coordinator.run({
 *     sessionId: 'user-123',
 *     messages: [{ role: 'user', content: 'Search my blog for AI articles' }],
 *   });
 */

import { getOpenCodeClient } from '../opencode-client.js';
import { getToolRegistry } from './tools/index.js';
import { getSessionMemory } from './memory/session.js';
import { getPersistentMemory } from './memory/persistent.js';
import { getVectorMemory } from './memory/vector.js';
import { SYSTEM_PROMPTS, buildSystemPrompt } from './prompts/system.js';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_MODEL = process.env.AGENT_MODEL || 'gpt-4.1';
const MAX_TOOL_ITERATIONS = 10;
const MAX_CONTEXT_MESSAGES = 20;
const TOOL_TIMEOUT = 30000;

// ============================================================================
// Logger
// ============================================================================

const logger = {
  _format(level, context, message, data = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'agent-coordinator',
      ...context,
      message,
      ...data,
    });
  },
  info(ctx, msg, data) { console.log(this._format('info', ctx, msg, data)); },
  warn(ctx, msg, data) { console.warn(this._format('warn', ctx, msg, data)); },
  error(ctx, msg, data) { console.error(this._format('error', ctx, msg, data)); },
  debug(ctx, msg, data) {
    if (process.env.DEBUG_AGENT === 'true') {
      console.debug(this._format('debug', ctx, msg, data));
    }
  },
};

// ============================================================================
// Agent Coordinator Class
// ============================================================================

export class AgentCoordinator {
  constructor(options = {}) {
    this.llmClient = options.llmClient || getOpenCodeClient();
    this.toolRegistry = options.toolRegistry || getToolRegistry();
    this.sessionMemory = options.sessionMemory || getSessionMemory();
    this.persistentMemory = options.persistentMemory || getPersistentMemory();
    this.vectorMemory = options.vectorMemory || getVectorMemory();
    
    this.defaultModel = options.model || DEFAULT_MODEL;
    this.maxIterations = options.maxIterations || MAX_TOOL_ITERATIONS;
    
    logger.info({ operation: 'init' }, 'AgentCoordinator initialized', {
      model: this.defaultModel,
      provider: 'opencode',
      toolCount: this.toolRegistry.getToolCount(),
    });
  }

  /**
   * Run the agent with a conversation
   * 
   * @param {object} params
   * @param {string} params.sessionId - Unique session identifier
   * @param {Array} params.messages - Conversation messages
   * @param {string} [params.mode] - Agent mode (default, research, coding, blog)
   * @param {object} [params.context] - Additional context (user info, etc.)
   * @param {object} [params.options] - LLM options (temperature, model)
   * @returns {Promise<{content: string, toolCalls: Array, usage: object}>}
   */
  async run(params) {
    const {
      sessionId,
      messages,
      mode = 'default',
      context = {},
      options = {},
    } = params;

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    logger.info(
      { operation: 'run', runId, sessionId },
      'Starting agent run',
      { mode, messageCount: messages?.length }
    );

    try {
      // 1. Load session memory and history
      const sessionHistory = await this.sessionMemory.getHistory(sessionId, MAX_CONTEXT_MESSAGES);
      
      // 2. Build context-aware system prompt
      const systemPrompt = await this._buildContextualSystemPrompt(mode, context, sessionId);
      
      // 3. Prepare messages with history
      const fullMessages = this._prepareMessages(systemPrompt, sessionHistory, messages);
      
      // 4. Get relevant memories from vector store
      const relevantMemories = await this._retrieveRelevantMemories(messages, sessionId);
      if (relevantMemories.length > 0) {
        fullMessages.splice(1, 0, {
          role: 'system',
          content: `Relevant context from memory:\n${relevantMemories.map(m => `- ${m.content}`).join('\n')}`,
        });
      }

      // 5. Run agent loop with tools
      const result = await this._runAgentLoop(fullMessages, {
        ...options,
        model: options.model || this.defaultModel,
        runId,
      });

      // 6. Save to session memory
      await this.sessionMemory.addMessages(sessionId, [
        ...messages,
        { role: 'assistant', content: result.content },
      ]);

      // 7. Extract and save important information to persistent memory
      await this._extractAndSaveMemories(result.content, messages, sessionId);

      const duration = Date.now() - startTime;
      logger.info(
        { operation: 'run', runId, sessionId },
        'Agent run completed',
        { duration, toolCalls: result.toolCalls?.length || 0 }
      );

      return {
        ...result,
        sessionId,
        runId,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        { operation: 'run', runId, sessionId },
        'Agent run failed',
        { duration, error: error.message }
      );
      throw error;
    }
  }

  /**
   * Run agent loop with tool execution
   */
  async _runAgentLoop(messages, options) {
    const { runId, model } = options;
    const toolCalls = [];
    let currentMessages = [...messages];
    let iterations = 0;

    while (iterations < this.maxIterations) {
      iterations++;

      logger.debug(
        { operation: 'loop', runId },
        `Agent iteration ${iterations}`,
        { messageCount: currentMessages.length }
      );

      // Call LLM with function calling
      const response = await this._callLLMWithTools(currentMessages, {
        model,
        temperature: options.temperature ?? 0.7,
      });

      // Check if LLM wants to call tools
      if (response.toolCalls && response.toolCalls.length > 0) {
        logger.info(
          { operation: 'tool_call', runId },
          'LLM requested tool calls',
          { tools: response.toolCalls.map(t => t.function.name) }
        );

        // Execute tools
        const toolResults = await this._executeTools(response.toolCalls, runId);
        toolCalls.push(...response.toolCalls.map((tc, i) => ({
          ...tc,
          result: toolResults[i],
        })));

        // Add assistant message with tool calls
        currentMessages.push({
          role: 'assistant',
          content: response.content || null,
          tool_calls: response.toolCalls,
        });

        // Add tool results
        for (let i = 0; i < response.toolCalls.length; i++) {
          currentMessages.push({
            role: 'tool',
            tool_call_id: response.toolCalls[i].id,
            content: JSON.stringify(toolResults[i]),
          });
        }

        // Continue loop to let LLM process tool results
        continue;
      }

      // No more tool calls, return final response
      return {
        content: response.content,
        toolCalls,
        usage: response.usage,
        model: response.model,
        iterations,
      };
    }

    // Max iterations reached
    logger.warn(
      { operation: 'loop', runId },
      'Max iterations reached',
      { iterations: this.maxIterations }
    );

    return {
      content: 'I apologize, but I was unable to complete the task within the allowed iterations. Please try breaking down your request into smaller steps.',
      toolCalls,
      iterations,
      maxIterationsReached: true,
    };
  }

  /**
   * Call LLM with function calling support
   * 
   * Since OpenCode's /chat endpoint doesn't support OpenAI-style function calling,
   * we implement prompt-based tool calling:
   * 1. Include tool definitions in a system message
   * 2. Parse LLM response for tool call requests (JSON format)
   * 3. Return parsed tool calls for execution
   */
  async _callLLMWithTools(messages, options) {
    const tools = this.toolRegistry.getToolDefinitions();
    
    try {
      // Build messages with tool instructions
      const messagesWithTools = this._injectToolInstructions(messages, tools);
      
      // Format messages for OpenCode /chat endpoint
      const formattedPrompt = this._formatMessagesForOpenCode(messagesWithTools);
      
      // Call OpenCode chat endpoint
      const response = await this.llmClient.chat(
        [{ role: 'user', content: formattedPrompt }],
        {
          model: options.model || this.defaultModel,
          title: `agent-${Date.now()}`,
        }
      );

      // Parse response for tool calls
      const parsedResponse = this._parseToolCallsFromResponse(response.content);

      return {
        content: parsedResponse.content,
        toolCalls: parsedResponse.toolCalls,
        usage: null, // OpenCode doesn't return usage stats in same format
        model: options.model || this.defaultModel,
        finishReason: parsedResponse.toolCalls?.length > 0 ? 'tool_calls' : 'stop',
        sessionId: response.sessionId,
      };
    } catch (error) {
      logger.error({ operation: 'llm_call' }, 'LLM call failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Inject tool definitions into messages as a system instruction
   */
  _injectToolInstructions(messages, tools) {
    if (!tools || tools.length === 0) {
      return messages;
    }

    const toolsDescription = tools.map(t => {
      const func = t.function;
      const params = func.parameters?.properties || {};
      const required = func.parameters?.required || [];
      
      const paramsStr = Object.entries(params)
        .map(([name, schema]) => {
          const req = required.includes(name) ? '(required)' : '(optional)';
          return `    - ${name} ${req}: ${schema.description || schema.type}`;
        })
        .join('\n');
      
      return `- ${func.name}: ${func.description}\n  Parameters:\n${paramsStr}`;
    }).join('\n\n');

    const toolInstructions = `
You have access to the following tools. To use a tool, respond with a JSON block in this exact format:

\`\`\`tool_call
{
  "tool": "tool_name",
  "arguments": { "param1": "value1", "param2": "value2" }
}
\`\`\`

You can make multiple tool calls by including multiple tool_call blocks.
After receiving tool results, synthesize them into a helpful response.
If you don't need to use any tools, just respond normally without the tool_call block.

Available tools:
${toolsDescription}
`;

    // Find existing system message or create one
    const result = [...messages];
    const systemIndex = result.findIndex(m => m.role === 'system');
    
    if (systemIndex >= 0) {
      result[systemIndex] = {
        ...result[systemIndex],
        content: result[systemIndex].content + '\n\n' + toolInstructions,
      };
    } else {
      result.unshift({
        role: 'system',
        content: toolInstructions,
      });
    }

    return result;
  }

  /**
   * Format messages array into a single prompt for OpenCode's /chat endpoint
   */
  _formatMessagesForOpenCode(messages) {
    return messages.map(m => {
      const role = m.role === 'assistant' ? 'Assistant' 
                 : m.role === 'system' ? 'System'
                 : m.role === 'tool' ? 'Tool Result'
                 : 'User';
      
      let content = m.content || '';
      
      // For tool messages, include the tool_call_id
      if (m.role === 'tool' && m.tool_call_id) {
        content = `[Tool: ${m.tool_call_id}]\n${content}`;
      }
      
      return `${role}:\n${content}`;
    }).join('\n\n---\n\n');
  }

  /**
   * Parse tool calls from LLM response text
   * Looks for ```tool_call ... ``` blocks
   */
  _parseToolCallsFromResponse(responseText) {
    if (!responseText) {
      return { content: '', toolCalls: null };
    }

    const toolCallRegex = /```tool_call\s*([\s\S]*?)```/g;
    const toolCalls = [];
    let match;
    let cleanContent = responseText;

    while ((match = toolCallRegex.exec(responseText)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        
        if (parsed.tool && parsed.arguments !== undefined) {
          toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'function',
            function: {
              name: parsed.tool,
              arguments: JSON.stringify(parsed.arguments),
            },
          });
        }
        
        // Remove tool_call block from content
        cleanContent = cleanContent.replace(match[0], '').trim();
      } catch (e) {
        logger.warn(
          { operation: 'parse_tool_call' },
          'Failed to parse tool call block',
          { block: match[1], error: e.message }
        );
      }
    }

    return {
      content: cleanContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : null,
    };
  }

  /**
   * Execute tool calls
   */
  async _executeTools(toolCalls, runId) {
    const results = [];

    for (const toolCall of toolCalls) {
      const { name, arguments: argsStr } = toolCall.function;
      const toolId = toolCall.id;

      logger.debug(
        { operation: 'tool_exec', runId, toolId },
        `Executing tool: ${name}`
      );

      try {
        const args = JSON.parse(argsStr || '{}');
        const tool = this.toolRegistry.getTool(name);

        if (!tool) {
          results.push({ error: `Tool not found: ${name}` });
          continue;
        }

        // Execute with timeout
        const result = await Promise.race([
          tool.execute(args),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Tool execution timeout')), TOOL_TIMEOUT)
          ),
        ]);

        results.push(result);

        logger.info(
          { operation: 'tool_exec', runId, toolId },
          `Tool ${name} completed`,
          { resultType: typeof result }
        );
      } catch (error) {
        logger.error(
          { operation: 'tool_exec', runId, toolId },
          `Tool ${name} failed`,
          { error: error.message }
        );
        results.push({ error: error.message });
      }
    }

    return results;
  }

  /**
   * Build contextual system prompt
   */
  async _buildContextualSystemPrompt(mode, context, sessionId) {
    // Get user preferences from persistent memory
    const userPrefs = await this.persistentMemory.getUserPreferences(sessionId);
    
    return buildSystemPrompt({
      mode,
      ...context,
      userPreferences: userPrefs,
      customInstructions: context.customInstructions,
    });
  }

  /**
   * Prepare messages with history
   */
  _prepareMessages(systemPrompt, history, newMessages) {
    const messages = [{ role: 'system', content: systemPrompt }];
    
    // Add history (limited)
    if (history && history.length > 0) {
      messages.push(...history.slice(-MAX_CONTEXT_MESSAGES));
    }
    
    // Add new messages
    messages.push(...newMessages);
    
    return messages;
  }

  /**
   * Retrieve relevant memories from vector store
   */
  async _retrieveRelevantMemories(messages, sessionId) {
    try {
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      if (!lastUserMessage) return [];

      return await this.vectorMemory.search(lastUserMessage.content, {
        sessionId,
        limit: 5,
        minScore: 0.7,
      });
    } catch (error) {
      logger.warn(
        { operation: 'memory_retrieval' },
        'Failed to retrieve memories',
        { error: error.message }
      );
      return [];
    }
  }

  /**
   * Extract and save important information to memories
   */
  async _extractAndSaveMemories(response, messages, sessionId) {
    try {
      // Simple extraction: save user intents and assistant responses
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      
      if (lastUserMessage && response) {
        // Save to vector memory for semantic search
        await this.vectorMemory.add({
          content: `User: ${lastUserMessage.content}\nAssistant: ${response.slice(0, 500)}`,
          sessionId,
          timestamp: new Date().toISOString(),
          type: 'conversation',
        });
      }
    } catch (error) {
      logger.warn(
        { operation: 'memory_save' },
        'Failed to save memories',
        { error: error.message }
      );
    }
  }

  /**
   * Stream agent response
   * 
   * Since OpenCode backend doesn't have native SSE streaming for chat,
   * we use a simulated streaming approach:
   * 1. Get full response from OpenCode
   * 2. Chunk and yield content progressively
   * 3. Handle tool calls between iterations
   * 
   * @param {object} params - Same as run()
   * @yields {object} Stream events: { type: 'text'|'tool_start'|'tool_end'|'done', data: any }
   */
  async *stream(params) {
    const {
      sessionId,
      messages,
      mode = 'default',
      context = {},
      options = {},
    } = params;

    const runId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    logger.info({ operation: 'stream', runId, sessionId }, 'Starting agent stream');

    // Load context
    const sessionHistory = await this.sessionMemory.getHistory(sessionId, MAX_CONTEXT_MESSAGES);
    const systemPrompt = await this._buildContextualSystemPrompt(mode, context, sessionId);
    const fullMessages = this._prepareMessages(systemPrompt, sessionHistory, messages);

    // Get relevant memories
    const relevantMemories = await this._retrieveRelevantMemories(messages, sessionId);
    if (relevantMemories.length > 0) {
      fullMessages.splice(1, 0, {
        role: 'system',
        content: `Relevant context:\n${relevantMemories.map(m => `- ${m.content}`).join('\n')}`,
      });
    }

    const tools = this.toolRegistry.getToolDefinitions();
    let currentMessages = [...fullMessages];
    let iterations = 0;
    const toolCalls = [];

    while (iterations < this.maxIterations) {
      iterations++;

      // Inject tool instructions and format for OpenCode
      const messagesWithTools = this._injectToolInstructions(currentMessages, tools);
      const formattedPrompt = this._formatMessagesForOpenCode(messagesWithTools);

      // Call OpenCode (non-streaming, then simulate streaming)
      let response;
      try {
        response = await this.llmClient.chat(
          [{ role: 'user', content: formattedPrompt }],
          {
            model: options.model || this.defaultModel,
            title: `agent-stream-${runId}`,
          }
        );
      } catch (error) {
        yield { type: 'error', data: { message: error.message } };
        return;
      }

      const fullContent = response.content || '';
      
      // Parse for tool calls
      const parsed = this._parseToolCallsFromResponse(fullContent);

      // Simulate streaming by chunking the content
      if (parsed.content) {
        const chunkSize = 40;
        for (let i = 0; i < parsed.content.length; i += chunkSize) {
          const chunk = parsed.content.slice(i, Math.min(i + chunkSize, parsed.content.length));
          yield { type: 'text', data: chunk };
          // Small delay to simulate streaming
          await new Promise(r => setTimeout(r, 15));
        }
      }

      // Handle tool calls
      if (parsed.toolCalls && parsed.toolCalls.length > 0) {
        for (const tc of parsed.toolCalls) {
          yield { type: 'tool_start', data: { name: tc.function.name, id: tc.id } };

          try {
            const args = JSON.parse(tc.function.arguments || '{}');
            const tool = this.toolRegistry.getTool(tc.function.name);
            const result = tool ? await tool.execute(args) : { error: 'Tool not found' };

            toolCalls.push({ ...tc, result });
            yield { type: 'tool_end', data: { name: tc.function.name, result } };

            // Add to messages for next iteration
            currentMessages.push({
              role: 'assistant',
              content: parsed.content || null,
            });
            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            });
          } catch (error) {
            yield { type: 'tool_error', data: { name: tc.function.name, error: error.message } };
          }
        }
        continue; // Continue loop to process tool results
      }

      // No tool calls, we're done
      yield { type: 'done', data: { content: parsed.content, toolCalls } };

      // Save to memory
      await this.sessionMemory.addMessages(sessionId, [
        ...messages,
        { role: 'assistant', content: parsed.content },
      ]);

      return;
    }

    yield { type: 'error', data: { message: 'Max iterations reached' } };
  }

  /**
   * Get session info
   */
  async getSession(sessionId) {
    const history = await this.sessionMemory.getHistory(sessionId);
    const metadata = await this.sessionMemory.getMetadata(sessionId);
    return { sessionId, history, metadata };
  }

  /**
   * Clear session
   */
  async clearSession(sessionId) {
    await this.sessionMemory.clear(sessionId);
    logger.info({ operation: 'clear_session' }, 'Session cleared', { sessionId });
  }

  /**
   * Extract memories from conversation messages
   * This is a simplified implementation - in production, you'd want to use
   * the LLM to intelligently extract facts and preferences
   */
  async extractMemories(messages) {
    const memories = [];
    
    for (const msg of messages) {
      if (msg.role === 'user' && msg.content) {
        // Simple extraction - look for key patterns
        const content = msg.content;
        
        // Extract preferences (e.g., "I prefer...", "I like...")
        const preferencePatterns = [
          /I (?:prefer|like|love|enjoy|want)\s+(.+?)(?:\.|$)/gi,
          /my (?:favorite|preferred)\s+(?:is|are)\s+(.+?)(?:\.|$)/gi,
        ];
        
        for (const pattern of preferencePatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            memories.push({
              type: 'preference',
              content: match[0].trim(),
              extractedAt: new Date().toISOString(),
            });
          }
        }
        
        // Extract facts (e.g., "I am...", "I work...")
        const factPatterns = [
          /I (?:am|work|live|have)\s+(.+?)(?:\.|$)/gi,
          /my (?:name|job|work|company)\s+(?:is|are)\s+(.+?)(?:\.|$)/gi,
        ];
        
        for (const pattern of factPatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            memories.push({
              type: 'fact',
              content: match[0].trim(),
              extractedAt: new Date().toISOString(),
            });
          }
        }
      }
    }
    
    return memories;
  }

  /**
   * Search memories semantically
   */
  async searchMemories(query, options = {}) {
    const { userId, limit = 10, sessionId } = options;
    
    try {
      const results = await this.vectorMemory.search(query, {
        sessionId: sessionId || userId,
        limit,
        minScore: 0.5,
      });
      
      return results.map(r => ({
        content: r.content,
        score: r.score,
        metadata: r.metadata,
      }));
    } catch (error) {
      logger.warn(
        { operation: 'search_memories' },
        'Failed to search memories',
        { error: error.message }
      );
      return [];
    }
  }

  /**
   * Health check
   */
  async health() {
    const llmHealth = await this.llmClient.health();
    const toolCount = this.toolRegistry.getToolCount();

    return {
      ok: llmHealth.ok,
      llm: llmHealth,
      tools: {
        count: toolCount,
        names: this.toolRegistry.getToolNames(),
      },
    };
  }
}

// ============================================================================
// Singleton & Exports
// ============================================================================

let _coordinator = null;

/**
 * Get the singleton AgentCoordinator instance
 */
export function getAgentCoordinator() {
  if (!_coordinator) {
    _coordinator = new AgentCoordinator();
  }
  return _coordinator;
}

/**
 * Create AgentCoordinator with custom options
 */
export function createAgentCoordinator(options) {
  return new AgentCoordinator(options);
}

export default AgentCoordinator;
