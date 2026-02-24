import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  connectLiveChatStream,
  sendLiveChatMessage,
} from '@/services/chat';
import type { LiveChatEvent } from '@/services/chat/live';
import type { ChatMessage, SystemMessageLevel } from '../types';

const VISITOR_NAME_KEY = 'aiChat.liveVisitorName';

function normalizeRoomKey(rawRoom: string): string {
  const fallback = 'room:lobby';
  const trimmed = String(rawRoom || '').trim().toLowerCase();
  if (!trimmed) return fallback;

  const normalized = trimmed
    .replace(/[^a-z0-9:_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);

  if (!normalized) return fallback;
  return normalized.startsWith('room:') ? normalized : `room:${normalized}`;
}

function toRoomKey(pathname: string): string {
  const normalized = (pathname || '/').replace(/\/+$/, '') || '/';
  const parts = normalized.split('/').filter(Boolean);

  if (parts.length === 0) return 'room:lobby';

  if ((parts[0] === 'blog' || parts[0] === 'post') && parts.length >= 3) {
    const year = parts[1];
    const slug = parts.slice(2).join('-');
    return normalizeRoomKey(`room:blog:${year}:${slug}`);
  }

  if (parts[0] === 'projects') {
    const project = parts[1] || 'lobby';
    return normalizeRoomKey(`room:project:${project}`);
  }

  return normalizeRoomKey(`room:page:${parts.join(':')}`);
}

function formatRoomName(room: string): string {
  return String(room || 'room:lobby')
    .replace(/^room:/, '')
    .replace(/:/g, '/');
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
  level: SystemMessageLevel = 'info',
  opts?: { systemKind?: 'status' | 'error'; transient?: boolean; expiresAt?: number }
): ChatMessage {
  return {
    id: `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role: 'system',
    text,
    systemLevel: level,
    systemKind: opts?.systemKind,
    transient: opts?.transient,
    expiresAt: opts?.expiresAt,
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
  const disconnectRef = useRef<(() => void) | null>(null);
  const visitorName = useMemo(() => getVisitorName(), []);
  const [room, setRoom] = useState<string>(() => {
    if (typeof window === 'undefined') return 'room:lobby';
    return toRoomKey(window.location.pathname);
  });
  const [reconnectNonce, setReconnectNonce] = useState(0);

  const switchRoom = useCallback((nextRoom: string) => {
    const normalized = normalizeRoomKey(nextRoom);
    connectedRef.current = false;
    try {
      disconnectRef.current?.();
    } catch {
      // ignore disconnect errors
    } finally {
      disconnectRef.current = null;
    }
    setRoom(normalized);
    setReconnectNonce((prev) => prev + 1);
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
                `[Live] ${formatRoomName(event.room || room)} 방 연결됨 (${event.onlineCount} online). Use /live <message> to chat in real time.`,
                'info',
                { systemKind: 'status' }
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
              `[Live] ${event.name} ${actionText}. Online: ${event.onlineCount}`,
              'info',
              { systemKind: 'status', transient: true, expiresAt: Date.now() + 4000 }
            )
          );
          return;
        }

        if (event.type === 'live_message') {
          const sender = event.name || 'anonymous';
          const isSelfEcho =
            event.sessionId === sessionId && sender.trim().toLowerCase() === visitorName.trim().toLowerCase();
          if (isSelfEcho) return;

          const isLiveAgent =
            event.senderType === 'agent' || sender.toLowerCase() === 'room-companion';

          if (isLiveAgent) {
            push({
              id: `live_agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              role: 'assistant',
              text: `[Live · ${sender}] ${event.text}`,
            });
            return;
          }

          push(
            buildSystemMessage(
              `[Live] ${sender}: ${event.text}`,
              'info',
              { systemKind: 'status' }
            )
          );
          return;
        }

        if (event.type === 'session_notification' && event.sessionId === sessionId) {
          const lvl = normalizeSystemLevel(event.level);
          push(
            buildSystemMessage(
              `[Session] ${formatSessionMessage(event.message)}`,
              lvl,
              {
                systemKind: lvl === 'error' ? 'error' : 'status',
                transient: lvl !== 'error',
                expiresAt: lvl !== 'error' ? Date.now() + 4000 : undefined,
              }
            )
          );
        }
      },
      onError: () => {
        push(
          buildSystemMessage(
            '[Live] Connection unstable. Reconnecting...',
            'warn',
            { systemKind: 'error' }
          )
        );
      },
    });
    disconnectRef.current = disconnect;

    return () => {
      connectedRef.current = false;
      disconnect();
      if (disconnectRef.current === disconnect) {
        disconnectRef.current = null;
      }
    };
  }, [sessionId, push, visitorName, room, reconnectNonce]);

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

  return { sendVisitorMessage, room, switchRoom };
}
