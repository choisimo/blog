# Infrastructure Modernization Plan

블로그 플랫폼의 인프라 현대화 계획서입니다.

## 목차

1. [현재 아키텍처 분석](#1-현재-아키텍처-분석)
2. [Internal Gateway 설계](#2-internal-gateway-설계)
3. [환경변수 및 인증 체계 단일화](#3-환경변수-및-인증-체계-단일화)
4. [Redis 이벤트 브로커 확장](#4-redis-이벤트-브로커-확장)
5. [구현 로드맵](#5-구현-로드맵)

---

## 1. 현재 아키텍처 분석

### 1.1 현재 서비스 통신 구조

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        현재 아키텍처 (직접 참조)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     직접 참조                                              │
│  │   blog-api   │───────────────────────► http://ai-server-backend:7016    │
│  │   (:5080)    │                                                           │
│  └──────────────┘                                                           │
│                                                                             │
│  ┌──────────────┐     직접 참조                                              │
│  │     n8n      │───────────────────────► http://ai-server-backend:7016    │
│  │   (:5678)    │───────────────────────► http://ai-server-serve:7012      │
│  └──────────────┘                                                           │
│                                                                             │
│  ┌──────────────┐                                                           │
│  │  n8n-worker  │───────────────────────► http://ai-server-backend:7016    │
│  │  (replicas)  │                                                           │
│  └──────────────┘                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 식별된 문제점

| 문제 영역 | 현재 상태 | 위험도 |
|-----------|-----------|--------|
| **서비스 커플링** | 모든 서비스가 `ai-server-backend:7016` 직접 참조 | 🔴 High |
| **환경변수 분산** | `AI_API_KEY`, `OPENCODE_API_KEY`, `OPENAI_API_KEY` 혼재 | 🟡 Medium |
| **동기식 통신** | HTTP 기반 실시간 요청만 사용 | 🟡 Medium |
| **장애 전파** | AI 서버 장애 시 전체 시스템 영향 | 🔴 High |
| **확장성 제한** | 서비스 위치 변경 시 다수 파일 수정 필요 | 🟡 Medium |

### 1.3 영향받는 파일 목록

**직접 URL 참조가 있는 파일:**

```
backend/src/config.js
backend/src/lib/opencode-client.js
backend/src/lib/openai-compat-client.js
backend/src/lib/ai-service.js
backend/docker-compose.blog-workflow.yml
backend/n8n-workflows/ai-*.json (5개 파일)
```

---

## 2. Internal Gateway 설계

### 2.1 목표 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      목표 아키텍처 (Internal Gateway)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐                  ┌─────────────────┐                      │
│  │   blog-api   │──► /ai-gateway ─►│                 │──► ai-server-backend │
│  │   (:5080)    │                  │                 │                      │
│  └──────────────┘                  │  Internal Nginx │                      │
│                                    │  (ai-gateway)   │                      │
│  ┌──────────────┐                  │                 │                      │
│  │     n8n      │──► /ai-gateway ─►│    :7000        │──► ai-server-serve   │
│  │   (:5678)    │                  │                 │                      │
│  └──────────────┘                  └─────────────────┘                      │
│                                                                             │
│  ┌──────────────┐                                                           │
│  │  n8n-worker  │──► /ai-gateway ─────────────────────►                     │
│  │  (replicas)  │                                                           │
│  └──────────────┘                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Internal Gateway 구성

**새로운 서비스: `ai-gateway` (Nginx)**

```yaml
# docker-compose.blog-workflow.yml 에 추가
ai-gateway:
  image: nginx:alpine
  container_name: ai-gateway
  restart: unless-stopped
  expose:
    - "7000"
  volumes:
    - ./nginx-ai-gateway.conf:/etc/nginx/conf.d/default.conf:ro
  networks:
    blog-network:
      aliases:
        - ai-gateway
        - ai
  depends_on:
    - ai-server-backend
    - noaicode
  healthcheck:
    test: ["CMD-SHELL", "curl -sf http://localhost:7000/health || exit 1"]
    interval: 30s
    timeout: 10s
    retries: 3
```

### 2.3 Nginx Gateway 설정

**`nginx-ai-gateway.conf`**

```nginx
# AI Internal Gateway Configuration
# All internal services should use http://ai-gateway:7000 instead of direct URLs

upstream ai_backend {
    server ai-server-backend:7016;
    keepalive 32;
}

upstream ai_serve {
    server ai-server-serve:7012;
    keepalive 32;
}

server {
    listen 7000;
    server_name ai-gateway;

    # Health check endpoint
    location = /health {
        access_log off;
        return 200 '{"ok":true,"service":"ai-gateway"}';
        add_header Content-Type application/json;
    }

    # =========================================================================
    # OpenAI SDK Compatible Endpoints (Primary)
    # http://ai-gateway:7000/v1/chat/completions → ai-server-backend:7016
    # =========================================================================
    
    location /v1/ {
        proxy_pass http://ai_backend/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Connection "";
        
        # Timeouts for LLM requests
        proxy_connect_timeout 30s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        
        # Buffering for streaming responses
        proxy_buffering off;
        proxy_cache off;
    }

    # =========================================================================
    # Legacy Chat Endpoint (Backward Compatibility)
    # http://ai-gateway:7000/chat → ai-server-backend:7016/chat
    # =========================================================================
    
    location /chat {
        proxy_pass http://ai_backend/chat;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Connection "";
        
        proxy_connect_timeout 30s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # =========================================================================
    # AI Serve Direct Access (for advanced use cases)
    # http://ai-gateway:7000/serve/* → ai-server-serve:7012/*
    # =========================================================================
    
    location /serve/ {
        proxy_pass http://ai_serve/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Connection "";
        
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # =========================================================================
    # Default: Proxy to AI Backend
    # =========================================================================
    
    location / {
        proxy_pass http://ai_backend/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Connection "";
    }
}
```

### 2.4 환경변수 변경

**변경 전 (직접 참조):**
```bash
OPENCODE_BASE_URL=http://ai-server-backend:7016
OPENAI_API_BASE_URL=http://ai-server-backend:7016/v1
```

**변경 후 (Gateway 경유):**
```bash
# 단일 AI Gateway URL
AI_GATEWAY_URL=http://ai-gateway:7000

# OpenAI SDK Compatible (recommended)
OPENAI_API_BASE_URL=http://ai-gateway:7000/v1

# Legacy (backward compatibility)
OPENCODE_BASE_URL=http://ai-gateway:7000
```

### 2.5 코드 변경 사항

**`backend/src/config.js`:**
```javascript
// Before
OPENCODE_BASE_URL: z.string().default('http://ai-server-backend:7016'),

// After
AI_GATEWAY_URL: z.string().default('http://ai-gateway:7000'),
OPENCODE_BASE_URL: z.string().default('http://ai-gateway:7000'), // backward compat
```

**`backend/src/lib/openai-compat-client.js`:**
```javascript
// Before
const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL || 'http://ai-server-backend:7016/v1';

// After
const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL 
  || process.env.AI_GATEWAY_URL + '/v1'
  || 'http://ai-gateway:7000/v1';
```

---

## 3. 환경변수 및 인증 체계 단일화

### 3.1 현재 환경변수 목록

| 변수명 | 용도 | 사용 위치 | 문제점 |
|--------|------|-----------|--------|
| `AI_API_KEY` | AI 서버 인증 | GitHub Secrets | 일부만 사용 |
| `OPENCODE_API_KEY` | OpenCode 인증 | backend, n8n | 중복 |
| `OPENAI_API_KEY` | OpenAI 직접 호출 | n8n AI nodes | 혼란 유발 |
| `AIDOVE_API_KEY` | n8n webhook 인증 | backend | 별도 관리 |

### 3.2 단일화된 환경변수 체계

```bash
# =============================================================================
# AI Service Configuration (Unified)
# =============================================================================

# Primary: Single AI Gateway URL
AI_GATEWAY_URL=http://ai-gateway:7000

# Single API Key for all internal AI calls
AI_API_KEY=sk-blog-internal-xxxxx

# OpenAI SDK Compatible (uses AI_GATEWAY_URL internally)
OPENAI_API_BASE_URL=${AI_GATEWAY_URL}/v1
OPENAI_API_KEY=${AI_API_KEY}

# Default Model Configuration
AI_DEFAULT_MODEL=gpt-4.1
AI_DEFAULT_PROVIDER=github-copilot

# =============================================================================
# External Provider Keys (for n8n direct integrations only)
# =============================================================================
EXTERNAL_OPENAI_API_KEY=sk-...      # Real OpenAI API (optional)
EXTERNAL_ANTHROPIC_API_KEY=sk-...   # Real Anthropic API (optional)
EXTERNAL_GOOGLE_API_KEY=...         # Real Google API (optional)
```

### 3.3 인증 흐름 표준화

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          인증 체계 단일화                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────┐                                                          │
│  │ blog-api      │──► Authorization: Bearer ${AI_API_KEY}                  │
│  └───────────────┘              │                                           │
│                                 ▼                                           │
│                    ┌────────────────────────┐                               │
│                    │     AI Gateway         │                               │
│                    │  (Nginx + auth check)  │                               │
│                    │                        │                               │
│                    │  X-API-KEY validation  │                               │
│                    └────────────────────────┘                               │
│                                 │                                           │
│                                 ▼                                           │
│                    ┌────────────────────────┐                               │
│                    │   ai-server-backend    │                               │
│                    │   (API Key 검증)        │                               │
│                    └────────────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Gateway 레벨 인증 (선택적)

**`nginx-ai-gateway.conf` 추가:**

```nginx
# API Key validation at gateway level
map $http_authorization $auth_valid {
    default 0;
    "~*Bearer\s+${AI_API_KEY}" 1;
}

map $http_x_api_key $api_key_valid {
    default 0;
    "${AI_API_KEY}" 1;
}

server {
    # ... existing config ...

    # Optional: Gateway-level auth validation
    # Uncomment to enforce at gateway
    # if ($auth_valid = 0) {
    #     if ($api_key_valid = 0) {
    #         return 401 '{"error":"Unauthorized"}';
    #     }
    # }
}
```

---

## 4. Redis 이벤트 브로커 확장

### 4.1 현재 Redis 사용 현황

| 용도 | 구현 상태 | 위치 |
|------|-----------|------|
| n8n Queue (Bull) | ✅ 활성화 | n8n, n8n-worker |
| Rate Limiting | ❌ 미구현 | - |
| Session Cache | ❌ 미구현 | - |
| Event Broker | ❌ 미구현 | - |

### 4.2 목표: 이벤트 기반 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    이벤트 기반 아키텍처 (Redis Pub/Sub + Streams)             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────┐                                                          │
│  │   blog-api    │──► PUBLISH ai:request:chat                              │
│  │               │◄── SUBSCRIBE ai:response:{requestId}                    │
│  └───────────────┘                                                          │
│                                                                             │
│                    ┌────────────────────────┐                               │
│                    │         Redis          │                               │
│                    │  ┌──────────────────┐  │                               │
│                    │  │   Pub/Sub        │  │                               │
│                    │  │   ai:request:*   │  │                               │
│                    │  │   ai:response:*  │  │                               │
│                    │  └──────────────────┘  │                               │
│                    │  ┌──────────────────┐  │                               │
│                    │  │   Streams        │  │                               │
│                    │  │   ai:tasks       │  │                               │
│                    │  │   ai:results     │  │                               │
│                    │  └──────────────────┘  │                               │
│                    └────────────────────────┘                               │
│                                 │                                           │
│                    ┌────────────┴────────────┐                              │
│                    ▼                         ▼                              │
│        ┌─────────────────┐       ┌─────────────────┐                       │
│        │ AI Worker #1    │       │ AI Worker #2    │                       │
│        │ (ai-backend)    │       │ (ai-backend)    │                       │
│        └─────────────────┘       └─────────────────┘                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 구현 계획

#### Phase 1: Redis Client 통합 (blog-api)

**`backend/src/lib/redis-client.js` (신규)**

```javascript
/**
 * Redis Client for Blog Backend
 * 
 * Provides:
 *   - Connection pooling
 *   - Pub/Sub messaging
 *   - Stream-based task queue
 */

import { createClient } from 'redis';

let client = null;
let subscriber = null;

export async function getRedisClient() {
  if (!client) {
    client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD,
    });
    await client.connect();
  }
  return client;
}

export async function getRedisSubscriber() {
  if (!subscriber) {
    subscriber = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD,
    });
    await subscriber.connect();
  }
  return subscriber;
}
```

#### Phase 2: AI Task Queue 구현

**`backend/src/lib/ai-task-queue.js` (신규)**

```javascript
/**
 * AI Task Queue using Redis Streams
 * 
 * Decouples AI requests from direct HTTP calls.
 * Enables:
 *   - Async processing
 *   - Retry logic
 *   - Load balancing across workers
 */

import { getRedisClient } from './redis-client.js';

const STREAM_NAME = 'ai:tasks';
const CONSUMER_GROUP = 'ai-workers';

export async function enqueueAITask(task) {
  const client = await getRedisClient();
  const taskId = `task:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
  
  await client.xAdd(STREAM_NAME, '*', {
    id: taskId,
    type: task.type, // 'chat', 'generate', 'vision', etc.
    payload: JSON.stringify(task.payload),
    timestamp: Date.now().toString(),
  });
  
  return taskId;
}

export async function waitForResult(taskId, timeout = 120000) {
  const client = await getRedisClient();
  const resultKey = `ai:result:${taskId}`;
  
  // Poll for result with timeout
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await client.get(resultKey);
    if (result) {
      await client.del(resultKey);
      return JSON.parse(result);
    }
    await new Promise(r => setTimeout(r, 100));
  }
  
  throw new Error(`AI task timeout: ${taskId}`);
}
```

#### Phase 3: AI Worker Service (선택적)

```yaml
# docker-compose.blog-workflow.yml 에 추가 (선택적)
ai-worker:
  image: ghcr.io/${GITHUB_REPOSITORY_OWNER:-choisimo}/ai-worker:latest
  restart: unless-stopped
  environment:
    - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
    - AI_GATEWAY_URL=http://ai-gateway:7000
    - AI_API_KEY=${AI_API_KEY}
  depends_on:
    - redis
    - ai-gateway
  deploy:
    replicas: 2
  networks:
    - blog-network
```

### 4.4 Hybrid 모드 (권장)

초기에는 **Hybrid 모드**로 운영하여 점진적 마이그레이션:

```javascript
// backend/src/lib/ai-service.js 수정
export class AIService {
  constructor() {
    // Feature flag for async mode
    this._useAsyncQueue = process.env.AI_ASYNC_MODE === 'true';
  }

  async chat(messages, options = {}) {
    if (this._useAsyncQueue && !options.sync) {
      // Async: Use Redis queue
      const taskId = await enqueueAITask({
        type: 'chat',
        payload: { messages, options },
      });
      return waitForResult(taskId, options.timeout);
    }
    
    // Sync: Direct HTTP call (current behavior)
    return this._directChat(messages, options);
  }
}
```

---

## 5. 구현 로드맵

### Phase 1: Internal Gateway (Week 1)

| 작업 | 우선순위 | 예상 시간 |
|------|----------|-----------|
| `nginx-ai-gateway.conf` 작성 | 🔴 High | 2h |
| `docker-compose.yml` 수정 | 🔴 High | 1h |
| 환경변수 마이그레이션 | 🔴 High | 2h |
| 코드 내 URL 참조 업데이트 | 🟡 Medium | 3h |
| n8n workflow JSON 업데이트 | 🟡 Medium | 2h |
| 테스트 및 검증 | 🔴 High | 2h |

**결과물:**
- [ ] `backend/nginx-ai-gateway.conf`
- [ ] `docker-compose.blog-workflow.yml` 수정
- [ ] `.env.example` 업데이트
- [ ] 코드 내 URL 참조 업데이트

### Phase 2: 환경변수 단일화 (Week 2)

| 작업 | 우선순위 | 예상 시간 |
|------|----------|-----------|
| 환경변수 스키마 정의 | 🔴 High | 1h |
| config.js 업데이트 | 🔴 High | 2h |
| GitHub Secrets 정리 | 🟡 Medium | 1h |
| 문서 업데이트 | 🟡 Medium | 2h |

**결과물:**
- [ ] `backend/src/config.js` 업데이트
- [ ] `.env.example` 단일화
- [ ] GitHub Secrets 정리

### Phase 3: Redis 이벤트 브로커 (Week 3-4)

| 작업 | 우선순위 | 예상 시간 |
|------|----------|-----------|
| Redis client 모듈 구현 | 🟡 Medium | 3h |
| AI Task Queue 구현 | 🟡 Medium | 4h |
| Hybrid 모드 테스트 | 🟡 Medium | 2h |
| AI Worker 서비스 (선택) | 🟢 Low | 6h |

**결과물:**
- [ ] `backend/src/lib/redis-client.js`
- [ ] `backend/src/lib/ai-task-queue.js`
- [ ] Feature flag 기반 Hybrid 모드

---

## 6. 마이그레이션 체크리스트

### Pre-Migration

- [ ] 현재 docker-compose 백업
- [ ] 현재 환경변수 문서화
- [ ] 롤백 계획 수립

### During Migration

- [ ] Internal Gateway 배포 및 테스트
- [ ] 환경변수 점진적 전환
- [ ] 서비스별 동작 확인

### Post-Migration

- [ ] 모니터링 대시보드 업데이트
- [ ] 문서 업데이트
- [ ] 팀 공유 및 교육

---

## 7. 참고 자료

- [Nginx Reverse Proxy Configuration](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Redis Streams Documentation](https://redis.io/docs/data-types/streams/)
- [Bull Queue (n8n uses)](https://github.com/OptimalBits/bull)
- [OpenAI API Compatibility](https://platform.openai.com/docs/api-reference)
