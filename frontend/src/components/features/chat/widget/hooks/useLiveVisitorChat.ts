import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  connectLiveChatStream,
  sendLiveChatMessage,
  type LiveChatEvent,
} from '@/services/chat';
import type { ChatMessage, SystemMessageLevel } from '../types';

const VISITOR_NAME_KEY = 'aiChat.liveVisitorName';

function toRoomKey(pathname: string): string {
  const normalized = (pathname || '/').replace(/\/+$/, '') || '/';
  const parts = normalized.split('/').filter(Boolean);

  if (parts.length === 0) return 'room:lobby';

  if ((parts[0] === 'blog' || parts[0] === 'post') && parts.length >= 3) {
    const year = parts[1];
    const slug = parts.slice(2).join('-');
    return `room:blog:${year}:${slug}`;
  }

  if (parts[0] === 'projects') {
    const project = parts[1] || 'lobby';
    return `room:project:${project}`;
  }

  return `room:page:${parts.join(':')}`;
}

function getVisitorName(): string {
  try {
    const existing = sessionStorage.getItem(VISITOR_NAME_KEY);
    if (existing && existing.trim()) return existing;
    const generated = `visitor-${Math.random().toString(36).slice(2, 6)}`;
    sessionStorage.setItem(VISITOR_NAME_KEY, generated);
    return generated;
  } catch {
    return `visitor-${Math.random().toString(36).slice(2, 6)}`;
  }
}

function buildSystemMessage(
  text: string,
  level: SystemMessageLevel = 'info'
): ChatMessage {
  return {
    id: `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role: 'system',
    text,
    systemLevel: level,
  };
}

function normalizeSystemLevel(level?: 'info' | 'warn' | 'error'): SystemMessageLevel {
  if (level === 'error' || level === 'warn') return level;
  return 'info';
}

function formatSessionMessage(message: string): string {
  const raw = String(message || '').trim();
  const normalized = raw.toLowerCase();

  if (normalized === 'ai response completed') {
    return 'AI 응답이 완료되었습니다.';
  }

  if (normalized === 'your live message was delivered') {
    return '라이브 메시지가 전달되었습니다. 참여자가 없으면 답변이 바로 오지 않을 수 있습니다.';
  }

  if (normalized.endsWith('replied in the room')) {
    const suffix = 'replied in the room';
    const name = raw.slice(0, -suffix.length).trim();
    return `${name || 'assistant'}가 방에서 응답했습니다.`;
  }

  if (normalized === 'auto room reply skipped due to temporary ai error') {
    return '자동 응답이 일시 오류로 생략되었습니다.';
  }

  return raw;
}

export function useLiveVisitorChat(input: {
  sessionId: string;
  push: (msg: ChatMessage) => void;
}) {
  const { sessionId, push } = input;
  const connectedRef = useRef(false);
  const visitorName = useMemo(() => getVisitorName(), []);
  const room = useMemo(() => {
    if (typeof window === 'undefined') return 'room:lobby';
    return toRoomKey(window.location.pathname);
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const disconnect = connectLiveChatStream({
      sessionId,
      room,
      name: visitorName,
      onEvent: (event: LiveChatEvent) => {
        if (event.type === 'ping') return;

        if (event.type === 'connected') {
          if (!connectedRef.current) {
            connectedRef.current = true;
            push(
              buildSystemMessage(
                `[Live] Connected to visitor chat (${event.onlineCount} online). Use /live <message> to chat in real time.`
              )
            );
          }
          return;
        }

        if (event.type === 'presence') {
          if (event.sessionId === sessionId) return;
          const actionText = event.action === 'join' ? 'joined' : 'left';
          push(
            buildSystemMessage(
              `[Live] ${event.name} ${actionText}. Online: ${event.onlineCount}`
            )
          );
          return;
        }

        if (event.type === 'live_message') {
          if (event.sessionId === sessionId) return;
          const sender = event.senderType === 'agent'
            ? `${event.name} (auto assistant)`
            : event.name;
          push(
            buildSystemMessage(
              `[Live] ${sender}: ${event.text}`
            )
          );
          return;
        }

        if (event.type === 'session_notification' && event.sessionId === sessionId) {
          push(
            buildSystemMessage(
              `[Session] ${formatSessionMessage(event.message)}`,
              normalizeSystemLevel(event.level)
            )
          );
        }
      },
      onError: () => {
        push(
          buildSystemMessage(
            '[Live] Connection unstable. Reconnecting...',
            'warn'
          )
        );
      },
    });

    return () => {
      connectedRef.current = false;
      disconnect();
    };
  }, [sessionId, push, visitorName, room]);

  const sendVisitorMessage = useCallback(
    async (text: string) => {
      await sendLiveChatMessage({
        sessionId,
        text,
        room,
        name: visitorName,
        senderType: 'client',
      });
    },
    [sessionId, visitorName, room]
  );

  return { sendVisitorMessage };
}
