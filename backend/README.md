# Blog Backend API Server

블로그의 Node.js 백엔드 API 서버입니다.

## 아키텍처 개요

```
                           ┌─────────────────────────────────────────────────────────┐
                           │                   Blog Backend (5080)                   │
                           ├─────────────────────────────────────────────────────────┤
                           │                                                         │
                           │   ┌───────────────┐      ┌──────────────────────────┐  │
 Client ──────────────────▶│   │  REST API     │      │  Agent Coordinator       │  │
                           │   │  /api/v1/*    │      │  - Tool Orchestration    │  │
                           │   └───────┬───────┘      │  - Session Management    │  │
                           │           │              └────────────┬─────────────┘  │
                           │           │                           │                │
                           │   ┌───────┴───────────────────────────┴───────┐       │
                           │   │                   Clients                  │       │
                           │   ├───────────────┬───────────────────────────┤       │
                           │   │  N8NClient    │   OpenCodeClient          │       │
                           │   │  (Hybrid)     │   (LLM Direct)            │       │
                           │   └───────┬───────┴───────────┬───────────────┘       │
                           │           │                   │                        │
                           └───────────┼───────────────────┼────────────────────────┘
                                       │                   │
          ┌────────────────────────────┼───────────────────┼────────────────────────┐
          │                            │                   │                        │
          ▼                            ▼                   ▼                        ▼
┌──────────────────┐      ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  n8n Workflows   │      │ OpenCode Backend │   │    ChromaDB      │   │  Terminal Server │
│  (5678)          │      │ (7016)           │   │    (8000)        │   │  (8080)          │
│                  │      │                  │   │                  │   │                  │
│  AI Gateway:     │      │  ┌────────────┐  │   │  Vector Store    │   │  Code Execution  │
│  /webhook/ai/*   │      │  │ OpenCode   │  │   │  for RAG         │   │  Sandbox         │
│                  │      │  │ Serve      │  │   │                  │   │                  │
│  - chat          │      │  │ (7012)     │  │   │                  │   │                  │
│  - vision        │      │  └─────┬──────┘  │   │                  │   │                  │
│  - translate     │      │        │         │   │                  │   │                  │
│  - task          │      │        ▼         │   │                  │   │                  │
│  - embeddings    │      │   LLM Providers  │   │                  │   │                  │
└──────────────────┘      └──────────────────┘   └──────────────────┘   └──────────────────┘
```

### 핵심 설계 원칙

1. **하이브리드 LLM 라우팅**: LLM 호출은 OpenCode Backend 우선, n8n은 폴백
2. **n8n은 AI 게이트웨이**: 검색/스크래핑 도구가 아닌 AI 기능 진입점
3. **Agent 도구는 로컬 실행**: RAG, 웹검색, 코드실행 등은 n8n 없이 직접 처리
4. **동기식 통신**: 콜백 없이 요청-응답 패턴 사용

## 빠른 시작

```bash
cd backend
cp .env.example .env
npm ci
npm run dev
# http://localhost:5080/api/v1/healthz
```

## 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | 서버 포트 | `5080` |
| `N8N_BASE_URL` | n8n 내부 URL | `http://n8n:5678` |
| `OPENCODE_BASE_URL` | OpenCode Backend URL | `http://opencode-backend:7016` |
| `USE_OPENCODE_FOR_LLM` | LLM 호출 OpenCode 우선 | `true` |
| `CHROMA_URL` | ChromaDB URL | `http://chromadb:8000` |
| `TEI_URL` | 임베딩 서버 URL | `http://embedding-server:80` |

## 문서 목록

| 문서 | 설명 |
|------|------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 시스템 아키텍처 상세 |
| [N8N-WEBHOOKS.md](docs/N8N-WEBHOOKS.md) | n8n 웹훅 API 명세 |
| [AGENT-TOOLS.md](docs/AGENT-TOOLS.md) | 로컬 Agent 도구 명세 |
| [API-REFERENCE.md](docs/API-REFERENCE.md) | REST API 엔드포인트 |
| [DOCKER.md](docs/DOCKER.md) | Docker 배포 가이드 |
| [KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md) | 알려진 이슈 |

## 주요 엔드포인트

### REST API (`/api/v1/*`)

| 경로 | 설명 |
|------|------|
| `/api/v1/healthz` | 헬스체크 |
| `/api/v1/posts/*` | 게시글 CRUD |
| `/api/v1/images/*` | 이미지 관리 |
| `/api/v1/ai/*` | AI 기능 |
| `/api/v1/agent/*` | Agent 오케스트레이션 |
| `/api/v1/rag/*` | RAG 검색 |

### n8n 웹훅 (`/webhook/ai/*`)

| 엔드포인트 | 용도 |
|-----------|------|
| `/webhook/ai/chat` | 멀티턴 대화 |
| `/webhook/ai/vision` | 이미지 분석 |
| `/webhook/ai/translate` | 번역 |
| `/webhook/ai/task` | 구조화된 태스크 |
| `/webhook/ai/embeddings` | 벡터 임베딩 |

## 기술 스택

- **런타임**: Node.js 20+
- **프레임워크**: Express 4
- **AI 통합**: n8n, OpenCode SDK
- **벡터DB**: ChromaDB
- **임베딩**: TEI (Text Embeddings Inference)
