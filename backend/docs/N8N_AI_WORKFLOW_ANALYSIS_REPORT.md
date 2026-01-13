# n8n AI Workflow 종합 분석 보고서

> **문서 버전**: 1.0.0  
> **작성일**: 2026-01-13  
> **대상**: pmx-102-1 백엔드 서버 n8n Docker Container

---

## 1. 시스템 아키텍처 개요

### 1.1 전체 AI 서비스 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Blog AI Service Architecture                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────┐     ┌──────────────────┐     ┌─────────────────────────────┐  │
│  │   Frontend   │────▶│  API Gateway     │────▶│    Backend (Express)        │  │
│  │ (React SPA)  │     │ (CF Workers)     │     │    blog-b:5080              │  │
│  └──────────────┘     └──────────────────┘     └───────────┬─────────────────┘  │
│                                                            │                    │
│                            ┌───────────────────────────────┼───────────────────┐│
│                            │                               │                   ││
│                            ▼                               ▼                   ││
│  ┌─────────────────────────────────────┐   ┌─────────────────────────────────┐ ││
│  │     n8n Workflow Engine             │   │   OpenCode Backend (Primary)   │ ││
│  │     blog-n8n:5678                   │   │   ai-server-backend:7016       │ ││
│  │                                     │   │                                 │ ││
│  │  Webhooks:                          │   │   ┌─────────────────────────┐   │ ││
│  │  - /webhook/ai/chat                 │   │   │  OpenCode Serve         │   │ ││
│  │  - /webhook/ai/generate             │◀─▶│   │  ai-server-serve:7012   │   │ ││
│  │  - /webhook/ai/vision               │   │   └──────────┬──────────────┘   │ ││
│  │  - /webhook/ai/translate            │   │              │                  │ ││
│  │  - /webhook/ai/task                 │   │              ▼                  │ ││
│  │  - /webhook/ai/embeddings           │   │   ┌─────────────────────────┐   │ ││
│  │  - /webhook/ai/health               │   │   │    LLM Providers        │   │ ││
│  └─────────────────────────────────────┘   │   │ - GitHub Copilot        │   │ ││
│                                            │   │ - OpenAI                │   │ ││
│                                            │   │ - Anthropic             │   │ ││
│                                            │   │ - Google Gemini         │   │ ││
│                                            │   └─────────────────────────┘   │ ││
│                                            └─────────────────────────────────┘ ││
│                                                                                 ││
│  ┌─────────────────────────────────────┐   ┌─────────────────────────────────┐ ││
│  │     TEI Embedding Server            │   │       ChromaDB                  │ ││
│  │     embedding-server:80             │   │       chromadb:8000             │ ││
│  │     (all-MiniLM-L6-v2)              │   │       (Vector Store)            │ ││
│  └─────────────────────────────────────┘   └─────────────────────────────────┘ ││
│                                                                                 ││
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Hybrid Mode 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Hybrid Mode Request Flow                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USE_OPENCODE_FOR_LLM=true (기본값)                                         │
│  ═══════════════════════════════════                                        │
│                                                                             │
│  [LLM Calls: chat, generate]                                                │
│  ┌─────────┐     ┌──────────────────┐     ┌─────────────────────────────┐   │
│  │ Client  │────▶│   N8NClient      │────▶│  OpenCode Backend (:7016)  │   │
│  └─────────┘     │ (Primary Route)  │     │  → OpenCode Serve (:7012)  │   │
│                  └────────┬─────────┘     │  → LLM Provider            │   │
│                           │               └─────────────────────────────┘   │
│                           │ (Fallback)                                      │
│                           ▼                                                 │
│                  ┌──────────────────┐                                       │
│                  │  n8n Webhooks    │                                       │
│                  │  (:5678)         │                                       │
│                  └──────────────────┘                                       │
│                                                                             │
│  [Non-LLM Calls: vision, translate, task, embeddings]                       │
│  ┌─────────┐     ┌──────────────────┐                                       │
│  │ Client  │────▶│  n8n Webhooks    │  (항상 n8n 경유)                      │
│  └─────────┘     │  (:5678)         │                                       │
│                  └──────────────────┘                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. n8n 워크플로우 상세 분석

