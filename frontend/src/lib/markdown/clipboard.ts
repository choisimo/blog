/** Report success only after the browser accepted the exact text. */
export async function writeTextToClipboard(text: string): Promise<boolean> {
  if (typeof text !== 'string') return false;

  const clipboard =
    typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (typeof clipboard?.writeText === 'function') {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // Continue to the compatibility fallback where it is available.
    }
  }

  if (typeof document === 'undefined') return false;
  const body = document.body;
  if (!body || typeof document.execCommand !== 'function') return false;

  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.setAttribute('aria-hidden', 'true');
  field.style.position = 'fixed';
  field.style.inset = '-9999px auto auto -9999px';
  body.appendChild(field);
  field.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
