# n8n Webhook API Reference

n8n은 이 시스템에서 **AI 게이트웨이** 역할을 합니다. 모든 웹훅은 Docker 내부 네트워크(`http://n8n:5678`)를 통해 호출됩니다.

## 엔드포인트 개요

| 엔드포인트 | 메서드 | 타임아웃 | 용도 |
|-----------|--------|---------|------|
| `/webhook/ai/chat` | POST | 120s | 멀티턴 대화 |
| `/webhook/ai/generate` | POST | 120s | 단일 텍스트 생성 |
| `/webhook/ai/vision` | POST | 300s | 이미지 분석 |
| `/webhook/ai/translate` | POST | 300s | 번역 |
| `/webhook/ai/task` | POST | 180s | 구조화된 태스크 |
| `/webhook/ai/embeddings` | POST | 120s | 벡터 임베딩 |
| `/webhook/ai/health` | GET | 10s | 헬스체크 |
| `/webhook/custom-llm/chat` | POST | 120s | 대체 LLM |

**Base URL:** `http://n8n:5678` (Docker 내부)

**클라이언트 코드:** `src/lib/n8n-client.js:94-103`

---

## 1. Chat (`/webhook/ai/chat`)

멀티턴 대화 처리. OpenCode Backend로 프록시됨.

**Workflow:** `n8n-workflows/ai-chat.json`

### Request

```json
{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" },
    { "role": "assistant", "content": "Hi there!" },
    { "role": "user", "content": "How are you?" }
  ],
  "model": "gpt-4.1",
  "temperature": 0.7,
  "maxTokens": 4096,
  "sessionId": "optional-session-id",
  "_meta": {
    "requestId": "n8n-1704067200-abc123",
    "timestamp": "2026-01-06T00:00:00.000Z",
    "source": "blog-backend"
  }
}
```

### Response (200 OK)

```json
{
  "content": "I'm doing well, thank you for asking!",
  "model": "gpt-4.1",
  "provider": "opencode",
  "sessionId": "session-abc123",
  "requestId": "n8n-1704067200-abc123"
}
```

### Error Response (500)

```json
{
  "error": "AI request failed",
  "code": "AI_ERROR"
}
```

### 데이터 변환 (Workflow 내부)

```javascript
// ai-chat.json - Build OpenCode Request 노드
// messages 배열 → 단일 문자열 변환
const message = messages.length === 1 
  ? messages[0].content 
  : messages.map(m => {
      const role = m.role === 'assistant' ? 'Assistant' 
                 : m.role === 'system' ? 'System' 
                 : 'User';
      return `${role}: ${m.content}`;
    }).join('\n\n');
```

### 에러 처리

이 워크플로우는 **에러 브랜치가 있음** (`ai-chat.json:277-284`):
- `Success?` 노드에서 statusCode 검사
- 실패 시 `Error Response` 노드로 분기

---

## 2. Generate (`/webhook/ai/generate`)

단일 프롬프트 텍스트 생성.

**Workflow:** `n8n-workflows/ai-generate.json`

### Request

```json
{
  "prompt": "Summarize the following text...",
  "systemPrompt": "You are a helpful assistant",
  "model": "gpt-4.1",
  "temperature": 0.2,
  "_meta": {
    "requestId": "n8n-generate-1704067200"
  }
}
```

### Response

```json
{
  "text": "Generated text...",
  "content": "Generated text...",
  "response": "Generated text...",
  "model": "gpt-4.1",
  "provider": "opencode",
  "requestId": "n8n-generate-1704067200"
}
```

**참고:** `text`, `content`, `response` 세 필드에 동일한 값이 반환됨 (클라이언트 호환성).

---

## 3. Vision (`/webhook/ai/vision`)

이미지 분석. R2 URL 또는 Base64 지원.

**Workflow:** `n8n-workflows/ai-vision.json`

### Request (URL 방식 - 권장)

```json
{
  "imageUrl": "https://r2-storage.example.com/image.jpg",
  "type": "url",
  "prompt": "Describe this image in detail.",
  "mimeType": "image/jpeg",
  "model": "gpt-4o",
  "_meta": {
    "requestId": "n8n-vision-1704067200"
  }
}
```

### Request (Base64 방식)

```json
{
  "image": "base64-encoded-image-data...",
  "type": "base64",
  "prompt": "Describe this image in detail.",
  "mimeType": "image/jpeg",
  "model": "gpt-4o"
}
```

### Response

```json
{
  "description": "The image shows a sunset over mountains...",
  "text": "The image shows a sunset over mountains...",
  "content": "The image shows a sunset over mountains...",
  "model": "gpt-4o",
  "provider": "opencode",
  "requestId": "n8n-vision-1704067200"
}
```

**참고:** `description`, `text`, `content` 세 필드에 동일한 값 (중복).

### 데이터 변환

```javascript
// ai-vision.json - Build OpenCode Request 노드
const message = type === 'url' 
  ? `[Image URL: ${imageUrl}]\n\n${prompt}`
  : `[Image: data:${mimeType};base64,${image}]\n\n${prompt}`;
```

### 에러 처리

**주의:** 이 워크플로우는 **에러 브랜치가 없음**. HTTP 요청 실패 시 적절한 에러 응답이 반환되지 않을 수 있음.

---

## 4. Translate (`/webhook/ai/translate`)

다국어 번역.

**Workflow:** `n8n-workflows/ai-translate.json`

### Request

```json
{
  "title": "원본 제목",
  "description": "원본 설명",
  "content": "번역할 전체 내용...",
  "sourceLang": "ko",
  "targetLang": "en",
  "model": "gpt-4.1",
  "_meta": {
    "requestId": "n8n-translate-1704067200"
  }
}
```

