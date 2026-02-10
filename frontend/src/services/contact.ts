import { getApiBaseUrl } from '@/utils/apiBase';

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
    try {
      const body = await response.json();
      message = body?.error?.message || body?.message || message;
    } catch {
      const text = await response.text().catch(() => '');
      if (text) message = text;
    }
    throw new Error(message);
  }

  return { provider: 'api' };
}

export async function sendContactMessage(
  payload: ContactFormPayload
): Promise<ContactSendResult> {
  if (canUseEmailJs()) {
    try {
      return await sendViaEmailJs(payload);
    } catch {
      // Fallback to API route if configured.
    }
  }

  return sendViaApi(payload);
}