### 2.1 워크플로우 목록 및 기능

| 워크플로우 파일 | Webhook 경로 | 기능 | 대상 백엔드 |
|----------------|-------------|------|------------|
| `ai-chat.json` | `/webhook/ai/chat` | AI 채팅 (OpenAI 호환) | OpenCode Backend |
| `ai-generate.json` | `/webhook/ai/generate` | 텍스트 생성 | OpenCode Backend |
| `ai-task.json` | `/webhook/ai/task` | 구조화된 태스크 (sketch/prism/chain/summary) | OpenCode Backend |
| `ai-translate.json` | `/webhook/ai/translate` | 다국어 번역 | OpenCode Backend |
| `ai-vision.json` | `/webhook/ai/vision` | 이미지 분석 | OpenCode Backend |
| `ai-embeddings.json` | `/webhook/ai/embeddings` | 텍스트 임베딩 | TEI Server |
| `ai-health.json` | `/webhook/ai/health` | 헬스 체크 | 자체 응답 |

### 2.2 각 워크플로우 상세 분석

#### 2.2.1 AI Chat Workflow (`ai-chat.json`)

**목적**: OpenAI Chat Completions API 호환 채팅 인터페이스 제공

**노드 흐름**:
```
Webhook → Set Parameters → Build OpenCode Request → OpenCode Chat → Success? 
                                                                    ├─ Yes → Format Response → Respond (200)
                                                                    └─ No → Error Response (500)
```

**핵심 설정**:
```javascript
// 환경변수에서 OpenCode 백엔드 URL 결정
url: ($env.OPENCODE_BACKEND_URL || $env.OPENCODE_BASE_URL || 'http://opencode-backend:7016') + '/chat'

// 기본 모델 및 프로바이더
model: $json.body.model || $env.OPENCODE_DEFAULT_MODEL || 'gpt-4.1'
providerID: $env.OPENCODE_DEFAULT_PROVIDER || 'github-copilot'
```

**입력 포맷**:
```json
{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "model": "gpt-4.1",
  "temperature": 0.7,
  "maxTokens": 4096,
  "sessionId": "optional-session-id"
}
```

**출력 포맷**:
```json
{
  "content": "AI 응답 텍스트",
  "model": "gpt-4.1",
  "provider": "opencode",
  "sessionId": "ses_xxx",
  "requestId": "n8n-xxx"
}
```

---

#### 2.2.2 AI Generate Workflow (`ai-generate.json`)

**목적**: 단일 프롬프트 기반 텍스트 생성

**노드 흐름**:
```
Webhook → Set Parameters → Build OpenCode Request → OpenCode Chat → Success?
                                                                    ├─ Yes → Format Response → Respond
                                                                    └─ No → Error Response
```

**입력 포맷**:
```json
{
  "prompt": "생성할 텍스트 프롬프트",
  "systemPrompt": "선택적 시스템 프롬프트",
  "model": "gpt-4.1",
  "temperature": 0.2
}
```

**출력 포맷**:
```json
{
  "text": "생성된 텍스트",
  "content": "생성된 텍스트 (alias)",
  "response": "생성된 텍스트 (alias)",
  "model": "gpt-4.1",
  "provider": "opencode",
  "requestId": "n8n-generate-xxx"
}
```

---

#### 2.2.3 AI Task Workflow (`ai-task.json`)

**목적**: 구조화된 AI 태스크 처리 (sketch, prism, chain, summary, custom)

**노드 흐름**:
```
Webhook → Set Parameters → Switch by Mode ─┬─ sketch → Sketch Prompt ──┐
                                            ├─ prism  → Prism Prompt  ──┤
                                            ├─ chain  → Chain Prompt  ──┼→ Build Request → OpenCode → Parse → Respond
                                            ├─ summary→ Summary Prompt ─┤
                                            └─ custom → Sketch Prompt ──┘
```

**모드별 프롬프트 및 출력**:

