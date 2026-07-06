import { describe, expect, it } from 'vitest';
import { normalizeChatBaseUrl } from '@/services/chat/config';

describe('normalizeChatBaseUrl', () => {
  it('normalizes safe absolute and site-relative chat base URLs', () => {
    expect(normalizeChatBaseUrl(' https://chat.example.com/api/ ')).toBe(
      'https://chat.example.com/api'
    );
    expect(normalizeChatBaseUrl('http://localhost:5080/')).toBe(
      'http://localhost:5080'
    );
    expect(normalizeChatBaseUrl('/chat-api/')).toBe('/chat-api');
  });

  it('rejects unsupported, credentialed, query, and hash chat base URLs', () => {
    expect(normalizeChatBaseUrl('ftp://chat.example.com')).toBeNull();
    expect(normalizeChatBaseUrl('https://user:pass@chat.example.com')).toBeNull();
    expect(normalizeChatBaseUrl('https://chat.example.com?debug=true')).toBeNull();
    expect(normalizeChatBaseUrl('https://chat.example.com#stream')).toBeNull();
    expect(normalizeChatBaseUrl('//chat.example.com')).toBeNull();
    expect(normalizeChatBaseUrl('chat.example.com')).toBeNull();
  });
});
