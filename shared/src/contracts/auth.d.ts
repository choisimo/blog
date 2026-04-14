import type { ZodTypeAny } from 'zod';

export type UserSessionFingerprint = {
  visitorId: string;
  advancedVisitorId?: string;
  canvasHash?: string;
  webglHash?: string;
  audioHash?: string;
  screenResolution?: string;
  osVersion?: string;
  fpjsBlocked?: boolean;
  components?: Record<string, unknown>;
};

export type SessionCreateRequest = {
  fingerprint: UserSessionFingerprint;
  userAgent?: string;
};

export type SessionData = {
  sessionToken: string;
  fingerprintId: string;
  expiresAt: string;
  firstSeenAt?: string;
  visitCount?: number;
  isNewUser?: boolean;
};

export type UserPreferenceWrite = {
  key: string;
  value: unknown;
};

export const userSessionFingerprintSchema: ZodTypeAny;
export const sessionCreateRequestSchema: ZodTypeAny;
export const sessionDataSchema: ZodTypeAny;
export const sessionResponseSchema: ZodTypeAny;
export const userPreferenceWriteSchema: ZodTypeAny;
export const userPreferencesResponseSchema: ZodTypeAny;