| 모드 | 출력 스키마 | 설명 |
|------|------------|------|
| `sketch` | `{ mood: string, bullets: string[] }` | 감정적 스케치 + 핵심 포인트 |
| `prism` | `{ facets: [{ title, points[] }] }` | 다면적 분석 (2-3 facets) |
| `chain` | `{ questions: [{ q, why }] }` | 연쇄 질문 (3-5 questions) |
| `summary` | `{ summary: string }` | 요약 텍스트 |

**JSON 파싱 로직** (Code 노드):
```javascript
// 1. 직접 JSON 파싱 시도
data = JSON.parse(text);

// 2. 코드 펜스 내 JSON 추출
const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
if (fence?.[1]) data = JSON.parse(fence[1].trim());

// 3. 중괄호 범위 추출
const start = text.indexOf('{');
const end = text.lastIndexOf('}');
if (start >= 0 && end > start) data = JSON.parse(text.slice(start, end + 1));

// 4. 폴백 데이터 생성
if (!data) data = getFallbackData(mode);
```

---

#### 2.2.4 AI Translate Workflow (`ai-translate.json`)

**목적**: 다국어 번역 (title, description, content 필드)

**입력 포맷**:
```json
{
  "title": "번역할 제목",
  "description": "번역할 설명",
  "content": "번역할 본문",
  "sourceLang": "ko",
  "targetLang": "en",
  "model": "gpt-4.1"
}
```

**시스템 프롬프트**:
```
You are a professional translator. Translate accurately while preserving 
meaning, tone, and formatting (including markdown). Do not add explanations or notes.
```

**출력 포맷**:
```json
{
  "title": "Translated Title",
  "description": "Translated Description",
  "content": "Translated Content...",
  "isAiGenerated": true,
  "model": "gpt-4.1",
  "provider": "opencode"
}
```

---

#### 2.2.5 AI Vision Workflow (`ai-vision.json`)

**목적**: 이미지 분석 (URL 또는 Base64)

**중요**: Vision은 항상 n8n 워크플로우를 경유합니다 (OpenCode 직접 호출 X).
이는 R2 스토리지의 이미지 URL을 n8n에서 직접 페칭하여 처리하기 위함입니다.

**입력 포맷**:
```json
{
  "imageUrl": "https://r2-bucket.../image.jpg",  // URL 방식 (권장)
  "image": "base64-encoded-data",                // Base64 방식 (레거시)
  "prompt": "Describe this image in detail.",
  "mimeType": "image/jpeg",
  "model": "gpt-4o"
}
```

**처리 로직**:
```javascript
// URL과 Base64 자동 감지
type: $json.body.type || ($json.body.imageUrl ? 'url' : 'base64')

// 메시지 포맷
message: type === 'url' 
  ? '[Image URL: ' + imageUrl + ']\n\n' + prompt
  : '[Image: data:' + mimeType + ';base64,' + image + ']\n\n' + prompt
```

---

#### 2.2.6 AI Embeddings Workflow (`ai-embeddings.json`)

**목적**: 텍스트 임베딩 벡터 생성 (RAG용)

**대상 서버**: TEI (Text Embeddings Inference) Server - `http://embedding-server:80`

**입력 포맷**:
```json
{
  "input": ["텍스트1", "텍스트2"],  // 또는 단일 문자열
  "model": "all-MiniLM-L6-v2"
}
```

**출력 포맷**:
```json
{
  "embeddings": [[0.1, 0.2, ...], [0.3, 0.4, ...]],
  "data": [[0.1, 0.2, ...], [0.3, 0.4, ...]],
  "model": "all-MiniLM-L6-v2",
  "provider": "tei",
  "usage": {}
}
```

---

#### 2.2.7 AI Health Workflow (`ai-health.json`)

**목적**: n8n AI Gateway 헬스 체크

