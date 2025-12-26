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
 * Usage:
 *   const coordinator = getAgentCoordinator();
 *   const response = await coordinator.run({
 *     sessionId: 'user-123',
 *     messages: [{ role: 'user', content: 'Search my blog for AI articles' }],
 *   });
 */

import { getLiteLLMClient } from '../litellm-client.js';
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
    this.llmClient = options.llmClient || getLiteLLMClient();
    this.toolRegistry = options.toolRegistry || getToolRegistry();
    this.sessionMemory = options.sessionMemory || getSessionMemory();
    this.persistentMemory = options.persistentMemory || getPersistentMemory();
    this.vectorMemory = options.vectorMemory || getVectorMemory();
    
    this.defaultModel = options.model || DEFAULT_MODEL;
    this.maxIterations = options.maxIterations || MAX_TOOL_ITERATIONS;
    
    logger.info({ operation: 'init' }, 'AgentCoordinator initialized', {
      model: this.defaultModel,
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
   */
  async _callLLMWithTools(messages, options) {
    const tools = this.toolRegistry.getToolDefinitions();
    
    try {
      const response = await fetch(`${this.llmClient.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.llmClient.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model || this.defaultModel,
          messages,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? 'auto' : undefined,
          temperature: options.temperature ?? 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.text().catch(() => '');
        throw new Error(`LLM call failed: ${response.status} ${error}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      return {
        content: choice?.message?.content || '',
        toolCalls: choice?.message?.tool_calls,
        usage: data.usage,
        model: data.model,
        finishReason: choice?.finish_reason,
      };
    } catch (error) {
      logger.error({ operation: 'llm_call' }, 'LLM call failed', { error: error.message });
      throw error;
    }
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

      // Stream from LLM
      const response = await fetch(`${this.llmClient.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.llmClient.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model || this.defaultModel,
          messages: currentMessages,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? 'auto' : undefined,
          temperature: options.temperature ?? 0.7,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM stream failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      let accumulatedToolCalls = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              if (delta?.content) {
                accumulatedContent += delta.content;
                yield { type: 'text', data: delta.content };
              }

              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.index !== undefined) {
                    if (!accumulatedToolCalls[tc.index]) {
                      accumulatedToolCalls[tc.index] = {
                        id: tc.id || '',
                        type: 'function',
                        function: { name: '', arguments: '' },
                      };
                    }
                    if (tc.id) accumulatedToolCalls[tc.index].id = tc.id;
                    if (tc.function?.name) accumulatedToolCalls[tc.index].function.name += tc.function.name;
                    if (tc.function?.arguments) accumulatedToolCalls[tc.index].function.arguments += tc.function.arguments;
                  }
                }
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      reader.releaseLock();

      // Handle tool calls
      if (accumulatedToolCalls.length > 0) {
        for (const tc of accumulatedToolCalls) {
          yield { type: 'tool_start', data: { name: tc.function.name, id: tc.id } };

          try {
            const args = JSON.parse(tc.function.arguments || '{}');
            const tool = this.toolRegistry.getTool(tc.function.name);
            const result = tool ? await tool.execute(args) : { error: 'Tool not found' };

            toolCalls.push({ ...tc, result });
            yield { type: 'tool_end', data: { name: tc.function.name, result } };

            currentMessages.push({
              role: 'assistant',
              content: accumulatedContent || null,
              tool_calls: accumulatedToolCalls,
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

      // No tool calls, done
      yield { type: 'done', data: { content: accumulatedContent, toolCalls } };

      // Save to memory
      await this.sessionMemory.addMessages(sessionId, [
        ...messages,
        { role: 'assistant', content: accumulatedContent },
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
