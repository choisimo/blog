import type { ApiRequest, ApiResponse, HttpPort } from "./http.port";

export function createFetchHttpAdapter(): HttpPort {
  return {
    async request<T = unknown>(input: ApiRequest): Promise<ApiResponse<T>> {
      const response = await fetch(input.url, {
        method: input.method || "GET",
        headers: input.headers,
        body: input.body,
        signal: input.signal,
      });

      const data = (await response.json().catch(() => null)) as T;
      return {
        status: response.status,
        ok: response.ok,
        data,
      };
    },
  };
}
