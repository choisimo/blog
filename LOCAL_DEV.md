# Local Development Setup

Production과 동일한 구조로 **단일 Docker Compose 명령**으로 전체 블로그 시스템을 로컬에서 실행합니다.

## Quick Start

```bash
# 1. 환경변수 설정
cp .env.local.example .env.local
# .env.local 편집: GOOGLE_API_KEY 설정 (필수)

# 2. 전체 서비스 실행
docker compose -f docker-compose.local.yml up --build

# 3. 브라우저에서 확인
open http://localhost:8080
```

## Architecture

Production과 동일한 구조:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Local Development Stack                             │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                   nginx:8080 (Gateway)                            │   │
│  │  /                → frontend:80          (React SPA)              │   │
│  │  /api/*           → backend:5080         (Blog API)               │   │
│  │  /ai/*            → litellm:4000         (LiteLLM Gateway)        │   │
│  │  /workers/*       → workers:8787         (CF Workers Emulation)   │   │
│  │  /terminal/*      → terminal-server:8080 (WebSocket PTY)          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              LiteLLM AI Gateway (port 4000)                      │   │
│  │  - OpenAI-compatible API for ALL providers                       │   │
│  │  - Supports: Gemini, OpenAI, Anthropic, Ollama                   │   │
│  │  - Automatic fallback and load balancing                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Services:                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ frontend │ │ backend  │ │ litellm  │ │ workers  │ │ terminal │      │
│  │   :80    │ │  :5080   │ │  :4000   │ │  :8787   │ │  :8080   │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Access Points

| URL | Description |
|-----|-------------|
| http://localhost:8080 | Main Entry (Blog UI) |
| http://localhost:8080/api/v1/healthz | Backend Health Check |
| http://localhost:8080/ai/health/liveliness | LiteLLM Health Check |
| http://localhost:8080/workers/ | Workers API |

### Direct Access (Debugging)

| URL | Description |
|-----|-------------|
| http://localhost:5080 | Backend API (direct) |
| http://localhost:4000 | LiteLLM Gateway (direct) |
| http://localhost:8787 | Workers API (direct) |
| http://localhost:5173 | Frontend Vite HMR (optional) |

## Services

### 1. Frontend (React + Vite)
- **Location**: `frontend/`
- **Port**: 80 (Nginx served)
- **Features**: Blog UI, AI Chat, Memo, Terminal UI

### 2. Backend API (Node.js)
- **Location**: `backend/`
- **Port**: 5080
- **Features**: Blog API, AI Integration via LiteLLM

### 3. LiteLLM Gateway
- **Image**: `ghcr.io/berriai/litellm:main-latest`
- **Port**: 4000
- **Features**: Unified OpenAI-compatible API for all LLM providers
- **Config**: `litellm_config.local.yaml`

### 4. Workers (Cloudflare Emulation)
- **Location**: `workers/`
- **Port**: 8787
- **Features**: D1 Database, Comments, Analytics, Search
- **Data**: SQLite (persisted in Docker volume)

### 5. Terminal Server
- **Location**: `backend/terminal-server/`
- **Port**: 8080
- **Features**: Web-based terminal with Docker sandbox

## AI Provider Configuration

LiteLLM Gateway를 통해 여러 AI Provider 사용 가능:

### Option 1: Google Gemini (Recommended)
무료 tier 제공, 가장 쉬운 설정

```env
GOOGLE_API_KEY=your-api-key
AI_DEFAULT_MODEL=gemini-1.5-flash
```

Get API key: https://aistudio.google.com/app/apikey

### Option 2: OpenAI
```env
OPENAI_API_KEY=sk-...
AI_DEFAULT_MODEL=gpt-4o-mini
```

### Option 3: Anthropic Claude
```env
ANTHROPIC_API_KEY=sk-ant-...
AI_DEFAULT_MODEL=claude-3.5-sonnet
```

### Option 4: Local LLM (Ollama)
인터넷 연결 없이 로컬에서 실행

```bash
# Host에서 Ollama 실행
ollama serve
ollama pull llama3.2

# .env.local 설정
AI_DEFAULT_MODEL=local/llama3
```

## LiteLLM API 사용법

LiteLLM은 OpenAI-compatible API를 제공합니다:

```bash
# Chat completion
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-local-dev-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-1.5-flash",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# List available models
curl http://localhost:4000/v1/models \
  -H "Authorization: Bearer sk-local-dev-key"
```

## Development Modes

### Mode 1: Full Docker (Recommended)
모든 서비스를 Docker로 실행. Production과 동일한 환경.

```bash
docker compose -f docker-compose.local.yml up --build
```

### Mode 2: Hybrid (Frontend HMR)
Frontend만 Vite dev server로 실행하여 Hot Module Replacement 활성화.

```bash
# Terminal 1: Backend services
docker compose -f docker-compose.local.yml up backend litellm workers terminal-server nginx

# Terminal 2: Frontend with HMR
cd frontend
npm install
VITE_API_BASE_URL=http://localhost:8080/api/v1 npm run dev
```

### Mode 3: Minimal
Workers 없이 핵심 기능만 실행.

```bash
docker compose -f docker-compose.local.yml up frontend backend litellm nginx
```

## Comparison: Local vs Production

| Component | Local | Production |
|-----------|-------|------------|
| Gateway | nginx:8080 | Cloudflare Tunnel → nginx |
| AI Gateway | LiteLLM (Gemini/OpenAI) | LiteLLM (+ GitHub Copilot via VAS) |
| Database | SQLite (D1 emulation) | Cloudflare D1 |
| Storage | Local filesystem | Cloudflare R2 |
| Terminal | Docker-in-Docker | Docker + Gateway Worker |

### Production-only Services (not in local)
- `cloudflared`: Cloudflare Tunnel
- `ai-engine` (vas-core): GitHub Copilot authentication
- `ai-admin`: Token management UI
- `vas-bootstrap`: Auto JWT token generation
- `embedding-server`: TEI for RAG
- `chromadb`: Vector database

## Troubleshooting

### LiteLLM 시작 실패
```bash
# 로그 확인
docker compose -f docker-compose.local.yml logs litellm

# API Key 확인
echo $GOOGLE_API_KEY  # .env.local에 설정되어 있는지
```

### Workers 빌드 실패
```bash
# shared 패키지 먼저 빌드
cd shared && npm install && npm run build
```

### AI 기능 동작 안함
```bash
# LiteLLM 직접 테스트
curl http://localhost:4000/health
curl http://localhost:4000/v1/models -H "Authorization: Bearer sk-local-dev-key"
```

### Terminal 연결 실패
- Docker socket 권한 확인: `/var/run/docker.sock`
- `ORIGIN_SECRET_KEY` 환경변수 설정 확인

## File Structure

```
.
├── docker-compose.local.yml    # 로컬 개발용 Docker Compose
├── litellm_config.local.yaml   # 로컬용 LiteLLM 설정
├── nginx.local.conf            # 로컬 Nginx Gateway 설정
├── .env.local.example          # 환경변수 템플릿
├── LOCAL_DEV.md                # 이 문서
│
├── frontend/                   # React Frontend
├── backend/                    # Node.js Backend
│   ├── litellm_config.yaml     # Production LiteLLM 설정
│   └── terminal-server/        # Terminal WebSocket Server
├── workers/                    # Cloudflare Workers
│   ├── Dockerfile.local        # Workers 로컬 빌드
│   └── migrations/             # D1 Migrations
└── shared/                     # Shared TypeScript Types
```
