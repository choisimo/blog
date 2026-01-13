# n8n Workflows 설정 가이드

이 문서는 n8n 워크플로우를 설정하고 관리하는 방법을 설명합니다.

## 목차

1. [AI 워크플로우 (OpenCode)](#1-ai-워크플로우-opencode)
2. [Buffer Zone 워크플로우](#2-buffer-zone-워크플로우)
3. [크레덴셜 설정](#3-크레덴셜-설정)
4. [모니터링 및 디버깅](#4-모니터링-및-디버깅)

---

## 1. AI 워크플로우 (OpenCode)

### 1.1 개요

AI 워크플로우는 OpenCode(ai-server-backend)를 통해 LLM 기능을 제공합니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Workflows (n8n)                          │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌──────┐ ┌──────────┐ │
│  │ Health  │ │   Chat   │ │ Generate  │ │ Task │ │Translate │ │
│  └────┬────┘ └────┬─────┘ └─────┬─────┘ └──┬───┘ └────┬─────┘ │
│       │           │             │           │          │        │
│       └───────────┴─────────────┴───────────┴──────────┘        │
│                              │                                   │
│                              ▼                                   │
│              ┌───────────────────────────┐                      │
│              │   ai-server-backend:7016  │                      │
│              │   (OpenCode Adapter)      │                      │
│              └─────────────┬─────────────┘                      │
│                            │                                     │
│                            ▼                                     │
│              ┌───────────────────────────┐                      │
│              │   ai-server-serve:7012    │                      │
│              │   (LLM Provider)          │                      │
│              └───────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 워크플로우 파일

| 파일 | Webhook 경로 | 설명 |
|------|--------------|------|
| `ai-health.json` | `GET /webhook/ai/health` | 서비스 상태 확인 |
| `ai-chat.json` | `POST /webhook/ai/chat` | 대화형 AI |
| `ai-generate.json` | `POST /webhook/ai/generate` | 텍스트 생성 |
| `ai-translate.json` | `POST /webhook/ai/translate` | 다국어 번역 |
| `ai-task.json` | `POST /webhook/ai/task` | 작업 처리 (sketch/prism/chain/summary) |
| `ai-vision.json` | `POST /webhook/ai/vision` | 이미지 분석 |
| `ai-embeddings.json` | `POST /webhook/ai/embeddings` | 텍스트 임베딩 |

### 1.3 초기 설정 (첫 배포 시)

#### 자동 임포트 스크립트 사용 (권장)

> **주의**: n8n CLI의 `import:workflow` 명령에는 버그가 있어 필수 DB 필드(`activeVersionId`, `workflow_history`, `shared_workflow`, `webhook_entity`)가 누락됩니다. 
> 따라서 스크립트는 PostgreSQL에 직접 삽입하는 방식을 사용합니다.

**필수 조건:**
- PostgreSQL 컨테이너 (`blog-postgres`) 실행 중
- `jq` 설치됨 (`apt-get install jq` 또는 `brew install jq`)

```bash
cd /opt/blog-stack

# 워크플로우 존재 여부 확인 (dry run)
./scripts/import-n8n-workflows.sh --check

# 워크플로우 임포트 및 활성화
./scripts/import-n8n-workflows.sh

# 강제 재임포트 (기존 워크플로우 삭제 후 다시 임포트)
./scripts/import-n8n-workflows.sh --force
```

스크립트는 다음 테이블에 데이터를 삽입합니다:
- `workflow_entity` - 워크플로우 정의
- `workflow_history` - 버전 기록
- `shared_workflow` - 프로젝트 공유 설정
- `webhook_entity` - 웹훅 경로 등록

#### 수동 임포트 (참고용 - 권장하지 않음)

> **경고**: n8n CLI를 사용한 임포트는 불완전할 수 있습니다. 가능하면 자동 스크립트를 사용하세요.

```bash
# n8n CLI 사용 (불완전한 임포트 - 권장하지 않음)
docker exec -it blog-n8n n8n import:workflow --input=/workflows/ai-health.json

# 워크플로우 활성화 (PostgreSQL에서)
docker exec blog-postgres psql -U bloguser -d blog -c "UPDATE workflow_entity SET active = true WHERE name LIKE 'AI%';"

# 워커 재시작
docker compose restart n8n-worker
```

#### 직접 DB 삽입 (고급)

n8n 2.x에서는 circular FK constraint가 있어 `SET CONSTRAINTS ALL DEFERRED`가 필요합니다:

```sql
BEGIN;
SET CONSTRAINTS ALL DEFERRED;

-- 1. workflow_entity 삽입 (activeVersionId 없이)
INSERT INTO workflow_entity (id, name, active, nodes, connections, ...) VALUES (...);

-- 2. workflow_history 삽입
INSERT INTO workflow_history ("versionId", "workflowId", nodes, ...) VALUES (...);

-- 3. workflow_entity.activeVersionId 업데이트
UPDATE workflow_entity SET "activeVersionId" = '...' WHERE id = '...';

-- 4. shared_workflow 삽입 (projectId 필요)
INSERT INTO shared_workflow (role, "workflowId", "projectId", ...) VALUES (...);

-- 5. webhook_entity 삽입 (웹훅 노드가 있는 경우)
INSERT INTO webhook_entity ("webhookPath", method, "workflowId", ...) VALUES (...);

COMMIT;
```

### 1.4 필수 환경 변수

docker-compose.yml의 n8n 및 n8n-worker 서비스에 다음 환경 변수가 필요합니다:

```yaml
environment:
  # AI 서버 연결 (필수)
  - OPENCODE_BASE_URL=http://ai-server-backend:7016
  - OPENCODE_SERVE_URL=http://ai-server-serve:7012
  
  # 기본 모델 설정 (선택)
  - OPENCODE_DEFAULT_PROVIDER=github-copilot
  - OPENCODE_DEFAULT_MODEL=gpt-4.1
  
  # 환경 변수 접근 허용 (필수!)
  - N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

> **중요**: `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`가 설정되지 않으면 워크플로우에서 `$env.*` 변수에 접근할 수 없어 AI 요청이 실패합니다.

### 1.5 API 사용 예시

#### Health Check
```bash
curl https://blog-bw.nodove.com/webhook/ai/health
```

#### Chat
```bash
curl -X POST https://blog-bw.nodove.com/webhook/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "안녕하세요!"}],
    "model": "gpt-4.1"
  }'
```

#### Generate
```bash
curl -X POST https://blog-bw.nodove.com/webhook/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "간단한 인사말을 작성해주세요",
    "temperature": 0.7
  }'
```

#### Translate
```bash
curl -X POST https://blog-bw.nodove.com/webhook/ai/translate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "제목입니다",
    "content": "번역할 내용입니다",
    "targetLang": "en"
  }'
```

#### Task (Sketch/Prism/Chain/Summary)
```bash
curl -X POST https://blog-bw.nodove.com/webhook/ai/task \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sketch",
    "payload": {
      "paragraph": "분석할 문단 내용...",
      "postTitle": "게시글 제목"
    }
  }'
