# Backend CI/CD Pipeline

## 1. Service Overview (개요)

### 목적
Backend CI/CD Pipeline은 **GitHub Actions 기반 자동 배포 시스템**입니다. Docker 이미지 빌드, GHCR(GitHub Container Registry) 푸시, SSH를 통한 프로덕션 서버 배포를 자동화합니다.

> **⚠️ 아키텍처 노트**
> - **API Gateway**: Cloudflare Workers (`deploy-api-gateway.yml`)
> - **Backend + n8n**: 이 문서 (`deploy-blog-workflow.yml`)
> - Workers와 Backend는 **별도 배포 파이프라인**을 사용합니다.

### 배포 대상 서비스

| 서비스 | 이미지 | 설명 |
|--------|--------|------|
| **Blog API** | `ghcr.io/{owner}/blog-api` | Node.js 백엔드 서버 |
| **Terminal Server** | `ghcr.io/{owner}/blog-terminal` | WebSocket 터미널 |
| **OpenCode Backend** | `ghcr.io/{owner}/opencode-backend` | AI API 오케스트레이션 |
| **OpenCode Serve** | `ghcr.io/{owner}/opencode-serve` | AI 모델 서빙 |
| **n8n** | `n8nio/n8n:latest` | Workflow 자동화 |
| **PostgreSQL** | `postgres:15` | 메인 데이터베이스 |
| **Redis** | `redis:7-alpine` | 캐시/세션 |
| **ChromaDB** | `chromadb/chroma` | 벡터 데이터베이스 |

---

## 2. Architecture & Data Flow (구조 및 흐름)

### Pipeline Architecture

```mermaid
flowchart LR
    subgraph "GitHub"
        PUSH[Push to main]
        DISPATCH[Manual Dispatch]
    end

    subgraph "GitHub Actions"
        BUILD[Build Images]
        PUSH_REG[Push to GHCR]
        DEPLOY[Deploy via SSH]
    end

    subgraph "Production Server"
        COMPOSE[docker compose]
        SERVICES[Services]
    end

    PUSH --> BUILD
    DISPATCH --> BUILD
    BUILD --> PUSH_REG
    PUSH_REG --> DEPLOY
    DEPLOY -->|SSH| COMPOSE
    COMPOSE --> SERVICES
```

### Deployment Flow

```mermaid
sequenceDiagram
    participant GH as GitHub Actions
    participant GHCR as Container Registry
    participant SSH as SSH Connection
    participant SRV as Production Server

    GH->>GH: Checkout code
    GH->>GH: Build Docker images
    GH->>GHCR: Push images (sha, latest)
    GH->>SSH: Connect via SSH key
    GH->>SRV: Generate .env file
    GH->>SRV: Upload compose files
    SRV->>GHCR: docker compose pull
    SRV->>SRV: docker compose up -d
    SRV->>SRV: Health checks
    GH->>GH: Verify public endpoints
```

### Server Architecture

```mermaid
flowchart TB
    subgraph "Cloudflare"
        CF_PROXY[Cloudflare Proxy]
    end

    subgraph "Production Server /opt/blog-stack"
        NGINX[nginx :8080/:8443]
        
        subgraph "Application"
            API[Blog API :5080]
            TERM[Terminal :8080]
            N8N[n8n :5678]
        end
        
        subgraph "AI Services"
            OC_BE[OpenCode Backend :7016]
            OC_SRV[OpenCode Serve :7012]
        end
        
        subgraph "Data"
            PG[(PostgreSQL :5432)]
            REDIS[(Redis :6379)]
            CHROMA[(ChromaDB :8000)]
        end
    end

    CF_PROXY -->|blog-b.nodove.com| NGINX
    CF_PROXY -->|blog-bw.nodove.com| NGINX
    NGINX --> API
    NGINX --> TERM
    NGINX --> N8N
    API --> OC_BE
    OC_BE --> OC_SRV
    API --> PG
    API --> REDIS
    API --> CHROMA
```

---

## 3. Pipeline Specification (파이프라인 명세)

### Trigger Conditions

| 트리거 | 경로 | 설명 |
|--------|------|------|
| **push** | `backend/**` | 백엔드 코드 변경 |
| **push** | `shared/**` | 공유 라이브러리 변경 |
| **push** | `frontend/public/posts/**` | 게시글 변경 |
| **push** | `.github/workflows/deploy-blog-workflow.yml` | 워크플로우 변경 |
| **workflow_dispatch** | - | 수동 실행 |

