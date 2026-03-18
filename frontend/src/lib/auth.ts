export function bearerAuth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
