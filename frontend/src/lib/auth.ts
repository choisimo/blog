const MAX_BEARER_TOKEN_LENGTH = 4096;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;
const WHITESPACE_PATTERN = /\s/;

export function bearerAuth(token: string): { Authorization: string } {
  const bearerToken = token.trim();
  if (
    !bearerToken ||
    bearerToken.length > MAX_BEARER_TOKEN_LENGTH ||
    WHITESPACE_PATTERN.test(bearerToken) ||
    CONTROL_CHAR_PATTERN.test(bearerToken)
  ) {
    throw new Error("Invalid bearer token");
  }

  return { Authorization: `Bearer ${bearerToken}` };
}
