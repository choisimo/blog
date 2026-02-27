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
 *   - LLM calls: OpenAI-compatible server (AI_SERVER_URL or OPENAI_API_BASE_URL)
 *   - RAG/Embeddings: OpenAI-compatible embeddings + ChromaDB
 *   - AI orchestration: handled by backend AI service
 *
 * Usage:
 *   const coordinator = getAgentCoordinator();
 *   const response = await coordinator.run({
 *     sessionId: 'user-123',
 *     messages: [{ role: 'user', content: 'Search my blog for AI articles' }],
 *   });
 */

import { getAIService } from "../ai/ai.service.js";
import { getToolRegistry } from "./tools/index.js";
import { getSessionMemory } from "../../repositories/memory/session.repository.js";
import { getPersistentMemory } from "../../repositories/memory/persistent.repository.js";
import { getVectorMemory } from "../../repositories/memory/vector.repository.js";
import {
  SYSTEM_PROMPTS,
  buildSystemPrompt,
} from "../../lib/agent/prompts/system.js";
import { AGENT } from "../../config/constants.js";

const DEFAULT_MODEL = process.env.AGENT_MODEL || "gpt-4.1";
const MAX_TOOL_ITERATIONS = AGENT.MAX_TOOL_ITERATIONS;
const MAX_CONTEXT_MESSAGES = AGENT.MAX_CONTEXT_MESSAGES;
const TOOL_TIMEOUT = Math.max(
  3_000,
  Number.parseInt(process.env.AGENT_TOOL_TIMEOUT_MS || "12000", 10),
);
const MEMORY_TIMEOUT = Math.max(
  300,
  Number.parseInt(process.env.AGENT_MEMORY_TIMEOUT_MS || "1200", 10),
);
const SYSTEM_PROMPT_TIMEOUT = Math.max(
  300,
  Number.parseInt(process.env.AGENT_SYSTEM_PROMPT_TIMEOUT_MS || "1000", 10),
);
const USER_PREFERENCE_TIMEOUT = Math.max(
  300,
  Number.parseInt(process.env.AGENT_USER_PREFERENCE_TIMEOUT_MS || "800", 10),
);

async function withTimeout(promise, timeoutMs, timeoutErrorMessage) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(timeoutErrorMessage || `Timeout after ${timeoutMs}ms`),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const logger = {
  _format(level, context, message, data = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: "agent-coordinator",
      ...context,
      message,
      ...data,
    });
  },
  info(ctx, msg, data) {
    console.log(this._format("info", ctx, msg, data));
  },
  warn(ctx, msg, data) {
    console.warn(this._format("warn", ctx, msg, data));
  },
  error(ctx, msg, data) {
    console.error(this._format("error", ctx, msg, data));
  },
  debug(ctx, msg, data) {
    if (process.env.DEBUG_AGENT === "true") {
      console.debug(this._format("debug", ctx, msg, data));
    }
  },
};

export class AgentCoordinator {
  constructor(options = {}) {
    this._aiService = options.aiService || getAIService();
    this.toolRegistry = options.toolRegistry || getToolRegistry();
    this.sessionMemory = options.sessionMemory || getSessionMemory();
    this.persistentMemory = options.persistentMemory || getPersistentMemory();
    this.vectorMemory = options.vectorMemory || getVectorMemory();

    this.defaultModel = options.model || DEFAULT_MODEL;
    this.maxIterations = options.maxIterations || MAX_TOOL_ITERATIONS;

    logger.info({ operation: "init" }, "AgentCoordinator initialized", {
      model: this.defaultModel,
      provider: "ai-service",
      toolCount: this.toolRegistry.getToolCount(),
    });
  }