### Response

```json
{
  "title": "Translated Title",
  "description": "Translated description",
  "content": "Full translated content...",
  "isAiGenerated": true,
  "model": "gpt-4.1",
  "provider": "opencode",
  "requestId": "n8n-translate-1704067200"
}
```

### JSON 파싱 로직

```javascript
// ai-translate.json - Parse Response 노드
// AI 응답에서 JSON 추출
let parsed = null;
try {
  parsed = JSON.parse(text);
} catch {
  // 코드 펜스에서 추출 시도
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try { parsed = JSON.parse(fence[1].trim()); } catch {}
  }
  // raw JSON 객체 추출 시도
  if (!parsed) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { parsed = JSON.parse(text.slice(start, end + 1)); } catch {}
    }
  }
}
```

### 에러 처리

**주의:** 에러 브랜치 없음.

---

## 5. Task (`/webhook/ai/task`)

구조화된 태스크 수행 (sketch, prism, chain, summary).

**Workflow:** `n8n-workflows/ai-task.json`

### Request

```json
{
  "mode": "sketch",
  "payload": {
    "paragraph": "분석할 텍스트...",
    "postTitle": "글 제목",
    "persona": "default"
  },
  "temperature": 0.2,
  "model": "gpt-4.1"
}
```

### Response (mode별)

#### sketch

```json
{
  "ok": true,
  "data": {
    "mood": "curious",
    "bullets": ["Point 1", "Point 2", "Point 3"]
  },
  "mode": "sketch",
  "source": "opencode"
}
```

#### prism

```json
{
  "ok": true,
  "data": {
    "facets": [
      { "title": "Perspective A", "points": ["Point 1", "Point 2"] },
      { "title": "Perspective B", "points": ["Point 1", "Point 2"] }
    ]
  },
  "mode": "prism",
  "source": "opencode"
}
```

#### chain

```json
{
  "ok": true,
  "data": {
    "questions": [
      { "q": "Follow-up question 1?", "why": "To understand X" },
      { "q": "Follow-up question 2?", "why": "To clarify Y" }
    ]
  },
  "mode": "chain",
  "source": "opencode"
}
```

#### summary

```json
{
  "ok": true,
  "data": {
    "summary": "Concise summary of the content..."
  },
  "mode": "summary",
  "source": "opencode"
}
```

### 에러 처리

**주의:** 에러 브랜치 없음. 타임아웃 180s로 다른 긴 작업(300s)보다 짧음.

---

## 6. Embeddings (`/webhook/ai/embeddings`)

텍스트 벡터 임베딩 생성. TEI 서버로 프록시됨.

**Workflow:** `n8n-workflows/ai-embeddings.json`

### Request

```json
{
  "input": ["Text to embed", "Another text"],
  "model": "all-MiniLM-L6-v2",
  "_meta": {
    "requestId": "n8n-embed-1704067200"
  }
}
```

### Response

```json
{
  "embeddings": [[0.123, -0.456, ...], [0.789, -0.012, ...]],
  "data": [[0.123, -0.456, ...], [0.789, -0.012, ...]],
  "model": "all-MiniLM-L6-v2",
  "provider": "tei",
  "requestId": "n8n-embed-1704067200",
  "usage": {}
}
```

---

## 7. Health (`/webhook/ai/health`)

서비스 상태 확인.

**Workflow:** `n8n-workflows/ai-health.json`

### Request

```
GET /webhook/ai/health
```

### Response

```json
{
  "ok": true,
  "status": "ok",
  "service": "n8n-ai-gateway",
  "timestamp": "2026-01-06T00:00:00.000Z",
  "version": "1.0.0",
  "endpoints": {
    "chat": "/webhook/ai/chat",
    "generate": "/webhook/ai/generate",
    "vision": "/webhook/ai/vision",
    "translate": "/webhook/ai/translate",
    "task": "/webhook/ai/task",
    "embeddings": "/webhook/ai/embeddings",
    "health": "/webhook/ai/health"
  },
  "models": [
    { "id": "gpt-4.1", "name": "GPT-4.1 (OpenCode)", "provider": "OpenCode" },
    { "id": "gpt-4o", "name": "GPT-4o (Vision)", "provider": "OpenCode" }
  ]
}
```

---

## 클라이언트 사용법

### N8NClient (권장)

```javascript
import { getN8NClient } from './lib/n8n-client.js';

const client = getN8NClient();

// Chat
const chatResult = await client.chat([
  { role: 'user', content: 'Hello!' }
], { model: 'gpt-4.1' });

// Vision
const visionResult = await client.vision(
  'https://r2-storage.example.com/image.jpg',
  'Describe this image',
  { model: 'gpt-4o' }
);

// Task
const taskResult = await client.task('sketch', {
  paragraph: 'Text to analyze...',
  postTitle: 'Article Title'
});
```

### 응답 필드 흡수 패턴

클라이언트는 다중 필드 fallback을 사용:

```javascript
// n8n-client.js
chat():     result.content || result.text || result.response || ''
generate(): result.text || result.content || result.response || ''
vision():   result.description || result.text || result.content || result.analysis || ''
```

---

## 워크플로우 파일 위치

```
backend/n8n-workflows/
├── ai-chat.json        # 채팅 (에러 브랜치 있음)
├── ai-generate.json    # 텍스트 생성
├── ai-vision.json      # 이미지 분석 (에러 브랜치 없음)
├── ai-translate.json   # 번역 (에러 브랜치 없음)
├── ai-task.json        # 태스크 (에러 브랜치 없음)
├── ai-embeddings.json  # 임베딩
└── ai-health.json      # 헬스체크
```