### Manual Dispatch Options

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `environment` | 배포 환경 (production/staging) | `production` |
| `skip_build` | 빌드 스킵 (설정만 변경 시) | `false` |
| `image_tag` | 커스텀 이미지 태그 | Git SHA |

### Jobs

| Job | 설명 | 조건 |
|-----|------|------|
| `build-and-push` | 이미지 빌드 및 GHCR 푸시 | `skip_build != true` |
| `deploy` | 서버 배포 | 빌드 성공 또는 `skip_build` |
| `e2e-tests` | E2E 테스트 | 배포 성공 |

---

## 4. Configuration (설정)

### GitHub Secrets (필수)

```yaml
# ============================================
# SSH 접속
# ============================================
SSH_HOST: "123.45.67.89"          # 배포 서버 IP
SSH_USER: "deploy"                 # SSH 사용자명
SSH_PRIVATE_KEY: |                 # SSH Private Key
  -----BEGIN OPENSSH PRIVATE KEY-----
  ...
  -----END OPENSSH PRIVATE KEY-----
SSH_PORT: "22"                     # SSH 포트 (선택)

# ============================================
# 데이터베이스
# ============================================
POSTGRES_PASSWORD: "secure-pass"   # PostgreSQL 비밀번호
REDIS_PASSWORD: "redis-pass"       # Redis 비밀번호

# ============================================
# AI 서비스
# ============================================
OPENAI_API_KEY: "sk-xxx"           # OpenAI API 키
ANTHROPIC_API_KEY: "sk-ant-xxx"    # Anthropic API 키
GOOGLE_API_KEY: "AIza..."          # Google/Gemini API 키

# ============================================
# 인증
# ============================================
JWT_SECRET: "jwt-secret"           # JWT 서명 키
ADMIN_PASSWORD: "admin-pass"       # 관리자 비밀번호
ADMIN_BEARER_TOKEN: "bearer-xxx"   # API Bearer 토큰

# ============================================
# n8n
# ============================================
N8N_PASS: "n8n-pass"               # n8n 로그인 비밀번호
N8N_ENCRYPTION_KEY: "32-chars..."  # n8n 암호화 키 (32자)

# ============================================
# SSL (Cloudflare Origin Certificate)
# ============================================
SSL_CERT: |                        # cert.pem 내용
  -----BEGIN CERTIFICATE-----
  ...
SSL_KEY: |                         # key.pem 내용
  -----BEGIN PRIVATE KEY-----
  ...
```

### GitHub Variables (비민감)

```yaml
# 애플리케이션
APP_ENV: "production"
SITE_BASE_URL: "https://noblog.nodove.com"
API_BASE_URL: "https://blog-b.nodove.com"
ALLOWED_ORIGINS: "https://noblog.nodove.com,https://blog.nodove.com"

# 데이터베이스
POSTGRES_DB: "blog"
POSTGRES_USER: "bloguser"

# n8n
N8N_USER: "admin"
N8N_HOST: "blog-bw.nodove.com"
N8N_WEBHOOK_URL: "https://blog-bw.nodove.com/"

# Cloudflare
CF_ACCOUNT_ID: "xxxxx"
D1_DATABASE_ID: "xxxxx"
R2_BUCKET_NAME: "blog"
```

---

## 5. Deployment Directory (서버 디렉토리)

### Structure

```
/opt/blog-stack/
├── docker-compose.yml           # 메인 compose 파일
├── .env                         # 환경변수 (Actions가 생성)
├── nginx-blog-workflow.conf     # Nginx 설정
├── litellm_config.yaml          # LiteLLM 설정
├── ssl/
│   ├── cert.pem                 # SSL 인증서
│   └── key.pem                  # SSL 키
├── scripts/
│   └── bootstrap-token.sh       # 토큰 부트스트랩
├── n8n-workflows/               # n8n 워크플로우 JSON
│   ├── buffer-zone-chat.json
│   └── ...
├── n8n_files/                   # n8n 파일 저장소
└── opencode-config/             # AI Engine 설정
```

### Docker Compose Services

```yaml
services:
  nginx:
    ports: ["80:80", "8080:80", "443:443", "8443:8443"]
    
  api:
    image: ghcr.io/{owner}/blog-api:{sha}
    expose: ["5080"]
    
  opencode-backend:
    image: ghcr.io/{owner}/opencode-backend:latest
    expose: ["7016"]
    
  opencode-serve:
    image: ghcr.io/{owner}/opencode-serve:latest
    expose: ["7012"]
    
  n8n:
    image: n8nio/n8n:latest
    expose: ["5678"]
    
  postgres:
    image: postgres:15
    expose: ["5432"]
    
  redis:
    image: redis:7-alpine
    expose: ["6379"]
    
  chromadb:
    image: chromadb/chroma:0.5.23
    expose: ["8000"]
```