  async run(params) {
    const {
      sessionId,
      messages,
      mode = "default",
      context = {},
      options = {},
    } = params;

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    logger.info({ operation: "run", runId, sessionId }, "Starting agent run", {
      mode,
      messageCount: messages?.length,
    });

    try {
      const [sessionHistory, systemPrompt, relevantMemories] =
        await Promise.all([
          this.sessionMemory.getHistory(sessionId, MAX_CONTEXT_MESSAGES),
          withTimeout(
            this._buildContextualSystemPrompt(mode, context, sessionId),
            SYSTEM_PROMPT_TIMEOUT,
            "System prompt timeout",
          ).catch(() => this._buildFastSystemPrompt(mode, context)),
          withTimeout(
            this._retrieveRelevantMemories(messages, sessionId),
            MEMORY_TIMEOUT,
            "Relevant memory lookup timeout",
          ).catch(() => []),
        ]);

      const fullMessages = this._prepareMessages(
        systemPrompt,
        sessionHistory,
        messages,
      );

      if (relevantMemories.length > 0) {
        fullMessages.splice(1, 0, {
          role: "system",
          content: `Relevant context from memory:\n${relevantMemories.map((m) => `- ${m.content}`).join("\n")}`,
        });
      }

      const result = await this._runAgentLoop(fullMessages, {
        ...options,
        model: options.model || this.defaultModel,
        runId,
      });

      await this.sessionMemory.addMessages(sessionId, [
        ...messages,
        { role: "assistant", content: result.content },
      ]);

      await this._extractAndSaveMemories(result.content, messages, sessionId);

      const duration = Date.now() - startTime;
      logger.info(
        { operation: "run", runId, sessionId },
        "Agent run completed",
        { duration, toolCalls: result.toolCalls?.length || 0 },
      );

      return {
        ...result,
        sessionId,
        runId,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ operation: "run", runId, sessionId }, "Agent run failed", {
        duration,
        error: error.message,
      });
      throw error;
    }
  }

  async _runAgentLoop(messages, options) {
    const { runId, model } = options;
    const maxIterations = Number.isFinite(options.maxIterations)
      ? Math.max(1, Math.min(20, Math.floor(options.maxIterations)))
      : this.maxIterations;
    const toolCalls = [];
    let currentMessages = [...messages];
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      logger.debug(
        { operation: "loop", runId },
        `Agent iteration ${iterations}`,
        { messageCount: currentMessages.length },
      );

      const response = await this._callLLMWithTools(currentMessages, {
        model,
        temperature: options.temperature ?? 0.7,
      });

      if (response.toolCalls && response.toolCalls.length > 0) {
        logger.info(
          { operation: "tool_call", runId },
          "LLM requested tool calls",
          { tools: response.toolCalls.map((t) => t.function.name) },
        );

        const toolResults = await this._executeTools(response.toolCalls, runId);
        toolCalls.push(
          ...response.toolCalls.map((tc, i) => ({
            ...tc,
            result: toolResults[i],
          })),
        );

        currentMessages.push({
          role: "assistant",
          content: response.content || null,
          tool_calls: response.toolCalls,
        });

        for (let i = 0; i < response.toolCalls.length; i++) {
          currentMessages.push({
            role: "tool",
            tool_call_id: response.toolCalls[i].id,
            content: JSON.stringify(toolResults[i]),
          });
        }

        continue;
      }

      return {
        content: response.content,
        toolCalls,
        usage: response.usage,
        model: response.model,
        iterations,
      };
    }

    logger.warn({ operation: "loop", runId }, "Max iterations reached", {
      iterations: maxIterations,
    });

    return {
      content:
        "I apologize, but I was unable to complete the task within the allowed iterations. Please try breaking down your request into smaller steps.",
      toolCalls,
      iterations,
      maxIterationsReached: true,
    };
  }

  async _callLLMWithTools(messages, options) {
    const tools = this.toolRegistry.getToolDefinitions();

    try {
      const messagesWithTools = this._injectToolInstructions(messages, tools);
      const formattedPrompt = this._formatMessagesForChat(messagesWithTools);

      const response = await this._aiService.chat(
        [{ role: "user", content: formattedPrompt }],
        {
          model: options.model || this.defaultModel,
        },
      );

      const parsedResponse = this._parseToolCallsFromResponse(response.content);

      return {
        content: parsedResponse.content,
        toolCalls: parsedResponse.toolCalls,
        usage: response.usage,
        model: response.model || options.model || this.defaultModel,
        finishReason:
          parsedResponse.toolCalls?.length > 0 ? "tool_calls" : "stop",
        sessionId: response.sessionId,
      };
    } catch (error) {
      logger.error({ operation: "llm_call" }, "LLM call failed", {
        error: error.message,
      });
      throw error;
    }
  }

  _injectToolInstructions(messages, tools) {
    if (!tools || tools.length === 0) {
      return messages;
    }

    const toolsDescription = tools
      .map((t) => {
        const func = t.function;
        const params = func.parameters?.properties || {};
        const required = func.parameters?.required || [];

        const paramsStr = Object.entries(params)
          .map(([name, schema]) => {
            const req = required.includes(name) ? "(required)" : "(optional)";
            return `    - ${name} ${req}: ${schema.description || schema.type}`;
          })
          .join("\n");

        return `- ${func.name}: ${func.description}\n  Parameters:\n${paramsStr}`;
      })
      .join("\n\n");

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

    const result = [...messages];
    const systemIndex = result.findIndex((m) => m.role === "system");

    if (systemIndex >= 0) {
      result[systemIndex] = {
        ...result[systemIndex],
        content: result[systemIndex].content + "\n\n" + toolInstructions,
      };
    } else {
      result.unshift({
        role: "system",
        content: toolInstructions,
      });
    }

    return result;
  }

  _formatMessagesForChat(messages) {
    return messages
      .map((m) => {
        const role =
          m.role === "assistant"
            ? "Assistant"
            : m.role === "system"
              ? "System"
              : m.role === "tool"
                ? "Tool Result"
                : "User";

        let content = m.content || "";

        if (m.role === "tool" && m.tool_call_id) {
          content = `[Tool: ${m.tool_call_id}]\n${content}`;
        }

        return `${role}:\n${content}`;
      })
      .join("\n\n---\n\n");
  }

  _parseToolCallsFromResponse(responseText) {
    if (!responseText) {
      return { content: "", toolCalls: null };
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
            type: "function",
            function: {
              name: parsed.tool,
              arguments: JSON.stringify(parsed.arguments),
            },
          });
        }

        cleanContent = cleanContent.replace(match[0], "").trim();
      } catch (e) {
        logger.warn(
          { operation: "parse_tool_call" },
          "Failed to parse tool call block",
          { block: match[1], error: e.message },
        );
      }
    }

    return {
      content: cleanContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : null,
    };
  }

  async _executeTools(toolCalls, runId) {
    return Promise.all(
      toolCalls.map((toolCall) => this._executeSingleTool(toolCall, runId)),
    );
  }

  async _executeSingleTool(toolCall, runId) {
    const { name, arguments: argsStr } = toolCall.function;
    const toolId = toolCall.id;

    logger.debug(
      { operation: "tool_exec", runId, toolId },
      `Executing tool: ${name}`,
    );

    try {
      const args = JSON.parse(argsStr || "{}");
      const tool = this.toolRegistry.getTool(name);

      if (!tool) {
        return { error: `Tool not found: ${name}` };
      }

      const result = await withTimeout(
        tool.execute(args),
        TOOL_TIMEOUT,
        "Tool execution timeout",
      );

      logger.info(
        { operation: "tool_exec", runId, toolId },
        `Tool ${name} completed`,
        { resultType: typeof result },
      );
      return result;
    } catch (error) {
      logger.error(
        { operation: "tool_exec", runId, toolId },
        `Tool ${name} failed`,
        { error: error.message },
      );
      return { error: error.message };
    }
  }

  async _buildContextualSystemPrompt(mode, context, sessionId) {
    const userPrefs = await withTimeout(
      this.persistentMemory.getUserPreferences(sessionId),
      USER_PREFERENCE_TIMEOUT,
      "User preference timeout",
    ).catch(() => ({}));

    return buildSystemPrompt({
      mode,
      ...context,
      userPreferences: userPrefs,
      customInstructions: context.customInstructions,
    });
  }

  _buildFastSystemPrompt(mode, context = {}) {
    return buildSystemPrompt({
      mode,
      ...context,
      customInstructions: context.customInstructions,
    });
  }

  _prepareMessages(systemPrompt, history, newMessages) {
    const messages = [{ role: "system", content: systemPrompt }];

    if (history && history.length > 0) {
      messages.push(...history.slice(-MAX_CONTEXT_MESSAGES));
    }

    messages.push(...newMessages);

    return messages;
  }

  async _retrieveRelevantMemories(messages, sessionId) {
    try {
      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      if (!lastUserMessage) return [];

      return await withTimeout(
        this.vectorMemory.search(lastUserMessage.content, {
          sessionId,
          limit: 5,
          minScore: 0.7,
        }),
        MEMORY_TIMEOUT,
        "Vector memory timeout",
      );
    } catch (error) {
      logger.warn(
        { operation: "memory_retrieval" },
        "Failed to retrieve memories",
        { error: error.message },
      );
      return [];
    }
  }

  async _extractAndSaveMemories(response, messages, sessionId) {
    try {
      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m.role === "user");

      if (lastUserMessage && response) {
        await this.vectorMemory.add({
          content: `User: ${lastUserMessage.content}\nAssistant: ${response.slice(0, 500)}`,
          sessionId,
          timestamp: new Date().toISOString(),
          type: "conversation",
        });
      }
    } catch (error) {
      logger.warn({ operation: "memory_save" }, "Failed to save memories", {
        error: error.message,
      });
    }
  }

  async *stream(params) {
    const {
      sessionId,
      messages,
      mode = "default",
      context = {},
      options = {},
    } = params;

    const runId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    logger.info(
      { operation: "stream", runId, sessionId },
      "Starting agent stream",
    );

    const [sessionHistory, systemPrompt, relevantMemories] = await Promise.all([
      this.sessionMemory.getHistory(sessionId, MAX_CONTEXT_MESSAGES),
      withTimeout(
        this._buildContextualSystemPrompt(mode, context, sessionId),
        SYSTEM_PROMPT_TIMEOUT,
        "System prompt timeout",
      ).catch(() => this._buildFastSystemPrompt(mode, context)),
      withTimeout(
        this._retrieveRelevantMemories(messages, sessionId),
        MEMORY_TIMEOUT,
        "Relevant memory timeout",
      ).catch(() => []),
    ]);
    const fullMessages = this._prepareMessages(
      systemPrompt,
      sessionHistory,
      messages,
    );

    if (relevantMemories.length > 0) {
      fullMessages.splice(1, 0, {
        role: "system",
        content: `Relevant context:\n${relevantMemories.map((m) => `- ${m.content}`).join("\n")}`,
      });
    }

    const tools = this.toolRegistry.getToolDefinitions();
    let currentMessages = [...fullMessages];
    let iterations = 0;
    const maxIterations = Number.isFinite(options.maxIterations)
      ? Math.max(1, Math.min(20, Math.floor(options.maxIterations)))
      : this.maxIterations;
    const toolCalls = [];

    while (iterations < maxIterations) {
      iterations++;

      const messagesWithTools = this._injectToolInstructions(
        currentMessages,
        tools,
      );
      const formattedPrompt = this._formatMessagesForChat(messagesWithTools);

      let response;
      try {
        response = await this._aiService.chat(
          [{ role: "user", content: formattedPrompt }],
          {
            model: options.model || this.defaultModel,
          },
        );
      } catch (error) {
        yield { type: "error", data: { message: error.message } };
        return;
      }

      const fullContent = response.content || "";
      const parsed = this._parseToolCallsFromResponse(fullContent);

      if (parsed.content) {
        const chunkSize = AGENT.STREAM_CHUNK_SIZE;
        for (let i = 0; i < parsed.content.length; i += chunkSize) {
          const chunk = parsed.content.slice(
            i,
            Math.min(i + chunkSize, parsed.content.length),
          );
          yield { type: "text", data: chunk };
          await new Promise((r) => setTimeout(r, AGENT.STREAM_CHUNK_DELAY));
        }
      }

      if (parsed.toolCalls && parsed.toolCalls.length > 0) {
        for (const tc of parsed.toolCalls) {
          yield {
            type: "tool_start",
            data: { name: tc.function.name, id: tc.id },
          };
        }

        const toolResults = await this._executeTools(parsed.toolCalls, runId);

        for (let i = 0; i < parsed.toolCalls.length; i += 1) {
          const tc = parsed.toolCalls[i];
          const result = toolResults[i] || { error: "Tool result missing" };

          try {
            toolCalls.push({ ...tc, result });
            if (result?.error) {
              yield {
                type: "tool_error",
                data: { name: tc.function.name, error: result.error },
              };
            } else {
              yield {
                type: "tool_end",
                data: { name: tc.function.name, result },
              };
            }

            currentMessages.push({
              role: "assistant",
              content: parsed.content || null,
            });
            currentMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            });
          } catch (error) {
            yield {
              type: "tool_error",
              data: { name: tc.function.name, error: error.message },
            };
          }
        }
        continue;
      }

      yield { type: "done", data: { content: parsed.content, toolCalls } };

      await this.sessionMemory.addMessages(sessionId, [
        ...messages,
        { role: "assistant", content: parsed.content },
      ]);

      return;
    }

    yield { type: "error", data: { message: "Max iterations reached" } };
  }

  async getSession(sessionId) {
    const history = await this.sessionMemory.getHistory(sessionId);
    const metadata = await this.sessionMemory.getMetadata(sessionId);
    return { sessionId, history, metadata };
  }

  async clearSession(sessionId) {
    await this.sessionMemory.clear(sessionId);
    logger.info({ operation: "clear_session" }, "Session cleared", {
      sessionId,
    });
  }

  async extractMemories(messages) {
    const memories = [];

    for (const msg of messages) {
      if (msg.role === "user" && msg.content) {
        const content = msg.content;

        const preferencePatterns = [
          /I (?:prefer|like|love|enjoy|want)\s+(.+?)(?:\.|$)/gi,
          /my (?:favorite|preferred)\s+(?:is|are)\s+(.+?)(?:\.|$)/gi,
        ];

        for (const pattern of preferencePatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            memories.push({
              type: "preference",
              content: match[0].trim(),
              extractedAt: new Date().toISOString(),
            });
          }
        }

        const factPatterns = [
          /I (?:am|work|live|have)\s+(.+?)(?:\.|$)/gi,
          /my (?:name|job|work|company)\s+(?:is|are)\s+(.+?)(?:\.|$)/gi,
        ];

        for (const pattern of factPatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            memories.push({
              type: "fact",
              content: match[0].trim(),
              extractedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    return memories;
  }

  async searchMemories(query, options = {}) {
    const { userId, limit = 10, sessionId } = options;

    try {
      const results = await this.vectorMemory.search(query, {
        sessionId: sessionId || userId,
        limit,
        minScore: 0.5,
      });

      return results.map((r) => ({
        content: r.content,
        score: r.score,
        metadata: r.metadata,
      }));
    } catch (error) {
      logger.warn(
        { operation: "search_memories" },
        "Failed to search memories",
        { error: error.message },
      );
      return [];
    }
  }

  async health() {
    const llmHealth = await this._aiService.health();
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

let _coordinator = null;

export function getAgentCoordinator() {
  if (!_coordinator) {
    _coordinator = new AgentCoordinator();
  }
  return _coordinator;
}

export function createAgentCoordinator(options) {
  return new AgentCoordinator(options);
}

export default AgentCoordinator;
