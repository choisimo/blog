const MAX_LENGTH = 1_048_576;
const MAX_DEPTH = 64;
const MAX_NODES = 4096;
const MAX_DECODINGS = 4;
const FAILED = Symbol('invalid JSON');
const STRONG_FIELD_NAMES = 'items|cards|facets|questions|quiz|mood|bullets|summary|keyPoints|personaId|angleKey|trackKey|suggestions|recommendations';
const FIELD_NAMES = `${STRONG_FIELD_NAMES}|title|data|result|output|payload|_raw|text`;
const KNOWN_FIELD = new RegExp(`^"(?:${FIELD_NAMES})"\\s*(?::|$)`);
const STRONG_FIELD = new RegExp(`^"(?:${STRONG_FIELD_NAMES})"\\s*(?::|$)`);

function hasResponseKey(text, pattern) {
  // Read actual quoted tokens so schema words inside answer strings do not match.
  let start = -1;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (start < 0) {
      if (char === '"') start = index;
    } else if (escaped) escaped = false;
    else if (char === '\\') escaped = true;
    else if (char === '"') {
      let next = index + 1;
      while (next < text.length && /\s/.test(text[next])) next += 1;
      let previous = start - 1;
      while (previous >= 0 && /\s/.test(text[previous])) previous -= 1;
      if ((text[previous] === '{' || text[previous] === ',') &&
          (text[next] === ':' || next === text.length) &&
          pattern.test(text.slice(start, index + 1))) return true;
      start = -1;
    }
  }
  return false;
}

// Scan one whole container. A broken outer container must never expose an
// otherwise complete nested item as a replacement response.
function containerEnd(text, start) {
  const stack = [];
  let quoted = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{' || char === '[') {
      stack.push(char === '{' ? '}' : ']');
      if (stack.length > MAX_DEPTH) return -1;
    } else if (char === '}' || char === ']') {
      if (stack.pop() !== char) return -1;
      if (stack.length === 0) return index + 1;
    }
  }
  return -1;
}

