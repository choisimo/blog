# n8n + Buffer Zone API 워크플로우 설정 가이드

이 문서는 n8n에서 Buffer Zone API를 사용하는 워크플로우를 설정하는 방법을 설명합니다.

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                        n8n Workflows                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Basic Chat  │  │  RAG Chat   │  │ Workflow Profile Chat   │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
│         │                │                      │                │
│         └────────────────┼──────────────────────┘                │
│                          │                                       │
│                          ▼                                       │
│              ┌───────────────────────┐                          │
│              │   Buffer Zone API     │                          │
│              │   (ai-admin:7080)     │                          │
│              └───────────┬───────────┘                          │
│                          │                                       │
│         ┌────────────────┼────────────────┐                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  LiteLLM    │  │   Qdrant    │  │  ChromaDB   │             │
│  │  (LLM GW)   │  │ (Vector DB) │  │ (Vector DB) │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

## 1. 크레덴셜 설정

### 1.1 자동 설정 (권장)

**배포 시 자동으로 설정됩니다!** GitHub Actions를 통해 배포하면:

1. Blog API에서 JWT 토큰 자동 생성
2. n8n Credentials 자동 등록/업데이트
3. Cloudflare Workers secrets 자동 설정

```
GitHub Push → Build → Deploy → Setup Credentials (자동)
                                    ├── JWT 토큰 생성
                                    ├── n8n Credentials 설정
                                    └── Workers Secrets 설정
```

#### 토큰 로테이션

토큰은 **매주 일요일 03:00 UTC**에 자동 로테이션됩니다.
수동 로테이션: **Actions > Rotate API Tokens > Run workflow**

### 1.2 수동 설정 (로컬 개발용)

n8n에서 **Settings > Credentials > Add Credential**로 이동하여 `HTTP Header Auth`를 추가합니다.

| 필드 | 값 |
|------|-----|
| **Name** | `Blog API Auth` 또는 `Buffer Zone API Auth` |
| **Header Name** | `Authorization` |
| **Header Value** | `Bearer {YOUR_JWT_TOKEN}` |

> JWT 토큰 발급: `POST /api/v1/auth/login`

```bash
# 로컬에서 토큰 발급
curl -X POST http://localhost:5080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "YOUR_PASSWORD"}'
```

또는 자동화 스크립트 사용:

```bash
# 전체 자동 설정
export ADMIN_USERNAME=admin ADMIN_PASSWORD=secret
export N8N_USER=admin N8N_PASS=secret
./backend/scripts/setup-api-credentials.sh --all

# 토큰만 생성
./backend/scripts/setup-api-credentials.sh --generate-token

# n8n Credentials만 설정
./backend/scripts/setup-api-credentials.sh --setup-n8n
```

### 1.2 환경 변수 설정

n8n 컨테이너에 다음 환경 변수를 추가합니다:

```yaml
# docker-compose.blog-workflow.yml
services:
  n8n:
    environment:
      # Buffer Zone API
      - BUFFER_ZONE_URL=http://ai-admin:7080
      # Vector DB
      - QDRANT_URL=http://qdrant:6333
      - CHROMA_URL=http://chromadb:8000
      # Blog API
      - BLOG_API_URL=http://api:5080
```

## 2. 워크플로우 임포트

### 2.1 워크플로우 파일 위치

```
backend/n8n-workflows/
├── buffer-zone-chat.json           # 기본 채팅
├── buffer-zone-rag-chat.json       # RAG 채팅  
├── buffer-zone-workflow-chat.json  # 워크플로우 프로필 채팅
├── buffer-zone-events.json         # 이벤트 수신
├── aidove-basic-chatbot.json       # Aidove 기본 (레거시)
└── aidove-rag-pipeline.json        # Aidove RAG (레거시)
```

### 2.2 n8n UI에서 임포트

