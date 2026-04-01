/* eslint-disable no-console */
import express from 'express';
import {
  resolveDeploymentUrl,
  type AiDeploymentStatus
} from '@sap-ai-sdk/ai-api';
import {
  chatCompletion,
  chatCompletionStream as azureChatCompletionStream,
  chatCompletionWithDestination,
  computeEmbedding,
  chatCompletionWithFunctionCall
  // eslint-disable-next-line import/no-internal-modules
} from './foundation-models/azure-openai.js';
...
app.get('/azure-openai/chat-completion-stream', async (req, res) => {
  const controller = new AbortController();
  try {
    const response = await azureChatCompletionStream(controller.signal);

    // Set headers for event stream.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let connectionAlive = true;

    // Abort the stream if the client connection is closed.
    res.on('close', () => {
      controller.abort();
      connectionAlive = false;
      res.end();
    });

    // Stream the delta content.
    for await (const chunk of response.stream.toContentStream()) {
      if (!connectionAlive) {
        break;
      }
      res.write(chunk);
    }

    // Write the finish reason and token usage after the stream ends.
    if (connectionAlive) {
      const finishReason = response.getFinishReason();
      const tokenUsage = response.getTokenUsage()!;
      res.write('\n\n---------------------------\n');
      res.write(`Finish reason: ${finishReason}\n`);
      res.write('Token usage:\n');
      res.write(`  - Completion tokens: ${tokenUsage.completion_tokens}\n`);
      res.write(`  - Prompt tokens: ${tokenUsage.prompt_tokens}\n`);
      res.write(`  - Total tokens: ${tokenUsage.total_tokens}\n`);
    }
  } catch (error: any) {
    sendError(res, error, false);
  } finally {
    res.end();
  }
});
