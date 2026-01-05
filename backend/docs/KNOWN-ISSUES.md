# Known Issues and Recommended Fixes

This document catalogs confirmed bugs in the blog backend codebase with their locations, root causes, and recommended fixes.

---

## Critical Issues

### 1. `customLLMChat` Calls Non-Existent Method

**Severity:** Critical - Function is completely broken

**File:** `src/lib/n8n-client.js`  
**Lines:** 374-380

**Issue:**
The `customLLMChat` method calls `this._call()` which does not exist in the class. The correct method is `this._request()`.

**Current Code:**
```javascript
async customLLMChat(provider, model, messages, systemPrompt, options = {}) {
  // ... setup code ...
  
  const result = await this._call('/webhook/ai-chat-custom', {  // BUG: _call doesn't exist
    method: 'POST',
    body: JSON.stringify(payload),
    timeout: this.LONG_TIMEOUT,
  });
}
```

**Fix:**
```javascript
const result = await this._request('/webhook/ai-chat-custom', {  // Use _request instead
  method: 'POST',
  body: JSON.stringify(payload),
  timeout: this.LONG_TIMEOUT,
});
```

**Impact:** Any code calling `customLLMChat()` will throw `TypeError: this._call is not a function`.

---

### 2. Missing Error Handling in AI Workflows

**Severity:** High - Silent failures in AI operations

**Files:**
- `n8n-workflows/ai-vision.json`
- `n8n-workflows/ai-translate.json`
- `n8n-workflows/ai-task.json`

**Issue:**
Only `ai-chat.json` has an error handling branch. The other workflows lack error outputs, causing failures to be unhandled.

**Current State:**
```
ai-chat.json:     ✓ Has error branch
ai-vision.json:   ✗ No error branch
ai-translate.json: ✗ No error branch
ai-task.json:     ✗ No error branch
```

**Fix:**
Add error output nodes to each workflow that:
1. Catch execution errors from the AI agent node
2. Return a structured error response: `{ ok: false, error: "<message>" }`
3. Log the error for debugging

**Example Error Node Output:**
```json
{
  "ok": false,
  "error": "{{ $json.error.message || 'Unknown error in AI workflow' }}"
}
```

---

### 3. Task Failure Masked by `ok: true` Response

**Severity:** High - Error masking

**File:** `src/lib/n8n-client.js`  
**Line:** ~520 (in `task()` method)

**Issue:**
When the `task()` method encounters an error, it catches the exception and returns a fallback response with `ok: true`, effectively hiding the failure from callers.

**Current Code:**
```javascript
async task(taskDescription, context = {}) {
  try {
    // ... task execution ...
  } catch (error) {
    logger.warn('Task webhook failed, returning fallback', { error: error.message });
    return {
      ok: true,              // BUG: Should be false
      _fallback: true,
      content: '작업을 처리할 수 없습니다.',
      // ...
    };
  }
}
```

**Fix:**
```javascript
catch (error) {
  logger.error('Task webhook failed', { error: error.message });
  return {
    ok: false,               // Properly indicate failure
    _fallback: true,
    error: error.message,
    content: '작업을 처리할 수 없습니다.',
    // ...
  };
}
```

**Impact:** Callers cannot distinguish between successful tasks and failures, leading to incorrect application behavior.

---

## Medium Issues

### 4. Response Field Inconsistency

**Severity:** Medium - Maintenance burden, potential bugs

**File:** `src/lib/n8n-client.js`  
**Lines:** 361, 417, 470 (and throughout)

**Issue:**
Multiple methods use cascading fallback patterns to extract response content because n8n workflows return data in inconsistent field names.

**Current Patterns:**
```javascript
// Pattern seen in multiple places
const content = data.content || data.text || data.response || data.output || '';

// Also seen
const result = response.data?.content || response.data?.text || response.data || '';
```

**Root Cause:**
n8n workflow output nodes are not standardized. Some use `content`, others use `text`, `response`, or `output`.

**Fix (n8n workflows):**
Standardize all workflow output nodes to use a consistent schema:
```json
{
  "ok": true,
  "content": "<the actual response content>",
  "metadata": { }
}
```

**Fix (n8n-client.js):**
After standardizing workflows, simplify extraction:
```javascript
const content = data.content || '';
if (!data.content) {
  logger.warn('Response missing content field', { received: Object.keys(data) });
}
```

---

### 5. Timeout Mismatch in ai-task.json

**Severity:** Medium - Inconsistent behavior

**File:** `n8n-workflows/ai-task.json`

**Issue:**
The ai-task workflow uses a 180-second timeout, while other long-running operations use 300 seconds (the `LONG_TIMEOUT` constant in n8n-client.js).

**Current State:**
```
n8n-client.js LONG_TIMEOUT: 300000ms (300s)
ai-task.json HTTP Request:  180000ms (180s)  ← Mismatch
```

**Fix:**
Update the HTTP Request node timeout in `ai-task.json` to 300000ms (300 seconds) for consistency:
```json
{
  "parameters": {
    "options": {
      "timeout": 300000
    }
  }
}
```

---

## Low Priority Issues

### 6. Inconsistent Error Logging

**Severity:** Low - Debugging difficulty

**Files:** Throughout `src/lib/n8n-client.js`

**Issue:**
Error logging is inconsistent:
- Some errors use `logger.error()`
- Some use `logger.warn()`
- Some include full error objects
- Some only include `error.message`

**Recommendation:**
Standardize error logging:
```javascript
// For recoverable errors (retries, fallbacks)
logger.warn('Operation failed, using fallback', { 
  operation: 'methodName',
  error: error.message,
  stack: error.stack 
});

// For unrecoverable errors
logger.error('Operation failed', { 
  operation: 'methodName',
  error: error.message,
  stack: error.stack,
  context: { /* relevant data */ }
});
```

---

## Summary Table

| # | Issue | Severity | File | Status |
|---|-------|----------|------|--------|
| 1 | `customLLMChat` calls non-existent `_call()` | Critical | n8n-client.js:374-380 | Open |
| 2 | Missing error branches in AI workflows | High | ai-*.json | Open |
| 3 | Task failure returns `ok: true` | High | n8n-client.js:~520 | Open |
| 4 | Response field inconsistency | Medium | n8n-client.js | Open |
| 5 | ai-task.json timeout mismatch | Medium | ai-task.json | Open |
| 6 | Inconsistent error logging | Low | n8n-client.js | Open |

---

## Recommended Fix Order

1. **Fix #1 first** - `customLLMChat` is completely broken
2. **Fix #3 second** - Error masking causes silent failures
3. **Fix #2 third** - Add error handling to workflows
4. **Fix #4 and #5** - Standardization improvements
5. **Fix #6 last** - Nice-to-have logging improvements