---

## 6. Operations (운영)

### Manual Deployment

```bash
# GitHub Actions에서 수동 실행
# 1. Actions > Deploy Blog + n8n Workflow Stack
# 2. Run workflow 클릭
# 3. 옵션 선택 후 실행
```

### Rollback

```bash
# 방법 1: GitHub Actions에서 롤백
# 1. Run workflow > image_tag에 이전 SHA 입력
# 2. skip_build 체크
# 3. Run workflow

# 방법 2: 서버에서 직접 롤백
cd /opt/blog-stack
export IMAGE_TAG=abc1234  # 이전 커밋 SHA
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${IMAGE_TAG}/" .env
docker compose pull
docker compose up -d
```

### Monitoring

```bash
cd /opt/blog-stack

# 전체 로그
docker compose logs -f

# 특정 서비스 로그
docker compose logs -f api
docker compose logs -f n8n
docker compose logs -f opencode-backend

# 서비스 상태
docker compose ps
```

### Health Checks

| 서비스 | 내부 URL | 외부 URL |
|--------|----------|----------|
| API | `http://localhost:8080/api/v1/healthz` | `https://blog-b.nodove.com/api/v1/healthz` |
| n8n | `http://localhost:5678/healthz` | `https://blog-bw.nodove.com/healthz` |
| Nginx | `http://localhost:8080/health` | - |

---

## 7. Troubleshooting (문제 해결)

### Common Issues

| 문제 | 원인 | 해결 |
|------|------|------|
| 이미지 Pull 실패 | GHCR 인증 만료 | `docker login ghcr.io` 재실행 |
| 포트 충돌 | 기존 컨테이너 점유 | `docker compose down`, 충돌 컨테이너 제거 |
| SSH 연결 실패 | 키 불일치 | `authorized_keys` 확인 |
| Health check 실패 | 서비스 시작 지연 | 로그 확인 후 재시작 |
| SSL 오류 | 인증서 만료/불일치 | `SSL_CERT`, `SSL_KEY` 재설정 |

### Debug Commands

```bash
# 서버 접속
ssh -p ${SSH_PORT} ${SSH_USER}@${SSH_HOST}

# 컨테이너 상태
docker compose ps -a

# 상세 로그
docker compose logs SERVICE_NAME --tail 100

# 네트워크 확인
docker network ls
docker network inspect blog-stack_backend

# 포트 확인
netstat -tlnp | grep -E '(80|443|5080|5678)'

# PostgreSQL 연결 테스트
docker compose exec postgres psql -U bloguser -d blog -c "SELECT 1"

# Redis 연결 테스트
docker compose exec redis redis-cli -a $REDIS_PASSWORD ping
```

### E2E Test Failures

E2E 테스트는 다음 항목을 검증합니다:

1. **Health Check** - API 응답 확인
2. **Auth Flow** - 로그인 (OTP 검증 스킵)
3. **Comments** - 생성 → 조회 → (삭제는 Admin 권한 필요로 스킵)
4. **AI Endpoints** - AI 서비스 연결 확인

실패 시 Actions 로그에서 상세 내용을 확인하세요.

---

## Quick Reference

### Workflow Files

| 파일 | 설명 | 상태 |
|------|------|------|
| `deploy-blog-workflow.yml` | 메인 Backend 배포 | ✅ Active |
| `backend-deploy.yml` | 레거시 배포 | ❌ Deprecated |
| `deploy-api-gateway.yml` | Workers API Gateway | ✅ Active |

### 배포 체크리스트

1. [ ] GitHub Secrets 설정 완료
2. [ ] 서버 SSH 접속 가능
3. [ ] 서버에 Docker/Docker Compose 설치
4. [ ] 방화벽 포트 개방 (22, 80, 443, 8080, 8443)
5. [ ] 도메인 DNS 설정 (Cloudflare)
6. [ ] SSL 인증서 발급 (Cloudflare Origin Certificate)

### 관련 문서

- [Backend README](./README.md) - 백엔드 서버 개요
- [Workers 문서](../workers/README.md) - API Gateway
- [API Gateway](../workers/api-gateway/README.md) - 주 진입점
