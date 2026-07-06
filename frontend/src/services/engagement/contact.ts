import { getApiBaseUrl } from '@/utils/network/apiBase';

export interface ContactFormPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactSendResult {
  provider: 'emailjs' | 'api';
}

const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';
const MAX_CONTACT_NAME_LENGTH = 120;
const MAX_CONTACT_EMAIL_LENGTH = 254;
const MAX_CONTACT_SUBJECT_LENGTH = 200;
const MAX_CONTACT_MESSAGE_LENGTH = 5000;
const MAX_CONTACT_ERROR_MESSAGE_LENGTH = 1000;
const CONTACT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
const CONTACT_SINGLE_LINE_CONTROL_REPLACE_PATTERN = /[\u0000-\u001F\u007F]/g;
const CONTACT_MULTILINE_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const CONTACT_WHITESPACE_PATTERN = /\s+/g;

function getEmailJsConfig() {
  return {
    serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID,
    templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
    publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
  };
}

function canUseEmailJs(): boolean {
  const cfg = getEmailJsConfig();
  return Boolean(cfg.serviceId && cfg.templateId && cfg.publicKey);
}

function normalizeSingleLineField(value: string, label: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || CONTACT_SINGLE_LINE_CONTROL_PATTERN.test(normalized)) {
    throw new Error(`Invalid contact ${label}.`);
  }

  return normalized;
}

function normalizeEmail(value: string): string {
  const normalized = normalizeSingleLineField(value, 'email', MAX_CONTACT_EMAIL_LENGTH);
  if (!CONTACT_EMAIL_PATTERN.test(normalized)) {
    throw new Error('Invalid contact email.');
  }

  return normalized;
}

function normalizeMessage(value: string): string {
  const normalized = value
    .replace(/\r\n?/g, '\n')
    .replace(CONTACT_MULTILINE_CONTROL_PATTERN, ' ')
    .trim();
  if (!normalized || normalized.length > MAX_CONTACT_MESSAGE_LENGTH) {
    throw new Error('Invalid contact message.');
  }

  return normalized;
}

function normalizeContactPayload(payload: ContactFormPayload): ContactFormPayload {
  return {
    name: normalizeSingleLineField(payload.name, 'name', MAX_CONTACT_NAME_LENGTH),
    email: normalizeEmail(payload.email),
    subject: normalizeSingleLineField(payload.subject, 'subject', MAX_CONTACT_SUBJECT_LENGTH),
    message: normalizeMessage(payload.message),
  };
}

function normalizeContactErrorMessage(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;

  const normalized = value
    .replace(CONTACT_SINGLE_LINE_CONTROL_REPLACE_PATTERN, ' ')
    .replace(CONTACT_WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized && normalized.length <= MAX_CONTACT_ERROR_MESSAGE_LENGTH
    ? normalized
    : fallback;
}

async function sendViaEmailJs(payload: ContactFormPayload): Promise<ContactSendResult> {
  const { serviceId, templateId, publicKey } = getEmailJsConfig();
  if (!serviceId || !templateId || !publicKey) {
    throw new Error('EmailJS configuration is missing.');
  }

  const response = await fetch(EMAILJS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: {
        from_name: payload.name,
        from_email: payload.email,
        subject: payload.subject,
        message: payload.message,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || 'EmailJS request failed.');
  }

  return { provider: 'emailjs' };
}

async function sendViaApi(payload: ContactFormPayload): Promise<ContactSendResult> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = 'Failed to send message.';
    const text = await response.text().catch(() => '');
    if (text) {
      try {
        const body = JSON.parse(text);
        message = normalizeContactErrorMessage(
          body?.error?.message || body?.message || text,
          message
        );
      } catch {
        message = normalizeContactErrorMessage(text, message);
      }
    }
    throw new Error(message);
  }

  return { provider: 'api' };
}

export async function sendContactMessage(
  payload: ContactFormPayload
): Promise<ContactSendResult> {
  const normalizedPayload = normalizeContactPayload(payload);

  if (canUseEmailJs()) {
    try {
      return await sendViaEmailJs(normalizedPayload);
    } catch {
      // Fallback to API route if configured.
    }
  }

  return sendViaApi(normalizedPayload);
}
