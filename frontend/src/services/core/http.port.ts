export type ApiRequest = {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: BodyInit | null;
  signal?: AbortSignal;
};

export type ApiResponse<T> = {
  status: number;
  ok: boolean;
  data: T;
};

export interface HttpPort {
  request<T = unknown>(input: ApiRequest): Promise<ApiResponse<T>>;
}