function repair(text) {
  const parts = [];
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (!escaped && char.charCodeAt(0) < 32) {
        parts.push(`\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
        continue;
      }
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      let next = index + 1;
      while (/[\t\n\r ]/.test(text[next] ?? '') && next < text.length) next += 1;
      if (text[next] === '}' || text[next] === ']') continue;
    }
    parts.push(char);
  }
  return parts.join('');
}

function decode(text) {
  if (text[0] === '{' || text[0] === '[') {
    if (containerEnd(text, 0) !== text.length) return FAILED;
  }
  try { return JSON.parse(text); }
  catch {
    try { return JSON.parse(repair(text)); }
    catch { return FAILED; }
  }
}

function unfence(text) {
  const opening = /^```(?:json)?(?=\s|[{\[])\s*/i.exec(text);
  if (!opening) return null;
  return text.slice(opening[0].length).replace(/\r?\n?```\s*$/, '').trim();
}

function parseText(text) {
  if (!text || text.length > MAX_LENGTH) return FAILED;
  if (text.startsWith('```')) {
    const body = unfence(text);
    return body === null ? FAILED : decode(body);
  }
  const direct = decode(text);
  if (direct !== FAILED) return direct;
  // A JSON-looking root is authoritative, including a truncated quoted root.
  if (/^[{["\d-]/.test(text)) return FAILED;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '{' && text[index] !== '[') continue;
    const end = containerEnd(text, index);
    if (end < 0) return FAILED;
    const candidate = text.slice(index, end);
    // Numeric intervals in prose are not response containers.
    if (text[index] === '{' || /^\[\s*(?:\{|"|\])/.test(candidate)) {
      return decode(candidate);
    }
    index = end - 1;
  }
  return FAILED;
}

/** Parse JSON without unwrapping application envelopes. See the declaration for limits. */
export function parseStructuredResponse(value) {
  if (value !== null && typeof value === 'object') return value;
  if (typeof value !== 'string' || value.length > MAX_LENGTH) return null;
  let current = value.trim();
  for (let round = 0; round < MAX_DECODINGS; round += 1) {
    const parsed = parseText(current);
    if (parsed === FAILED) return null;
    if (typeof parsed !== 'string') return parsed;
    // Preserve decoded ordinary strings exactly, including their whitespace.
    const inner = parsed.trim();
    if (!/^[{["`]/.test(inner)) return parsed;
    if (round === MAX_DECODINGS - 1) return null;
    current = inner;
  }
  return null;
}

/** Detect likely serialized responses, not every piece of syntactically valid JSON. */
export function isStructuredResponseText(value) {
  if (typeof value !== 'string') return false;
  let text = value.slice(0, MAX_LENGTH).trim();
  for (let round = 0; round < MAX_DECODINGS; round += 1) {
    if (text.startsWith('```')) {
      const body = unfence(text);
      if (body === null) return false;
      text = body;
    }
    // Complete empty containers are legitimate quiz/code literals.
    if (/^(?:\{\s*\}|\[\s*\])$/.test(text)) return false;
    // Split/cached responses can leave just the opening brace in a title.
    // Require a bracket so commas and whitespace alone remain ordinary text.
    if (/^[\s{}\[\],]+$/.test(text) && /[{}\[\]]/.test(text)) return true;
    if (/^\{\s*"/.test(text) || /^\[\s*\{/.test(text)) {
      if (hasResponseKey(text, STRONG_FIELD)) return true;
      if (hasResponseKey(text, KNOWN_FIELD)) {
        // Generic keys are ordinary JSON examples unless the wire text is broken.
        // Validate strictly here: repaired malformed wrappers must still be caught.
        if (containerEnd(text, 0) !== text.length) return true;
        try { JSON.parse(text); }
        catch { return true; }
      }
      return false;
    }
    if (/^\[\s*"/.test(text)) {
      if (containerEnd(text, 0) !== text.length) return true;
      try {
        const literal = JSON.parse(text);
        if (literal.every(item => typeof item === 'string')) return false;
      } catch {
        // Incomplete or malformed string arrays still expose response fragments.
      }
      return true;
    }
    if (KNOWN_FIELD.test(text)) return true;
    if (text[0] !== '"') {
      // Explanatory introductions are common even when the JSON is cut off.
      // Only inspect the first container; do not jump into a broken outer one.
      const start = text.search(/[\[{]/);
      if (start <= 0) return false;
      const prefix = text.slice(0, start);
      if (!/^(?:here (?:is|are)(?: the| your)? )?(?:json(?: response)?|response|result|output)\s*:?\s*$/i.test(prefix.trim())) return false;
      text = text.slice(start);
      continue;
    }
    const decoded = decode(text);
    if (typeof decoded !== 'string') return false;
    text = decoded.trim();
  }
  return false;
}

/** Inspect own data-property string leaves; never invoke getters. */
export function hasStructuredResponseText(value) {
  const seen = new WeakSet();
  const pending = [{ value, depth: 0 }];
  let visited = 0;
  let characters = 0;
  let scheduled = 1;
  while (pending.length && visited < MAX_NODES) {
    const entry = pending.pop();
    visited += 1;
    if (typeof entry.value === 'string') {
      const remaining = MAX_LENGTH - characters;
      if (remaining <= 0) continue;
      const text = entry.value.slice(0, remaining);
      characters += text.length;
      if (isStructuredResponseText(text)) return true;
    } else if (entry.value !== null && typeof entry.value === 'object' &&
               entry.depth < MAX_DEPTH && !seen.has(entry.value)) {
      seen.add(entry.value);
      try {
        for (const key in entry.value) {
          if (scheduled >= MAX_NODES) break;
          scheduled += 1;
          const descriptor = Object.getOwnPropertyDescriptor(entry.value, key);
          if (descriptor && Object.hasOwn(descriptor, 'value')) {
            pending.push({ value: descriptor.value, depth: entry.depth + 1 });
          }
        }
      } catch {
        // Revoked proxies and inaccessible properties are not string leaves.
      }
    }
  }
  return false;
}
