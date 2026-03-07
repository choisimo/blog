export interface AuthTokenProvider {
  getAccessToken(): Promise<string | null>;
}