```

#### Embeddings
```bash
curl -X POST https://blog-bw.nodove.com/webhook/ai/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "임베딩할 텍스트"}'
```

### 1.6 응답 형식

모든 AI 워크플로우는 일관된 응답 형식을 반환합니다:

```json
{
  "content": "AI 응답 텍스트",
  "model": "gpt-4.1",
  "provider": "opencode",
  "requestId": "n8n-1234567890"
}
```

---

## 2. Buffer Zone 워크플로우

### 2.1 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                     Buffer Zone Workflows                        │
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

### 2.2 워크플로우 파일

| 파일 | 설명 |
|------|------|
| `buffer-zone-chat.json` | 기본 채팅 |
| `buffer-zone-rag-chat.json` | RAG 기반 채팅 |
| `buffer-zone-workflow-chat.json` | 워크플로우 프로필 채팅 |
| `buffer-zone-events.json` | 이벤트 수신 |

### 2.3 상세 설명

Buffer Zone 워크플로우에 대한 자세한 내용은 아래를 참조하세요.

---

## 3. 크레덴셜 설정

### 3.1 자동 설정 (CI/CD)

GitHub Actions 배포 시 자동으로 설정됩니다:

```
GitHub Push → Build → Deploy → Setup Credentials (자동)
                                    ├── JWT 토큰 생성
                                    ├── n8n Credentials 설정
                                    └── Workers Secrets 설정
