import { useCallback, useEffect, useRef, useState } from 'react';
import { useFeatureFlagsStore } from '@/stores/runtime/useFeatureFlagsStore';
import {
  streamCardExploration,
  type ExplorationSeed,
  type ExplorationTurn,
} from '@/services/discovery/cardExploration';

export type CardExplorationState = {
  turns: ExplorationTurn[];
  draft?: ExplorationTurn;
  status: 'connecting' | 'streaming' | 'complete' | 'stopped' | 'error';
  error?: string;
};

type Options = {
  scopeKey: string;
  paragraph: string;
  postTitle?: string;
  enabled: boolean;
  purpose?: 'exploration' | 'evidence';
};
const REQUEST_TIMEOUT_MS = 120000;
const MAX_HISTORY = 8;

export function useCardExploration({
  scopeKey,
  paragraph,
  postTitle,
  enabled,
  purpose,
}: Options) {
  const [states, setStates] = useState<Record<string, CardExplorationState>>(
    {}
  );
  const statesRef = useRef(states);
  const controllers = useRef(new Map<string, AbortController>());
  const scopeRef = useRef(scopeKey);
  const enableRag = useFeatureFlagsStore(state => state.flags.ragEnabled);
  const aiEnabled = useFeatureFlagsStore(state => state.flags.aiEnabled);

  const update = useCallback(
    (id: string, value: CardExplorationState | undefined) => {
      const next = { ...statesRef.current };
      if (value) next[id] = value;
      else delete next[id];
      statesRef.current = next;
      setStates(next);
    },
    []
  );

  const stop = useCallback(
    (id: string) => {
      const controller = controllers.current.get(id);
      if (!controller) return;
      controllers.current.delete(id);
      controller.abort();
      const state = statesRef.current[id];
      if (state) update(id, { ...state, status: 'stopped', error: undefined });
    },
    [update]
  );

  useEffect(() => {
    if (scopeRef.current !== scopeKey) {
      controllers.current.forEach(controller => controller.abort());
      controllers.current.clear();
      scopeRef.current = scopeKey;
      statesRef.current = {};
      setStates({});
    }
  }, [scopeKey]);

  useEffect(() => {
    if (!enabled || !aiEnabled) [...controllers.current.keys()].forEach(stop);
  }, [enabled, aiEnabled, stop]);

  useEffect(() => {
    const active = controllers.current;
    return () => {
      active.forEach(controller => controller.abort());
      active.clear();
    };
  }, []);

  const explore = useCallback(
    async (
      seed: ExplorationSeed,
      input: string,
      options?: { reuse?: boolean }
    ) => {
      if (
        options?.reuse &&
        (controllers.current.has(seed.id) ||
          statesRef.current[seed.id]?.status === 'complete')
      )
        return;
      const question = input
        .replace(/[\u0000-\u001F\u007F]+/g, ' ')
        .trim()
        .slice(0, 500);
      if (!enabled || !aiEnabled || !question) return;
      stop(seed.id);
      const controller = new AbortController();
      controllers.current.set(seed.id, controller);
      const turns = statesRef.current[seed.id]?.turns ?? [];
      let draft: ExplorationTurn = { question, body: '', questions: [] };
      let renderTimer: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;
      const isCurrent = () =>
        controllers.current.get(seed.id) === controller &&
        scopeRef.current === scopeKey;
      const publish = () => {
        renderTimer = undefined;
        if (isCurrent())
          update(seed.id, {
            turns,
            draft,
            status: draft.body ? 'streaming' : 'connecting',
          });
      };
      const timeout = setTimeout(() => {
        if (!isCurrent()) return;
        timedOut = true;
        controller.abort();
        controllers.current.delete(seed.id);
        update(seed.id, {
          turns,
          draft,
          status: 'error',
          error: '응답 시간이 길어 연결을 중단했습니다. 다시 시도해 주세요.',
        });
      }, REQUEST_TIMEOUT_MS);
      publish();
      try {
        for await (const snapshot of streamCardExploration({
          seed,
          paragraph,
          postTitle,
          question,
          history: turns,
          enableRag,
          signal: controller.signal,
          purpose,
        })) {
          if (!isCurrent() || controller.signal.aborted) return;
          draft = { question, ...snapshot };
          // Batch tokens into at most 20 renders/second, while the card stays mounted.
          if (!renderTimer) renderTimer = setTimeout(publish, 50);
        }
        if (!isCurrent() || controller.signal.aborted) return;
        if (!draft.body.trim())
          throw new Error('AI 응답이 비어 있습니다. 다시 시도해 주세요.');
        update(seed.id, {
          turns: [...turns, draft].slice(-MAX_HISTORY),
          status: 'complete',
        });
      } catch {
        if (!isCurrent() || timedOut || controller.signal.aborted) return;
        update(seed.id, {
          turns,
          draft,
          status: 'error',
          error: 'AI 연결을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        });
      } finally {
        clearTimeout(timeout);
        clearTimeout(renderTimer);
        if (controllers.current.get(seed.id) === controller)
          controllers.current.delete(seed.id);
        controller.abort();
      }
    },
    [
      aiEnabled,
      enableRag,
      enabled,
      paragraph,
      postTitle,
      purpose,
      scopeKey,
      stop,
      update,
    ]
  );

  const back = useCallback(
    (id: string) => {
      stop(id);
      const state = statesRef.current[id];
      if (!state) return;
      const turns = state.draft ? state.turns : state.turns.slice(0, -1);
      update(id, turns.length ? { turns, status: 'complete' } : undefined);
    },
    [stop, update]
  );

  const reset = useCallback(
    (id: string) => {
      stop(id);
      update(id, undefined);
    },
    [stop, update]
  );
  return {
    states: scopeRef.current === scopeKey ? states : {},
    explore,
    stop,
    back,
    reset,
    available: enabled && aiEnabled,
  };
}