**출력 포맷**:
```json
{
  "ok": true,
  "status": "ok",
  "service": "n8n-ai-gateway",
  "timestamp": "2026-01-13T00:00:00.000Z",
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

## 3. OpenAI SDK 호환 API 설정

### 3.1 현재 설정 (Docker 내부 네트워크)

현재 모든 n8n 워크플로우는 Docker 내부 네트워크를 통해 OpenCode Backend에 연결됩니다:

```javascript
// 현재 설정 (n8n 워크플로우 내)
url: $env.OPENCODE_BACKEND_URL || $env.OPENCODE_BASE_URL || 'http://opencode-backend:7016'
```

### 3.2 외부 접근 설정 (noaicode.nodove.com)

외부에서 OpenAI SDK 호환 API로 접근하려면 다음 환경변수를 설정해야 합니다:

**n8n 환경변수 설정** (docker-compose 또는 n8n UI Variables):
```bash
# n8n에서 외부 API 사용 시 설정
OPENCODE_BACKEND_URL=https://noaicode.nodove.com

# 또는 OpenAI 호환 엔드포인트 직접 사용
OPENCODE_CHAT_ENDPOINT=https://noaicode.nodove.com/v1/chat/completions
```

### 3.3 NoAICode Backend API 호환성

`noaicode.nodove.com`에서 제공하는 OpenAI 호환 API:

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/v1/models` | GET | 사용 가능한 모델 목록 |
| `/v1/models/:model` | GET | 특정 모델 정보 |
| `/v1/chat/completions` | POST | Chat Completions (OpenAI 호환) |
| `/chat` | POST | NoAICode 네이티브 채팅 API |
| `/health` | GET | 헬스 체크 |
| `/mcp` | POST | MCP (Model Context Protocol) |

**OpenAI 호환 요청 예시**:
```bash
curl -X POST https://noaicode.nodove.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <session_id>" \
  -d '{
    "model": "opencode/big-pickle",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "stream": false
  }'
```

---

## 4. Fallback 처리 방식 상세 분석

### 4.1 N8NClient Hybrid Mode Fallback

`backend/src/lib/n8n-client.js`에서 구현된 폴백 로직:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                     Fallback Chain (Hybrid Mode)                          │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────┐                                                          │
│  │   Request   │                                                          │
│  └──────┬──────┘                                                          │
│         │                                                                 │
│         ▼                                                                 │
│  ┌─────────────────────────────────────┐                                  │
│  │  USE_OPENCODE_FOR_LLM=true?         │                                  │
│  └────────┬───────────────┬────────────┘                                  │
│           │               │                                               │
│        Yes│            No │                                               │
│           ▼               │                                               │
│  ┌─────────────────┐      │                                               │
│  │ Try OpenCode    │      │                                               │
│  │ Backend (:7016) │      │                                               │
│  └────────┬────────┘      │                                               │
│           │               │                                               │
│      ┌────┴────┐          │                                               │
│   Success   Failure       │                                               │
│      │         │          │                                               │
│      ▼         ▼          ▼                                               │
│  ┌──────┐   ┌──────────────────┐                                          │
│  │Return│   │ Fallback to n8n │◀────────────────────────────────────────  │
│  │Result│   │ Webhooks (:5678) │                                          │
│  └──────┘   └────────┬─────────┘                                          │
│                      │                                                    │
│                 ┌────┴────┐                                               │
│              Success   Failure                                            │
│                 │         │                                               │
│                 ▼         ▼                                               │
│             ┌──────┐   ┌───────────┐                                      │
│             │Return│   │ Return    │                                      │
│             │Result│   │ Fallback  │                                      │
│             └──────┘   │ Data      │                                      │
│                        └───────────┘                                      │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Chat/Generate Fallback 코드

```javascript
// n8n-client.js - chat() 메서드
async chat(messages, options = {}) {
  // 1차: OpenCode Backend 시도
  if (this.useOpenCodeForLLM && this._openCodeClient) {
    try {
      const result = await this._openCodeClient.chat(messages, {...});
      return { content: result.content, provider: 'opencode', ... };
    } catch (error) {
      logger.warn({ operation: 'chat' }, 
        'OpenCode chat failed, falling back to n8n',
        { error: error.message }
      );
      // Fall through to n8n
    }
  }

  // 2차: n8n Webhook 폴백
  const result = await this._request('chat', { messages, ... }, options);
  return { content: result.content, provider: result.provider || 'n8n', ... };
}
```

### 4.3 Task Fallback 데이터

