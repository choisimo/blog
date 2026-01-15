# AI Server Setup Guide

AI 서버를 분리 운영하고 OpenAI SDK 호환 방식으로 연결하는 방법을 설명합니다.

## 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [AI 서버 배포](#2-ai-서버-배포)
3. [GitHub Secrets 설정](#3-github-secrets-설정)
4. [Backend 연결 설정](#4-backend-연결-설정)
5. [n8n Workflow 설정](#5-n8n-workflow-설정)
6. [API 사용 예시](#6-api-사용-예시)

---

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AI Server (docker-compose.ai.yaml)              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │   noaicode      │    │    backend      │    │     redis       │     │
│  │  (ai-serve)     │◄───│ (OpenAI Compat) │◄───│ (rate limiting) │     │
│  │    :7012        │    │    :7016        │    │    :6379        │     │
│  └─────────────────┘    └────────┬────────┘    └─────────────────┘     │
│                                  │                                      │
│                    OpenAI SDK Compatible API                            │
│                    /v1/chat/completions                                 │
│                    /v1/models                                           │
│                    /v1/embeddings                                       │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Blog Backend  │    │      n8n        │    │   Other Apps    │
│  (OpenAI SDK)   │    │   (HTTP Node)   │    │  (OpenAI SDK)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 핵심 변경사항

- **REST API → OpenAI SDK**: 기존 `/chat` 엔드포인트 대신 `/v1/chat/completions` 사용
- **API Key 인증**: GitHub Secrets에서 관리하는 `AI_API_KEY` 사용
- **분리 배포**: AI 서버는 `docker-compose.ai.yaml`로 독립 운영

---

## 2. AI 서버 배포

### 2.1 기본 배포 (serve + backend + redis)

```bash
cd /path/to/ai-server
docker compose -f docker-compose.ai.yaml up -d
```

### 2.2 환경변수 설정 (.env)

```bash
# .env 파일 생성
cat > .env << 'EOF'
# GHCR 이미지 설정
GITHUB_REPOSITORY_OWNER=choisimo

# 포트 설정
NOAICODE_PORT=7015
BACKEND_PORT=7016

# 기본 모델 설정
DEFAULT_PROVIDER=github-copilot
DEFAULT_MODEL=gpt-4.1

# API Key 인증 (GitHub Secrets에서 주입)
AUTH_ENABLED=true
AI_API_KEY=sk-your-api-key-here

# Rate Limiting
DEFAULT_RPM=60
DEFAULT_TPM=100000
EOF
```

### 2.3 배포 프로필

| 프로필       | 명령어                                                 | 설명                    |
| ------------ | ------------------------------------------------------ | ----------------------- |
| 기본         | `docker compose up -d`                                 | serve + backend + redis |
| serve만      | `docker compose up -d noaicode`                        | LLM 서버만              |
| backend-only | `docker compose --profile backend-only up -d`          | 원격 serve 연결         |
| auth         | `docker compose --profile auth up -d`                  | nginx 인증 포함         |
| tunnel       | `docker compose --profile auth --profile tunnel up -d` | Cloudflare Tunnel       |

---

## 3. GitHub Secrets 설정

### 3.1 필수 Secrets

GitHub Repository → Settings → Secrets and variables → Actions에서 설정:

| Secret Name     | 설명               | 예시                     |
| --------------- | ------------------ | ------------------------ |
| `AI_API_KEY`    | AI 서버 인증 키    | `sk-noaicode-prod-xxxxx` |
| `AI_SERVER_URL` | AI 서버 URL (선택) | `https://ai.nodove.com`  |

### 3.2 GitHub Actions에서 .env 생성

```yaml
# .github/workflows/deploy-ai-server.yml
jobs:
  deploy:
    steps:
      - name: Create .env file
        run: |
          cat > .env << EOF
          AI_API_KEY=${{ secrets.AI_API_KEY }}
          AI_SERVER_URL=${{ secrets.AI_SERVER_URL }}
          AUTH_ENABLED=true
          DEFAULT_MODEL=gpt-4.1
          EOF

      - name: Deploy AI Server
        run: |
          scp .env ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }}:/opt/ai-server/
          ssh ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} \
            "cd /opt/ai-server && docker compose -f docker-compose.ai.yaml pull && docker compose -f docker-compose.ai.yaml up -d"
```

### 3.3 API Key 생성 방법

```bash
# 랜덤 API Key 생성
openssl rand -hex 32 | sed 's/^/sk-noaicode-/'
# 출력 예: sk-noaicode-a1b2c3d4e5f6...

# 또는 UUID 기반
echo "sk-noaicode-$(uuidgen | tr -d '-')"
```

---

## 4. Backend 연결 설정

### 4.1 환경변수

Blog Backend의 `.env` 또는 docker-compose 환경변수:

```bash
# OpenAI SDK 호환 설정
OPENAI_API_BASE_URL=http://ai-server-backend:7016/v1
OPENAI_API_KEY=sk-noaicode-your-key
OPENAI_DEFAULT_MODEL=gpt-4.1

# 레거시 호환 (fallback)
OPENCODE_BASE_URL=http://ai-server-backend:7016
OPENCODE_API_KEY=sk-noaicode-your-key
```

### 4.2 코드에서 사용

```javascript
// OpenAI SDK 사용 (권장)
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL:
    process.env.OPENAI_API_BASE_URL || "http://ai-server-backend:7016/v1",
  apiKey: process.env.OPENAI_API_KEY || "sk-noaicode",
});

const response = await openai.chat.completions.create({
  model: "gpt-4.1",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.choices[0].message.content);
```

```javascript
// AIService 사용 (내부 추상화)
import { aiService } from "./lib/ai-service.js";

const result = await aiService.chat([{ role: "user", content: "Hello!" }]);

console.log(result.content);
```

---

## 5. n8n Workflow 설정

### 5.1 필수 환경변수 (n8n 서비스)

```yaml
# docker-compose.blog-workflow.yml의 n8n 서비스
environment:
  # OpenAI SDK 호환 설정
  - OPENAI_API_BASE_URL=http://ai-server-backend:7016
  - AI_API_KEY=${AI_API_KEY}
  - OPENAI_DEFAULT_MODEL=gpt-4.1

  # 레거시 호환
  - OPENCODE_BASE_URL=http://ai-server-backend:7016
  - OPENCODE_API_KEY=${AI_API_KEY}

  # 환경변수 접근 허용 (필수!)
  - N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

### 5.2 HTTP Request 노드 설정

n8n에서 AI 호출 시 HTTP Request 노드 설정:

**URL:**

```
={{ ($env.OPENAI_API_BASE_URL || 'http://ai-server-backend:7016') + '/v1/chat/completions' }}
```

**Headers:**

```
Authorization: Bearer {{ $env.AI_API_KEY || $env.OPENAI_API_KEY || 'sk-noaicode' }}
Content-Type: application/json
```

**Body (JSON):**

```json
{
  "model": "gpt-4.1",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "{{ $json.prompt }}" }
  ],
  "temperature": 0.7
}
```

### 5.3 OpenAI 응답 파싱

```javascript
// 응답에서 content 추출
$json.body.choices[0].message.content;

// 또는 안전한 접근
$json.body?.choices?.[0]?.message?.content || "";
```

---

## 6. API 사용 예시

### 6.1 Chat Completions

```bash
curl -X POST http://localhost:7016/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-noaicode-your-key" \
  -d '{
    "model": "gpt-4.1",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "temperature": 0.7
  }'
```

**응답:**

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-4.1",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 10,
    "total_tokens": 30
  }
}
```

### 6.2 List Models

```bash
curl http://localhost:7016/v1/models \
  -H "Authorization: Bearer sk-noaicode-your-key"
```

### 6.3 Health Check

```bash
curl http://localhost:7016/health
```

---

## 7. 트러블슈팅

### 7.1 일반적인 문제

| 문제               | 원인           | 해결                                       |
| ------------------ | -------------- | ------------------------------------------ |
| 401 Unauthorized   | API Key 불일치 | `.env`의 `AI_API_KEY` 확인                 |
| Connection refused | AI 서버 미실행 | `docker compose up -d` 실행                |
| Empty response     | 모델 응답 실패 | 로그 확인: `docker logs ai-server-backend` |
| Timeout            | LLM 응답 지연  | timeout 값 증가 (기본 120s)                |

### 7.2 로그 확인

```bash
# AI 서버 로그
docker logs -f ai-server-backend
docker logs -f ai-server-serve

# n8n 로그
docker logs -f blog-n8n
```

### 7.3 연결 테스트

```bash
# AI 서버 헬스체크
curl http://localhost:7016/health

# 간단한 채팅 테스트
curl -X POST http://localhost:7016/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AI_API_KEY" \
  -d '{"model":"gpt-4.1","messages":[{"role":"user","content":"ping"}]}'
```

---

## 8. 참고 자료

- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [n8n HTTP Request Node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)
- [Docker Compose 환경변수](https://docs.docker.com/compose/environment-variables/)
