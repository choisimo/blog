import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadSessionsIndex,
  SESSIONS_INDEX_KEY,
  type ChatSessionMeta,
} from '@/services/chat/session';

const validSession: ChatSessionMeta = {
  id: 'session-1',
  title: 'Valid Session',
  summary: 'Summary',
  createdAt: '2026-07-03T00:00:00.000Z',
  updatedAt: '2026-07-03T00:00:00.000Z',
  messageCount: 2,
  mode: 'article',
};

describe('chat session index storage boundary', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('rewrites malformed index entries with the normalized sessions that remain', () => {
    window.localStorage.setItem(
      SESSIONS_INDEX_KEY,
      JSON.stringify([
        validSession,
        { id: 'bad session id', title: 'Bad Session' },
        null,
      ])
    );

    expect(loadSessionsIndex()).toEqual([validSession]);
    expect(JSON.parse(window.localStorage.getItem(SESSIONS_INDEX_KEY) || '')).toEqual([
      validSession,
    ]);
  });

  it('removes a corrupt sessions index payload after parse failure', () => {
    window.localStorage.setItem(SESSIONS_INDEX_KEY, '{not-json');

    expect(loadSessionsIndex()).toEqual([]);
    expect(window.localStorage.getItem(SESSIONS_INDEX_KEY)).toBeNull();
  });
});