n8n 요청 실패 시 반환되는 폴백 데이터:

```javascript
// n8n-client.js - _getFallbackData()
_getFallbackData(mode, payload) {
  const text = payload.paragraph || payload.content || '';
  const sentences = text.split(/[.!?]\s+/).filter(Boolean);

  switch (mode) {
    case 'sketch':
      return {
        mood: 'curious',
        bullets: sentences.slice(0, 4).map(s => s.slice(0, 140)),
      };
    
    case 'prism':
      return {
        facets: [
          { title: '핵심 요점', points: [text.slice(0, 140)] },
          { title: '생각해볼 점', points: ['관점 A', '관점 B'] },
        ],
      };
    
    case 'chain':
      return {
        questions: [
          { q: '무엇이 핵심 주장인가?', why: '핵심을 명료화' },
          { q: '어떤 가정이 있는가?', why: '숨은 전제 확인' },
          { q: '적용 예시는?', why: '구체화' },
        ],
      };
    
    case 'summary':
      return {
        summary: text.slice(0, 300) + (text.length > 300 ? '...' : ''),
      };
    
    default:
      return { text };
  }
}
```

### 4.4 Circuit Breaker 패턴

연속 실패 시 서비스 보호를 위한 Circuit Breaker:

```javascript
// 설정값
const CIRCUIT_BREAKER_THRESHOLD = 5;      // 5회 연속 실패
const CIRCUIT_BREAKER_RESET_TIME = 60000; // 1분 후 리셋

// 상태 관리
this._circuitState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
};

// Circuit이 Open 상태면 즉시 에러 반환
if (this._isCircuitOpen()) {
  throw new Error('n8n service temporarily unavailable (circuit breaker open)');
}
```

### 4.5 Health Check 캐싱

빈번한 헬스 체크 호출 최적화:

```javascript
this._healthCache = {
  lastCheck: 0,
  isHealthy: false,
  cacheDuration: 30000, // 30초 캐시
  status: null,
};

async health(force = false) {
  if (!force && Date.now() - this._healthCache.lastCheck < this._healthCache.cacheDuration) {
    return { ok: this._healthCache.isHealthy, cached: true };
  }
  // ... 실제 헬스 체크 수행
}
```

---

## 5. 환경변수 설정 가이드

### 5.1 필수 환경변수 (.env)

```bash
# =================================================================
# AI Service Configuration
# =================================================================

# OpenCode Backend (Primary LLM Gateway)
OPENCODE_BASE_URL=http://ai-server-backend:7016
OPENCODE_API_KEY=                                    # Optional
OPENCODE_DEFAULT_PROVIDER=github-copilot
OPENCODE_DEFAULT_MODEL=gpt-4.1

# n8n Workflow Engine (Fallback & Non-LLM tasks)
N8N_BASE_URL=http://n8n:5678
N8N_WEBHOOK_URL=https://blog-bw.nodove.com/
N8N_HOST=blog-bw.nodove.com
N8N_API_KEY=                                         # Optional

# Hybrid Mode Toggle
# true (default): LLM → OpenCode, Non-LLM → n8n
# false: All AI → n8n (legacy mode)
USE_OPENCODE_FOR_LLM=true

# Default model for non-hybrid mode
AI_DEFAULT_MODEL=gemini-1.5-flash

# =================================================================
# Provider API Keys (for n8n AI nodes)
# =================================================================
GOOGLE_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

### 5.2 n8n Variables (n8n UI에서 설정)

n8n UI → Settings → Variables에서 설정:

| Variable Name | Default Value | Description |
|--------------|---------------|-------------|
| `OPENCODE_BACKEND_URL` | `http://ai-server-backend:7016` | OpenCode Backend URL |
| `OPENCODE_BASE_URL` | `http://ai-server-backend:7016` | Alias for compatibility |
| `OPENCODE_DEFAULT_PROVIDER` | `github-copilot` | Default LLM provider |
| `OPENCODE_DEFAULT_MODEL` | `gpt-4.1` | Default model ID |
| `OPENCODE_API_KEY` | (empty) | Optional API key |
| `TEI_URL` | `http://embedding-server:80` | TEI Server URL |

