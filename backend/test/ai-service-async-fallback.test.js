import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.AI_DEFAULT_MODEL ||= 'gpt-5-mini';

const { AIService } = await import('../src/services/ai/ai.service.js');

class QueueUnavailableAIService extends AIService {
  constructor() {
    super();
    this.enqueuedTasks = [];
    this.waitCalls = 0;
    this.syncCalls = [];
  }

  async _enqueueAITask(task) {
    this.enqueuedTasks.push(task);
    return null;
  }

  async _waitForAIResult() {
    this.waitCalls += 1;
    throw new Error('wait should not be called without a task id');
  }

  async _generateSync(prompt, options) {
    this.syncCalls.push({ type: 'generate', prompt, options });
    return `sync:${prompt}`;
  }

  async _chatSync(messages, options) {
    this.syncCalls.push({ type: 'chat', messages, options });
    return {
      content: 'sync chat',
      model: options.model || 'test-model',
      provider: 'sync-test',
    };
  }
}

class QueueThrowingAIService extends QueueUnavailableAIService {
  async _enqueueAITask(task) {
    this.enqueuedTasks.push(task);
    throw new Error('redis unavailable');
  }
}

describe('AIService async queue fallback', () => {
  it('falls back to sync generation when enqueue returns no task id', async () => {
    const service = new QueueUnavailableAIService();

    const result = await service._generateAsync(
      'hello',
      { temperature: 0.2 },
      'generate-test',
      Date.now(),
    );

    assert.equal(result, 'sync:hello');
    assert.equal(service.enqueuedTasks.length, 1);
    assert.equal(service.enqueuedTasks[0].type, 'generate');
    assert.equal(service.waitCalls, 0);
    assert.equal(service.syncCalls.length, 1);
  });

  it('falls back to sync chat when enqueue returns no task id', async () => {
    const service = new QueueUnavailableAIService();
    const messages = [{ role: 'user', content: 'hello' }];

    const result = await service._chatAsync(
      messages,
      { model: 'gpt-5-mini' },
      'chat-test',
      Date.now(),
    );

    assert.equal(result.content, 'sync chat');
    assert.equal(result.model, 'gpt-5-mini');
    assert.equal(service.enqueuedTasks.length, 1);
    assert.equal(service.enqueuedTasks[0].type, 'chat');
    assert.equal(service.waitCalls, 0);
    assert.equal(service.syncCalls.length, 1);
  });

  it('falls back to sync chat when enqueue throws before creating a task', async () => {
    const service = new QueueThrowingAIService();
    const messages = [{ role: 'user', content: 'hello' }];

    const result = await service._chatAsync(
      messages,
      { model: 'gpt-5-mini' },
      'chat-throw-test',
      Date.now(),
    );

    assert.equal(result.content, 'sync chat');
    assert.equal(service.waitCalls, 0);
    assert.equal(service.syncCalls.length, 1);
  });
});
