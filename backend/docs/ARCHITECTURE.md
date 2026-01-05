# System Architecture

## 전체 시스템 구성

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    Docker Network                                        │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            Blog Backend (5080)                                      │ │
│  │                                                                                     │ │
│  │   ┌─────────────────────────────────────────────────────────────────────────────┐  │ │
│  │   │                           Application Layer                                  │  │ │
│  │   │                                                                              │  │ │
│  │   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │ │
│  │   │   │  REST API    │  │  AI Routes   │  │ Agent Routes │  │  RAG Routes  │   │  │ │
│  │   │   │  /api/v1/*   │  │  /api/v1/ai  │  │ /api/v1/agent│  │  /api/v1/rag │   │  │ │
│  │   │   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │  │ │
│  │   └─────────────────────────────────────────────────────────────────────────────┘  │ │
│  │                                          │                                          │ │
│  │   ┌─────────────────────────────────────────────────────────────────────────────┐  │ │
│  │   │                           Service Layer                                      │  │ │
│  │   │                                                                              │  │ │
│  │   │   ┌──────────────────────────────────────────────────────────────────────┐  │  │ │
│  │   │   │                      Agent Coordinator                                │  │  │ │
│  │   │   │   - Multi-turn conversation                                          │  │  │ │
│  │   │   │   - Tool orchestration (tool_call parsing)                           │  │  │ │
│  │   │   │   - Session/Memory management                                        │  │  │ │
│  │   │   │   - SSE streaming                                                    │  │  │ │
│  │   │   └──────────────────────────────────────────────────────────────────────┘  │  │ │
│  │   │                                          │                                   │  │ │
│  │   │   ┌────────────────────┐  ┌──────────────┴───────────────────────────────┐  │  │ │
│  │   │   │   N8NClient        │  │              Tool Registry                    │  │  │ │
│  │   │   │   (Hybrid Mode)    │  │                                               │  │  │ │
│  │   │   │                    │  │   ┌─────────────┐  ┌─────────────┐           │  │  │ │
│  │   │   │   LLM: OpenCode    │  │   │ rag_search  │  │ web_search  │           │  │  │ │
│  │   │   │   Vision: n8n      │  │   └─────────────┘  └─────────────┘           │  │  │ │
│  │   │   │   Task: n8n        │  │   ┌─────────────┐  ┌─────────────┐           │  │  │ │
│  │   │   │   Translate: n8n   │  │   │ blog_ops    │  │code_execution│          │  │  │ │
│  │   │   │                    │  │   └─────────────┘  └─────────────┘           │  │  │ │
│  │   │   └────────────────────┘  │   ┌─────────────┐                            │  │  │ │
│  │   │                           │   │ mcp_tools   │                            │  │  │ │
│  │   │                           │   └─────────────┘                            │  │  │ │
│  │   │                           └──────────────────────────────────────────────┘  │  │ │
│  │   └─────────────────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                          │                                               │
│          ┌───────────────────────────────┼───────────────────────────────┐              │
│          │                               │                               │              │
│          ▼                               ▼                               ▼              │
│  ┌───────────────────┐       ┌───────────────────┐           ┌───────────────────┐     │
│  │  n8n (5678)       │       │ OpenCode Backend  │           │   ChromaDB        │     │
│  │                   │       │ (7016)            │           │   (8000)          │     │
│  │  AI Gateway       │       │                   │           │                   │     │
│  │  Webhooks:        │       │  ┌─────────────┐  │           │  Vector Store     │     │
│  │  /webhook/ai/*    │       │  │ OpenCode    │  │           │  for RAG          │     │
│  │                   │       │  │ Serve (7012)│  │           │                   │     │
│  └─────────┬─────────┘       │  └──────┬──────┘  │           └───────────────────┘     │
│            │                 │         │         │                                      │
│            │                 │         ▼         │           ┌───────────────────┐     │
│            │                 │   LLM Providers   │           │  TEI Server       │     │
│            │                 │  (OpenAI, etc.)   │           │  (80)             │     │
│            │                 │                   │           │  Embeddings       │     │
│            └────────────────▶│                   │           └───────────────────┘     │
│              (AI calls)      └───────────────────┘                                      │
│                                                              ┌───────────────────┐     │
│                                                              │ Terminal Server   │     │
│                                                              │ (8080)            │     │
│                                                              │ Code Execution    │     │
│                                                              └───────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## 컴포넌트별 역할

### 1. Blog Backend (Port 5080)

메인 API 서버. 모든 클라이언트 요청의 진입점.

**주요 모듈:**

| 모듈 | 위치 | 역할 |
|------|------|------|
| N8NClient | `src/lib/n8n-client.js` | n8n 웹훅 호출, 하이브리드 LLM 라우팅 |
| OpenCodeClient | `src/lib/opencode-client.js` | OpenCode Backend 직접 호출 |
| AgentCoordinator | `src/lib/agent/coordinator.js` | 도구 오케스트레이션, 세션 관리 |
| ToolRegistry | `src/lib/agent/tools/index.js` | 로컬 도구 등록/실행 |
| AidoveProxy | `src/lib/aidove-proxy.js` | OpenAI 호환 프록시 |

### 2. n8n (Port 5678)

AI 게이트웨이 역할의 워크플로우 자동화 플랫폼.

**웹훅 엔드포인트:**

| 엔드포인트 | 워크플로우 파일 | 용도 |
|-----------|----------------|------|
| `/webhook/ai/chat` | `ai-chat.json` | 멀티턴 대화 |
| `/webhook/ai/generate` | `ai-generate.json` | 단일 텍스트 생성 |
| `/webhook/ai/vision` | `ai-vision.json` | 이미지 분석 |
| `/webhook/ai/translate` | `ai-translate.json` | 번역 |
| `/webhook/ai/task` | `ai-task.json` | 구조화된 태스크 |
| `/webhook/ai/embeddings` | `ai-embeddings.json` | 벡터 임베딩 |
| `/webhook/ai/health` | `ai-health.json` | 헬스체크 |

### 3. OpenCode Backend (Port 7016)

LLM 호출을 위한 SDK 기반 서버.

**내부 구조:**
- OpenCode Serve (7012): 핵심 LLM 엔진
- Node.js API (7016): SDK 래퍼

### 4. ChromaDB (Port 8000)

RAG 파이프라인용 벡터 데이터베이스.

### 5. TEI Server (Port 80)

텍스트 임베딩 생성 서버 (HuggingFace Text Embeddings Inference).

### 6. Terminal Server (Port 8080)

코드 실행 샌드박스.

---

## 데이터 흐름

### 1. LLM 호출 (Chat/Generate)

```
Client
  │
  ▼
Blog Backend (N8NClient.chat())
  │
  ├─[1] Try OpenCode Backend ──────────────▶ OpenCode Backend
  │         (USE_OPENCODE_FOR_LLM=true)              │
  │                                                   ▼
  │                                            OpenCode Serve
  │                                                   │
  │                                                   ▼
  │                                            LLM Provider
  │
  └─[2] Fallback to n8n ───────────────────▶ n8n /webhook/ai/chat
          (on error)                                 │
                                                     ▼
                                              OpenCode Backend
                                                     │
                                                     ▼
                                               LLM Provider
```

**코드 위치:** `src/lib/n8n-client.js:326-366`

### 2. Vision 분석

```
Client (with R2 Image URL)
  │
  ▼
Blog Backend (N8NClient.vision())
  │
  ▼
n8n /webhook/ai/vision ──────────────────▶ OpenCode Backend
  │                                              │
  │                                              ▼
  │                                        GPT-4o / Claude
  │
  ◀───────────────────────────────────────── Response
```

**코드 위치:** `src/lib/n8n-client.js:438-471`

### 3. Agent Tool 실행

```
Client (message)
  │
  ▼
Blog Backend (/api/v1/agent/run)
  │
  ▼
AgentCoordinator.run()
  │
  ├─[1] LLM Call (with tool definitions)
  │       │
  │       ▼
  │     Response with ```tool_call blocks
  │
  ├─[2] Parse tool calls
  │
  ├─[3] Execute tools (LOCAL - no n8n)
  │       │
  │       ├── rag_search ──────▶ ChromaDB + TEI
  │       ├── web_search ──────▶ DuckDuckGo/Brave/Serper
  │       ├── blog_ops ────────▶ Internal API
  │       ├── code_execution ──▶ Terminal Server
  │       └── mcp_tools ───────▶ MCP Servers (stdio)
  │
  ├─[4] Inject results into context
  │
  └─[5] Continue LLM conversation
```

**코드 위치:** `src/lib/agent/coordinator.js`

### 4. RAG 검색

```
Client (query)
  │
  ▼
Blog Backend (/api/v1/rag/search)
  │
  ▼
RAG Search Tool
  │
  ├─[1] Generate embedding ────────────────▶ TEI Server
  │
  ├─[2] Vector search ─────────────────────▶ ChromaDB
  │
  └─[3] Return ranked results
```

**코드 위치:** `src/lib/agent/tools/rag-search.js`

---

## 응답 스키마

### n8n 웹훅 응답 (현재 상태)

**주의:** 현재 응답 필드가 표준화되어 있지 않음.

| 엔드포인트 | 성공 응답 필드 |
|-----------|---------------|
| chat | `content` |
| vision | `description`, `text`, `content` (중복) |
| translate | `title`, `description`, `content` |
| task | `{ ok, data, mode, source }` |

### 클라이언트 측 흡수 패턴

```javascript
// n8n-client.js - 다중 필드 fallback
chat():     result.content || result.text || result.response || ''
vision():   result.description || result.text || result.content || result.analysis || ''
generate(): result.text || result.content || result.response || ''
```

---

## 타임아웃 설정

| 계층 | 기본 | 긴 작업 | 비고 |
|------|------|---------|------|
| n8n-client.js | 120s | 300s | vision/translate |
| opencode-client.js | 120s | 300s | |
| aidove-proxy.js | 120s | - | |
| ai-chat.json | 120s | - | |
| ai-vision.json | - | 300s | |
| ai-translate.json | - | 300s | |
| ai-task.json | 180s | - | **불일치** |

---

## Circuit Breaker

n8n 및 OpenCode 클라이언트 모두 Circuit Breaker 패턴 적용:

```javascript
CIRCUIT_BREAKER_THRESHOLD = 5;      // 5회 연속 실패 시 오픈
CIRCUIT_BREAKER_RESET_TIME = 60000; // 60초 후 리셋
```

**코드 위치:** `src/lib/n8n-client.js:111-112`

---

## 환경 설정

### 필수 환경 변수

```bash
# 서버
PORT=5080
HOST=0.0.0.0

# n8n
N8N_BASE_URL=http://n8n:5678
N8N_API_KEY=

# OpenCode
OPENCODE_BASE_URL=http://opencode-backend:7016
USE_OPENCODE_FOR_LLM=true

# RAG
CHROMA_URL=http://chromadb:8000
TEI_URL=http://embedding-server:80

# Terminal
TERMINAL_SERVER_URL=http://terminal-server:8080
```

### 하이브리드 모드 제어

```bash
# OpenCode 우선 (기본값)
USE_OPENCODE_FOR_LLM=true

# n8n만 사용 (레거시)
USE_OPENCODE_FOR_LLM=false
```
