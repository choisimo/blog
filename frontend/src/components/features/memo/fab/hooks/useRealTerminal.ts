/**
 * useRealTerminal - Real Linux terminal connection hook
 *
 * Manages WebSocket connection to the terminal gateway for real shell access.
 * Uses the terminal.ts service for connection handling.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectTerminal,
  checkTerminalHealth,
  hasAuthToken,
  type TerminalConnection,
  type TerminalOptions,
} from "@/services/terminal";

export type TerminalStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export type UseRealTerminalOptions = {
  cols?: number;
  rows?: number;
  onData?: (data: string) => void;
  onStatusChange?: (status: TerminalStatus) => void;
  autoConnect?: boolean;
};

export type UseRealTerminalReturn = {
  status: TerminalStatus;
  error: string | null;
  isAvailable: boolean;
  connect: () => void;
  disconnect: () => void;
  send: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  checkHealth: () => Promise<boolean>;
};

export function useRealTerminal(
  options: UseRealTerminalOptions = {}
): UseRealTerminalReturn {
  const {
    cols = 80,
    rows = 24,
    onData,
    onStatusChange,
    autoConnect = false,
  } = options;

  const [status, setStatus] = useState<TerminalStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const connectionRef = useRef<TerminalConnection | null>(null);
  const onDataRef = useRef(onData);
  const onStatusChangeRef = useRef(onStatusChange);

  // Keep refs up to date
  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  // Notify status changes
  useEffect(() => {
    onStatusChangeRef.current?.(status);
  }, [status]);

  // Check if terminal service is available on mount
  useEffect(() => {
    const checkAvailability = async () => {
      const authOk = hasAuthToken();
      if (!authOk) {
        setIsAvailable(false);
        return;
      }
      const healthOk = await checkTerminalHealth();
      setIsAvailable(healthOk);
    };
    checkAvailability();
  }, []);

  const connect = useCallback(() => {
    // Don't connect if already connected
    if (connectionRef.current?.isConnected()) {
      return;
    }

    // Check auth token
    if (!hasAuthToken()) {
      setError("로그인이 필요합니다");
      setStatus("error");
      return;
    }

    setStatus("connecting");
    setError(null);

    const terminalOptions: TerminalOptions = {
      cols,
      rows,
      onOpen: () => {
        setStatus("connected");
        setError(null);
      },
      onData: (data) => {
        onDataRef.current?.(data);
      },
      onClose: (code, reason) => {
        setStatus("disconnected");
        connectionRef.current = null;
        if (code !== 1000) {
          setError(`연결 종료: ${reason || `코드 ${code}`}`);
        }
      },
      onError: () => {
        setStatus("error");
        setError("터미널 연결에 실패했습니다");
        connectionRef.current = null;
      },
    };

    const connection = connectTerminal(terminalOptions);

    if (!connection) {
      setStatus("error");
      setError("터미널 연결을 시작할 수 없습니다");
      return;
    }

    connectionRef.current = connection;
  }, [cols, rows]);

  const disconnect = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
    setStatus("disconnected");
    setError(null);
  }, []);

  const send = useCallback((data: string) => {
    if (connectionRef.current?.isConnected()) {
      connectionRef.current.send(data);
    }
  }, []);

  const resize = useCallback((newCols: number, newRows: number) => {
    if (connectionRef.current?.isConnected()) {
      connectionRef.current.resize(newCols, newRows);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    const result = await checkTerminalHealth();
    setIsAvailable(result && hasAuthToken());
    return result;
  }, []);

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect && isAvailable && status === "disconnected") {
      connect();
    }
  }, [autoConnect, isAvailable, status, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.close();
        connectionRef.current = null;
      }
    };
  }, []);

  return {
    status,
    error,
    isAvailable,
    connect,
    disconnect,
    send,
    resize,
    checkHealth,
  };
}