1. n8n UI 접속 (https://blog-bw.nodove.com)
2. **Workflows > Import from File** 클릭
3. 원하는 JSON 파일 선택
4. 크레덴셜 연결 확인
5. **Activate** 토글 활성화

### 2.3 CLI로 일괄 임포트

```bash
# n8n CLI 사용
docker exec -it blog-n8n n8n import:workflow --input=/workflows/buffer-zone-chat.json
docker exec -it blog-n8n n8n import:workflow --input=/workflows/buffer-zone-rag-chat.json
docker exec -it blog-n8n n8n import:workflow --input=/workflows/buffer-zone-workflow-chat.json
docker exec -it blog-n8n n8n import:workflow --input=/workflows/buffer-zone-events.json
```

## 3. 워크플로우 상세

### 3.1 Buffer Zone - Basic Chat

**Webhook URL:** `https://blog-bw.nodove.com/webhook/buffer-chat`

**요청 예시:**
```json
{
  "message": "안녕하세요, 오늘 뭐 도와드릴까요?",
  "modelId": "gpt-4.1",
  "providerId": "github-copilot",
  "context": {
    "locale": "ko-KR",
    "timezone": "Asia/Seoul"
  },
  "metadata": {
    "client": "blog-frontend",
    "userId": "user-123"
  }
}
```

**응답:**
```json
{
  "success": true,
  "sessionId": "sess_abc123",
  "output": "안녕하세요! 무엇을 도와드릴까요?",
  "modelId": "gpt-4.1",
  "providerId": "github-copilot"
}
```

### 3.2 Buffer Zone - RAG Chat

**Webhook URL:** `https://blog-bw.nodove.com/webhook/buffer-rag-chat`

**요청 예시:**
```json
{
  "message": "이 블로그의 아키텍처를 설명해줘",
  "ragProfile": "blog-posts",
  "topK": 5,
  "filters": {
    "category": "tech",
    "language": "ko"
  },
  "modelId": "gpt-4.1"
}
```

**응답:**
```json
{
  "success": true,
  "rag": true,
  "sessionId": "sess_xyz789",
  "output": "이 블로그는 React 프론트엔드와 Node.js 백엔드로 구성되어 있습니다...",
  "sources": ["architecture-overview", "tech-stack-2024"],
  "retrievedChunks": [
    {
      "id": "chunk_1",
      "text": "프론트엔드는 React 18과 TypeScript로...",
      "score": 0.92,
      "metadata": { "source": "architecture-overview" }
    }
  ]
}
```

### 3.3 Buffer Zone - Workflow Profile Chat

**Webhook URL:** `https://blog-bw.nodove.com/webhook/buffer-workflow/{profile}`

**지원 프로필:**
- `blog-summary` - 블로그 포스트 요약
- `code-review` - 코드 리뷰
- `translate` - 다국어 번역
- `order-approval` - 주문 승인 (예시)

**요청 예시 (code-review):**
```json
{
  "message": "이 코드 리뷰해줘",
  "variables": {
    "code": "function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }",
    "language": "javascript",
    "context": "e-commerce checkout"
  },
  "eventSinkId": "n8n-main"
}
```

**응답:**
```json
{
  "success": true,
  "sessionId": "sess_review123",
  "output": "코드 리뷰 결과:\n1. 함수명이 명확합니다...",
  "workflowProfile": "code-review",
  "workflowResult": {
    "issues": [],
    "suggestions": ["타입 안전성을 위해 TypeScript 사용 권장"],
    "rating": "good"
  }
}
```

### 3.4 Buffer Zone - Event Receiver

**Webhook URL:** `https://blog-bw.nodove.com/webhook/buffer-events/{sinkId}`

Buffer Zone에서 발생한 이벤트를 수신하여 후속 처리를 수행합니다.

**이벤트 타입:**
- `workflow.completed` - 워크플로우 성공 완료
- `workflow.failed` - 워크플로우 실패
- `chat.completed` - 채팅 완료
- `rag.completed` - RAG 검색 완료

**이벤트 예시:**
```json
{
  "type": "workflow.completed",
  "timestamp": "2025-12-30T04:00:00Z",
  "data": {
    "profile": "code-review",
    "sessionId": "sess_review123",
    "result": {
      "rating": "good",
      "issues": []
    }
  }
}
```

## 4. 커스텀 워크플로우 만들기

### 4.1 Buffer Zone HTTP Request 노드 설정

```json
{
  "parameters": {
    "method": "POST",
    "url": "={{ $env.BUFFER_ZONE_URL }}/buffer/chat",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ message: $json.userInput, modelId: 'gpt-4.1' }) }}",
    "options": {
      "timeout": 120000
    }
  },
  "credentials": {
    "httpHeaderAuth": {
      "id": "buffer-zone-auth",
      "name": "Buffer Zone API Auth"
    }
  }
}
```

### 4.2 에러 핸들링 패턴

```
[HTTP Request] → [IF: statusCode == 200] → [Success Handler]
                           ↓
                    [Error Handler] → [Respond with Error]
```

### 4.3 RAG 프로필 커스터마이징

새로운 RAG 프로필을 추가하려면:

1. Buffer Zone API에 프로필 등록
2. 벡터 DB에 해당 컬렉션 생성
3. n8n 워크플로우에서 `ragProfile` 파라미터 지정

## 5. 모니터링 및 디버깅

### 5.1 실행 로그 확인

```bash
# n8n 컨테이너 로그
docker logs -f blog-n8n

# 특정 워크플로우 실행 기록
# n8n UI > Executions 탭에서 확인
```

### 5.2 Buffer Zone API 헬스체크

```bash
curl http://localhost:7080/health
```

### 5.3 일반적인 문제 해결

| 문제 | 원인 | 해결 |
|------|------|------|
| 401 Unauthorized | JWT 토큰 만료/잘못됨 | `Actions > Rotate API Tokens` 실행 |
| 502 Bad Gateway | Buffer Zone 서비스 다운 | `docker restart blog-ai-admin` |
| Timeout | LLM 응답 지연 | timeout 값 증가 (기본 120s) |
| Empty response | 입력 파라미터 누락 | 요청 JSON 형식 확인 |

## 6. 보안 권장사항

1. **JWT 토큰 관리 (자동화됨)**
   - 배포 시 자동 생성 및 배포
   - 매주 자동 로테이션 (schedule: 매주 일요일)
   - 수동 로테이션: `Actions > Rotate API Tokens`
   - GitHub Secrets로 안전하게 관리

2. **네트워크 격리**
   - Buffer Zone API는 내부 네트워크에서만 접근
   - 외부 노출 필요시 API Gateway 사용

3. **Rate Limiting**
   - n8n 워크플로우에 적절한 rate limit 설정
   - Buffer Zone API 레벨에서도 제한

4. **로깅**
   - 민감한 정보(API 키, 사용자 데이터) 로깅 금지
   - 감사 로그 활성화
   - 토큰 로테이션 로그: `~/blog-stack/logs/token-rotation.log`

## 7. 참고 자료

- [Buffer Zone API OpenAPI 스펙](./openapi-buffer-zone.json)
- [n8n 공식 문서](https://docs.n8n.io/)
- [LiteLLM 설정 가이드](./litellm_config.yaml)
