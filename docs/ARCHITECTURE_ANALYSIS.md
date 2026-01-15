# 프론트엔드-백엔드 연결 구조 분석

## 목차

1. [전체 아키텍처](#1-전체-아키텍처)
2. [프론트엔드 URL 관리](#2-프론트엔드-url-관리)
3. [백엔드 서비스 구조](#3-백엔드-서비스-구조)
4. [n8n Workflow 연결](#4-n8n-workflow-연결)
5. [AI 서버 연결](#5-ai-서버-연결)
6. [데이터 흐름](#6-데이터-흐름)

---

## 1. 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (브라우저)                                │
│                    https://noblog.nodove.com                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ getApiBaseUrl() 우선순위:                                            │   │
│  │ 1. window.APP_CONFIG.apiBaseUrl (런타임 주입)                        │   │
│  │ 2. import.meta.env.VITE_API_BASE_URL (빌드 시간)                     │   │
│  │ 3. localStorage.aiMemo.backendUrl (개발자 편의)                      │   │
│  │ 4. DEFAULT_API_URL = 'https://api.nodove.com' (기본값)               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
        ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
        │  Cloudflare      │  │ Direct Local │  │ Legacy URLs  │
        │  Workers         │  │ Backend      │  │ (마이그레이션)│
        │ api.nodove.com   │  │ localhost    │  │              │
        └──────────────────┘  └──────────────┘  └──────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌──────────────────────────┐    ┌──────────────────────────┐
        │   /api/v1/* 요청          │    │  /webhook/* (n8n)        │
        │   - /chat/*              │    │  - n8n workflow webhooks │
        │   - /ai/*                │    │                          │
        │   - /agent/*             │    │                          │
        │   - /posts/*             │    │                          │
        │   - /comments/*          │    │                          │
        └──────────────────────────┘    └──────────────────────────┘
                    │                               │
                    ▼                               ▼
        ┌──────────────────────────┐    ┌──────────────────────────┐
        │   Blog Backend API       │    │   n8n Workflow Engine    │
        │   (blog-api:5080)        │    │   (blog-n8n:5678)        │
        │                          │    │                          │
        │ - Chat sessions          │    │ - AI workflow execution  │
        │ - Agent coordinator      │    │ - Webhook handlers       │
        │ - RAG integration        │    │ - Task automation        │
        │ - Post management        │    │                          │
        └──────────────────────────┘    └──────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌──────────────────────────┐    ┌──────────────────────────┐
        │   AI Server Backend      │    │   AI Server Backend      │
        │   (ai-server-backend     │    │   (ai-server-backend     │
        │    :7016)                │    │    :7016)                │
        │                          │    │                          │
        │ OpenAI SDK Compatible    │    │ OpenAI SDK Compatible    │
        │ /v1/chat/completions     │    │ /v1/chat/completions     │
        │ /v1/models               │    │ /v1/models               │
        │ /v1/embeddings           │    │ /v1/embeddings           │
        └──────────────────────────┘    └──────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  AI Server Serve (LLM)        │
                    │  (ai-server-serve:7012)       │
                    │                               │
                    │ - OpenCode LLM Provider       │
                    │ - Model routing               │
                    │ - Provider integration        │
                    │   (GitHub Copilot, etc)       │
                    └───────────────────────────────┘
```

---

## 2. 프론트엔드 URL 관리

### 2.1 API Base URL 결정 프로세스

`@/home/nodove/workspace/blog/frontend/src/utils/apiBase.ts:32-98`

```typescript
export function getApiBaseUrl(): string {
  // 1단계: 런타임 주입 설정 (가장 높은 우선순위)
  const fromRuntime =
    window.APP_CONFIG?.apiBaseUrl || window.__APP_CONFIG?.apiBaseUrl;

  // 2단계: Vite 환경변수
  const fromEnv = import.meta.env.VITE_API_BASE_URL;

  // 3단계: localStorage (개발자 편의)
  const v = localStorage.getItem("aiMemo.backendUrl");

  // 4단계: 기본값
  const DEFAULT_API_URL = "https://api.nodove.com";

  // 정규화: 후행 슬래시, /api 제거
  return normalizeBaseUrl(baseUrl);
}
```

### 2.2 URL 마이그레이션

레거시 도메인 자동 마이그레이션:

- `ai-check.nodove.com` → `api.nodove.com`
- `blog-b.nodove.com` → `api.nodove.com`

### 2.3 Chat 엔드포인트 구성

`@/home/nodove/workspace/blog/frontend/src/services/chat/config.ts:56-61`

```typescript
export function buildChatUrl(path: string, sessionId?: string): string {
  const apiBase = getApiBaseUrl().replace(/\/$/, "");
  return sessionId
    ? `${apiBase}/api/v1/chat/session/${encodeURIComponent(sessionId)}${path}`
    : `${apiBase}/api/v1/chat${path}`;
}

// 예시:
// buildChatUrl('/stream') → https://api.nodove.com/api/v1/chat/stream
// buildChatUrl('/stream', 'sess-123') → https://api.nodove.com/api/v1/chat/session/sess-123/stream
```

---

## 3. 백엔드 서비스 구조

### 3.1 Docker Compose 서비스 맵

`@/home/nodove/workspace/blog/backend/docker-compose.blog-workflow.yml`

| 서비스                | 포트                | 역할                   | 네트워크     |
| --------------------- | ------------------- | ---------------------- | ------------ |
| **nginx**             | 80, 443, 8080, 8443 | 리버스 프록시          | 외부 노출    |
| **blog-api**          | 5080 (내부)         | 메인 백엔드 API        | blog-network |
| **blog-n8n**          | 5678 (내부)         | n8n 워크플로우 엔진    | blog-network |
| **blog-n8n-worker**   | -                   | n8n 큐 워커            | blog-network |
| **ai-server-backend** | 7016 (내부)         | OpenAI SDK 호환 어댑터 | blog-network |
| **ai-server-serve**   | 7012 (내부)         | LLM 프로바이더         | blog-network |
| **postgres**          | 5432 (내부)         | 데이터베이스           | blog-network |
| **redis**             | 6379 (내부)         | 캐시/큐                | blog-network |
| **chromadb**          | 8000 (내부)         | 벡터 DB (RAG)          | blog-network |
| **embedding-server**  | 80 (내부)           | 임베딩 생성            | blog-network |
| **terminal-server**   | 8080 (내부)         | 터미널 실행            | blog-network |

### 3.2 Backend API 라우트

`@/home/nodove/workspace/blog/backend/src/index.js:74-89`

```javascript
app.use("/api/v1/ai", aiRouter); // AI 요청 (OpenCode)
app.use("/api/v1/comments", commentsRouter); // 댓글
app.use("/api/v1/chat", chatRouter); // 채팅 세션
app.use("/api/v1/agent", agentRouter); // Agent Coordinator
app.use("/api/v1/posts", postsRouter); // 포스트
app.use("/api/v1/images", imagesRouter); // 이미지
app.use("/api/v1/rag", ragRouter); // RAG 검색
app.use("/api/v1/admin/ai", aiAdminRouter); // AI 관리
```

### 3.3 Backend AI 설정

`@/home/nodove/workspace/blog/backend/src/config.js:28-35`

```javascript
// AI 요청 흐름:
// Blog API → ai-server-backend:7016 → ai-server-serve:7012 → LLM

OPENCODE_BASE_URL: "http://ai-server-backend:7016";
OPENCODE_API_KEY: 환경변수;
OPENCODE_DEFAULT_PROVIDER: "github-copilot";
OPENCODE_DEFAULT_MODEL: "gpt-4.1";
```

---

## 4. n8n Workflow 연결

### 4.1 n8n 환경설정

`@/home/nodove/workspace/blog/backend/docker-compose.blog-workflow.yml:300-321`

```yaml
n8n:
  # Webhook & Editor URL
  WEBHOOK_URL: https://blog-bw.nodove.com/
  N8N_HOST: blog-bw.nodove.com
  N8N_PROTOCOL: https
  N8N_EDITOR_BASE_URL: https://blog-bw.nodove.com

  # AI Provider API Keys
  OPENAI_API_KEY: ${OPENAI_API_KEY}
  GOOGLE_API_KEY: ${GOOGLE_API_KEY}
  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}

  # Integration URLs (내부 Docker 네트워크)
  BLOG_API_URL: http://api:5080
  OPENCODE_BASE_URL: http://ai-server-backend:7016
  OPENCODE_SERVE_URL: http://ai-server-serve:7012
  CHROMADB_URL: http://chromadb:8000

  # 환경변수 접근 허용 (필수!)
  N8N_BLOCK_ENV_ACCESS_IN_NODE: false
```

### 4.2 n8n Webhook 경로

```
외부: https://blog-bw.nodove.com/webhook/ai-chat
내부: http://blog-n8n:5678/webhook/ai-chat
```

### 4.3 n8n에서 AI 호출 방식

**HTTP Request 노드 설정:**

```
URL: {{ ($env.OPENCODE_BASE_URL || 'http://ai-server-backend:7016') + '/v1/chat/completions' }}

Headers:
  Authorization: Bearer {{ $env.AI_API_KEY || $env.OPENAI_API_KEY || 'sk-noaicode' }}
  Content-Type: application/json

Body:
{
  "model": "gpt-4.1",
  "messages": [{"role": "user", "content": "..."}],
  "temperature": 0.7
}
```

---

## 5. AI 서버 연결

### 5.1 AI 서버 스택

```
┌─────────────────────────────────────────────────┐
│ AI Server Backend (ai-server-backend:7016)      │
│                                                  │
│ OpenAI SDK Compatible API                       │
│ - /v1/chat/completions (채팅)                   │
│ - /v1/models (모델 목록)                        │
│ - /v1/embeddings (임베딩)                       │
│ - /health (헬스 체크)                           │
│                                                  │
│ 인증: Authorization: Bearer ${AI_API_KEY}       │
└─────────────────────────────────────────────────┘
                      │
                      │ NOAICODE_BASE_URL=
                      │ http://ai-server-serve:7012
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│ AI Server Serve (ai-server-serve:7012)          │
│                                                  │
│ OpenCode LLM Provider                           │
│ - 모델 라우팅                                   │
│ - 프로바이더 통합                               │
│   - GitHub Copilot                              │
│   - OpenAI                                      │
│   - Google Gemini                               │
│   - Anthropic Claude                            │
│   - 기타 LLM                                    │
└─────────────────────────────────────────────────┘
```

### 5.2 API Key 관리

**GitHub Secrets (배포 시):**

```
AI_API_KEY → docker-compose .env → ADMIN_MASTER_KEY
```

**환경변수 체인:**

```
Backend:
  OPENCODE_API_KEY (레거시)
  OPENAI_API_KEY (새로운)

n8n:
  AI_API_KEY
  OPENAI_API_KEY
  GOOGLE_API_KEY
  ANTHROPIC_API_KEY
```

---

## 6. 데이터 흐름

### 6.1 Chat 요청 흐름

```
Frontend (브라우저)
  │
  ├─ getApiBaseUrl() 결정
  │  (runtime > env > localStorage > default)
  │
  └─ POST /api/v1/chat/stream
     (https://api.nodove.com/api/v1/chat/stream)
       │
       ▼
Cloudflare Workers (API Gateway)
  │
  ├─ 요청 라우팅
  ├─ 인증 검증
  └─ 백엔드로 포워드
       │
       ▼
Blog Backend (blog-api:5080)
  │
  ├─ /api/v1/chat 라우트 처리
  ├─ 세션 관리
  ├─ RAG 통합 (선택)
  └─ aiService.chat() 호출
       │
       ▼
OpenAI SDK Compatible Client
  │
  ├─ OPENAI_API_BASE_URL=http://ai-server-backend:7016/v1
  ├─ OPENAI_API_KEY 인증
  └─ POST /v1/chat/completions
       │
       ▼
AI Server Backend (ai-server-backend:7016)
  │
  ├─ OpenAI SDK 호환 API
  ├─ 요청 검증
  └─ ai-server-serve로 포워드
       │
       ▼
AI Server Serve (ai-server-serve:7012)
  │
  ├─ 모델 라우팅
  ├─ 프로바이더 선택
  └─ LLM 호출
       │
       ▼
LLM (GitHub Copilot, OpenAI, etc)
  │
  └─ 응답 반환
```

### 6.2 n8n Workflow 요청 흐름

```
Frontend / Backend
  │
  └─ POST https://blog-bw.nodove.com/webhook/ai-chat
     (또는 n8n 내부 호출)
       │
       ▼
Nginx (리버스 프록시)
  │
  └─ /webhook/* → n8n:5678
       │
       ▼
n8n Workflow Engine
  │
  ├─ Webhook 트리거
  ├─ 데이터 변환
  └─ HTTP Request 노드
       │
       ├─ URL: http://ai-server-backend:7016/v1/chat/completions
       ├─ Headers: Authorization: Bearer $AI_API_KEY
       └─ Body: OpenAI 형식
            │
            ▼
       AI Server Backend
            │
            └─ (위와 동일한 흐름)
```

### 6.3 Agent 요청 흐름

```
Frontend
  │
  └─ POST /api/v1/agent/run
       │
       ▼
Blog Backend (agentRouter)
  │
  ├─ AgentCoordinator 초기화
  ├─ 세션 메모리 로드
  ├─ 도구 실행 루프
  │  ├─ aiService.chat() (AI 호출)
  │  ├─ 도구 실행 (검색, 계산 등)
  │  └─ 반복
  └─ 응답 반환
       │
       ▼
Frontend (스트리밍 또는 JSON)
```

---

## 7. URL 관리 요약

### 7.1 프론트엔드에서 사용되는 URL

| 용도     | URL                                    | 출처            |
| -------- | -------------------------------------- | --------------- |
| API Base | `https://api.nodove.com`               | getApiBaseUrl() |
| Chat     | `${apiBase}/api/v1/chat/stream`        | buildChatUrl()  |
| Agent    | `${apiBase}/api/v1/agent/run`          | 직접 구성       |
| Posts    | `${apiBase}/api/v1/posts`              | 직접 구성       |
| Images   | `${apiBase}/api/v1/images/chat-upload` | 직접 구성       |

### 7.2 백엔드 내부 URL (Docker 네트워크)

| 서비스     | 내부 URL                        | 용도                   |
| ---------- | ------------------------------- | ---------------------- |
| Blog API   | `http://api:5080`               | n8n에서 호출           |
| AI Backend | `http://ai-server-backend:7016` | Blog API, n8n에서 호출 |
| AI Serve   | `http://ai-server-serve:7012`   | AI Backend에서 호출    |
| ChromaDB   | `http://chromadb:8000`          | RAG 검색               |
| Postgres   | `postgres:5432`                 | 데이터 저장            |
| Redis      | `redis:6379`                    | 캐시/큐                |

### 7.3 외부 URL (Cloudflare Workers)

| 엔드포인트  | 외부 URL                               | 내부 라우팅   |
| ----------- | -------------------------------------- | ------------- |
| API         | `https://api.nodove.com/api/v1/*`      | blog-api:5080 |
| n8n Editor  | `https://blog-bw.nodove.com`           | blog-n8n:5678 |
| n8n Webhook | `https://blog-bw.nodove.com/webhook/*` | blog-n8n:5678 |

---

## 8. 개발 환경 설정

### 8.1 로컬 개발 (localhost)

```bash
# Frontend
VITE_API_BASE_URL=http://localhost:5080

# Backend
OPENCODE_BASE_URL=http://ai-server-backend:7016
OPENCODE_API_KEY=sk-noaicode

# n8n
OPENCODE_BASE_URL=http://ai-server-backend:7016
```

### 8.2 프로덕션 (Cloudflare Workers)

```bash
# Frontend
VITE_API_BASE_URL=https://api.nodove.com
# 또는 런타임 주입: window.APP_CONFIG.apiBaseUrl

# Backend (Docker)
OPENCODE_BASE_URL=http://ai-server-backend:7016
OPENCODE_API_KEY=${AI_API_KEY}

# n8n (Docker)
OPENCODE_BASE_URL=http://ai-server-backend:7016
AI_API_KEY=${AI_API_KEY}
```

---

## 9. 트러블슈팅

### 9.1 프론트엔드가 잘못된 API에 연결되는 경우

1. **getApiBaseUrl() 우선순위 확인:**

   ```javascript
   console.log("API Base:", getApiBaseUrl());
   ```

2. **localStorage 확인:**

   ```javascript
   localStorage.getItem("aiMemo.backendUrl");
   ```

3. **런타임 설정 확인:**
   ```javascript
   window.APP_CONFIG?.apiBaseUrl;
   ```

### 9.2 n8n이 AI 서버에 연결 실패

1. **환경변수 확인:**

   ```bash
   docker exec blog-n8n env | grep OPENCODE
   ```

2. **내부 네트워크 연결 테스트:**
   ```bash
   docker exec blog-n8n curl http://ai-server-backend:7016/health
   ```

### 9.3 AI 응답이 없는 경우

1. **AI 서버 상태 확인:**

   ```bash
   curl http://localhost:7016/health
   ```

2. **API Key 확인:**

   ```bash
   docker exec blog-api env | grep OPENCODE_API_KEY
   ```

3. **로그 확인:**
   ```bash
   docker logs blog-api
   docker logs ai-server-backend
   ```