---

## 6. 서비스별 처리 경로 매핑

### 6.1 AI 기능별 처리 경로

| 기능 | Backend 클라이언트 | n8n 워크플로우 | 최종 처리 서버 |
|------|-------------------|----------------|---------------|
| **Chat** | `N8NClient.chat()` | `ai-chat.json` | OpenCode Backend → Serve → LLM |
| **Generate** | `N8NClient.generate()` | `ai-generate.json` | OpenCode Backend → Serve → LLM |
| **Vision** | `N8NClient.vision()` | `ai-vision.json` | n8n → OpenCode → LLM (GPT-4o) |
| **Translate** | `N8NClient.translate()` | `ai-translate.json` | n8n → OpenCode → LLM |
| **Task (sketch)** | `N8NClient.task('sketch')` | `ai-task.json` | n8n → OpenCode → LLM |
| **Task (prism)** | `N8NClient.task('prism')` | `ai-task.json` | n8n → OpenCode → LLM |
| **Task (chain)** | `N8NClient.task('chain')` | `ai-task.json` | n8n → OpenCode → LLM |
| **Task (summary)** | `N8NClient.task('summary')` | `ai-task.json` | n8n → OpenCode → LLM |
| **Embeddings** | `N8NClient.embeddings()` | `ai-embeddings.json` | n8n → TEI Server |
| **Health** | `N8NClient.health()` | `ai-health.json` | n8n (자체 응답) |

### 6.2 Vision 특수 처리

Vision은 **항상** n8n 워크플로우를 경유합니다:

```javascript
// n8n-client.js
async vision(imageData, prompt, options = {}) {
  // Vision ALWAYS uses n8n workflow (no OpenCode)
  // This ensures consistent behavior with R2 image URLs
  
  const isUrl = imageData.startsWith('http://') || imageData.startsWith('https://');
  
  const payload = {
    prompt,
    mimeType: options.mimeType || 'image/jpeg',
    model: options.model || 'gpt-4o',
  };

  if (isUrl) {
    // n8n will fetch the image from R2
    payload.imageUrl = imageData;
    payload.type = 'url';
  } else {
    // Legacy: send base64 directly
    payload.image = imageData;
    payload.type = 'base64';
  }

  return this._request('vision', payload, { timeout: LONG_TIMEOUT });
}
```

---

## 7. 워크플로우 Import 및 활성화 가이드

### 7.1 워크플로우 Import

**방법 1: n8n UI에서 수동 Import**

1. n8n 대시보드 접속: `https://blog-bw.nodove.com`
2. **Workflows** → **Add workflow** → **Import from File**
3. `backend/n8n-workflows/` 폴더의 JSON 파일 Import:
   - `ai-chat.json`
   - `ai-generate.json`
   - `ai-task.json`
   - `ai-translate.json`
   - `ai-vision.json`
   - `ai-embeddings.json`
   - `ai-health.json`

**방법 2: CLI Import**

```bash
# Docker Compose 환경에서
docker compose -f docker-compose.blog-workflow.yml exec -T n8n \
  n8n import:workflow --input=/workflows/ai-chat.json

# 모든 워크플로우 일괄 Import
for workflow in n8n-workflows/*.json; do
  docker compose exec -T n8n n8n import:workflow --input="/workflows/$(basename $workflow)"
done
```

### 7.2 자동 배포 스크립트

`backend/scripts/n8n-workflow-deploy.sh` 스크립트로 자동 배포:

```bash
cd /opt/blog-stack

./scripts/n8n-workflow-deploy.sh                # Import + Activate
./scripts/n8n-workflow-deploy.sh --test         # Import + Activate + Test
./scripts/n8n-workflow-deploy.sh --import-only  # Import만
./scripts/n8n-workflow-deploy.sh --dry-run      # 미리보기

./scripts/n8n-workflow-deploy.sh --help
```

### 7.3 수동 워크플로우 활성화

Import 후 각 워크플로우를 **Active** 상태로 변경해야 합니다:

1. n8n UI → **Workflows**
2. 각 워크플로우 클릭
3. 우측 상단 **Active** 토글 ON
4. 또는 워크플로우 목록에서 토글 직접 변경

