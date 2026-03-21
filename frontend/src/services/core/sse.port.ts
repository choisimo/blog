export type SSEConnectInput = {
  url: string;
  headers?: Record<string, string>;
  onFrame: (frame: { event: string | null; data: string }) => void;
  onError?: (error: unknown) => void;
  signal?: AbortSignal;
};

export type DisconnectFn = () => void;

export interface SSEPort {
  connect(input: SSEConnectInput): DisconnectFn;
}