```

토큰 로테이션: 매주 일요일 03:00 UTC에 자동 실행

### 3.2 수동 설정 (로컬 개발용)

n8n에서 **Settings > Credentials > Add Credential**로 이동:

| 필드 | 값 |
|------|-----|
| **Type** | HTTP Header Auth |
| **Name** | `Blog API Auth` |
| **Header Name** | `Authorization` |
| **Header Value** | `Bearer {YOUR_JWT_TOKEN}` |

### 3.3 자동화 스크립트

```bash
# 전체 자동 설정
export ADMIN_USERNAME=admin ADMIN_PASSWORD=secret
export N8N_USER=admin N8N_PASS=secret
./scripts/setup-api-credentials.sh --all

# 토큰만 생성
./scripts/setup-api-credentials.sh --generate-token

# n8n Credentials만 설정
./scripts/setup-api-credentials.sh --setup-n8n
```

---

## 4. 모니터링 및 디버깅

### 4.1 헬스체크

```bash
# AI 워크플로우 헬스체크
curl https://blog-bw.nodove.com/webhook/ai/health

# Buffer Zone API 헬스체크
curl http://localhost:7080/health
```

### 4.2 로그 확인

```bash
# n8n 메인 로그
docker logs -f blog-n8n

# n8n 워커 로그
docker logs -f blog-stack-n8n-worker-1

# 실행 기록 조회 (PostgreSQL)
docker exec blog-postgres psql -U bloguser -d blog -c "
SELECT ee.id, we.name, ee.status, ee.\"startedAt\"
FROM execution_entity ee
JOIN workflow_entity we ON ee.\"workflowId\" = we.id
ORDER BY ee.id DESC LIMIT 10;"
```

### 4.3 일반적인 문제 해결

| 문제 | 원인 | 해결 |
|------|------|------|
| `access to env vars denied` | `N8N_BLOCK_ENV_ACCESS_IN_NODE` 미설정 | docker-compose.yml에 환경변수 추가 후 워커 재시작 |
| 빈 응답 | 응답 경로 불일치 | 워크플로우의 응답 경로가 `$json.body?.data?.response?.text` 확인 |
| 401 Unauthorized | JWT 토큰 만료 | `Actions > Rotate API Tokens` 실행 |
| 502 Bad Gateway | AI 서버 다운 | `docker restart ai-server-backend` |
| Timeout | LLM 응답 지연 | timeout 값 증가 (기본 120s) |

### 4.4 워크플로우 수동 업데이트 (DB 직접 수정)

```bash
# 응답 경로 수정 예시
docker exec blog-postgres psql -U bloguser -d blog -c "
UPDATE workflow_entity 
SET nodes = REPLACE(nodes::text, 'OLD_VALUE', 'NEW_VALUE')::jsonb
WHERE name LIKE 'AI%';"

# workflow_history도 함께 수정
docker exec blog-postgres psql -U bloguser -d blog -c "
UPDATE workflow_history 
SET nodes = REPLACE(nodes::text, 'OLD_VALUE', 'NEW_VALUE')::json
WHERE \"workflowId\" IN (SELECT id FROM workflow_entity WHERE name LIKE 'AI%');"

# 워커 재시작으로 변경 적용
docker compose restart n8n-worker
```

---

## 5. 참고 자료

- [n8n 공식 문서](https://docs.n8n.io/)
- [OpenCode API 문서](../docs/AI_SERVICE_ANATOMY_MAP.md)
- [Buffer Zone API OpenAPI 스펙](./openapi-buffer-zone.json)