### 7.4 환경변수 확인

n8n UI → **Settings** → **Variables**에서 다음 변수 확인:

```
OPENCODE_BACKEND_URL = http://ai-server-backend:7016
OPENCODE_DEFAULT_PROVIDER = github-copilot
OPENCODE_DEFAULT_MODEL = gpt-4.1
TEI_URL = http://embedding-server:80
```

---

## 8. 테스트 및 검증

### 8.1 Health Check 테스트

```bash
# n8n AI Gateway Health
curl -s https://blog-bw.nodove.com/webhook/ai/health | jq

# Expected:
{
  "ok": true,
  "status": "ok",
  "service": "n8n-ai-gateway",
  "endpoints": {
    "chat": "/webhook/ai/chat",
    ...
  }
}
```

### 8.2 Chat API 테스트

```bash
curl -X POST https://blog-bw.nodove.com/webhook/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "model": "gpt-4.1"
  }' | jq
```

### 8.3 Generate API 테스트

```bash
curl -X POST https://blog-bw.nodove.com/webhook/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a short poem about coding",
    "temperature": 0.7
  }' | jq
```

### 8.4 Task API 테스트 (Sketch)

```bash
curl -X POST https://blog-bw.nodove.com/webhook/ai/task \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sketch",
    "payload": {
      "paragraph": "Artificial intelligence is transforming how we work and live.",
      "postTitle": "AI Revolution"
    }
  }' | jq
```

### 8.5 Embeddings API 테스트

```bash
curl -X POST https://blog-bw.nodove.com/webhook/ai/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "input": ["Hello world", "Test embedding"]
  }' | jq
```

---

## 9. 트러블슈팅

### 9.1 일반적인 문제

| 증상 | 원인 | 해결 |
|------|------|------|
| 502 Bad Gateway | OpenCode Backend 연결 실패 | `docker logs ai-server-backend` 확인 |
| Timeout | 모델 응답 지연 | 타임아웃 값 증가 (120s → 300s) |
| Empty Response | AI 모델 빈 응답 | 프롬프트 수정, 다른 모델 시도 |
| Auth Error | API 키 문제 | 환경변수 확인 |
| Circuit Breaker Open | 연속 5회 실패 | 서비스 상태 확인, 1분 후 자동 리셋 |

### 9.2 로그 확인

```bash
# n8n 로그
docker compose logs -f n8n

# OpenCode Backend 로그
docker compose logs -f ai-server-backend

# OpenCode Serve 로그
docker compose logs -f noaicode

# Blog API 로그
docker compose logs -f api
```

### 9.3 서비스 재시작

```bash
# 전체 재시작
docker compose -f docker-compose.blog-workflow.yml restart

# 개별 서비스 재시작
docker compose restart n8n ai-server-backend noaicode
```

---

## 10. 요약

### 10.1 핵심 아키텍처 요약

1. **Hybrid Mode (기본)**: LLM 호출은 OpenCode Backend를 우선 사용하고, 실패 시 n8n으로 폴백
2. **Vision/Non-LLM**: 항상 n8n 워크플로우 경유 (이미지 처리, 번역, 태스크 등)
3. **Embeddings**: TEI Server로 직접 요청 (n8n 경유)

### 10.2 처리 경로 요약

```
LLM Calls (chat, generate):
  OpenCode Backend → OpenCode Serve → LLM Provider
  (Fallback) → n8n Webhook → OpenCode Backend → ...

Non-LLM Calls (vision, translate, task):
  n8n Webhook → OpenCode Backend → OpenCode Serve → LLM Provider

Embeddings:
  n8n Webhook → TEI Server (all-MiniLM-L6-v2)
```

### 10.3 폴백 체인 요약

```
1. OpenCode Backend (Primary)
   ↓ (실패 시)
2. n8n Webhook (Secondary)
   ↓ (실패 시)
3. Fallback Data (Static, Client-side generated)
```

---

*본 문서는 pmx-102-1 서버의 n8n 워크플로우 분석을 기반으로 작성되었습니다.*
