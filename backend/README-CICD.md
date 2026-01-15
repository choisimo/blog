# Backend CI/CD Pipeline

## 1. Service Overview (개요)

### 목적
Backend CI/CD Pipeline은 **GitHub Actions 기반 이미지 빌드 시스템**과 **수동 서버 배포**로 구성됩니다.

> **⚠️ 배포 모델 변경 (2025-01)**
> - **기존**: GitHub Actions가 이미지 빌드 + 서버 배포까지 자동화
> - **현재**: GitHub Actions는 이미지 빌드만, 서버 배포는 관리자가 수동으로 진행
> - **이유**: 서버 관리자가 배포 시점을 직접 제어, 롤백 용이성 향상

### 아키텍처 노트
- **API Gateway**: Cloudflare Workers (`deploy-api-gateway.yml`)
- **Backend Images**: 이 문서 (`deploy-blog-workflow.yml`)
- **환경 변수 동기화**: `sync-backend-env.yml`
- Workers와 Backend는 **별도 배포 파이프라인**을 사용합니다.

### 배포 대상 이미지

| 이미지 | 설명 | 빌드 트리거 |
|--------|------|-------------|
| `ghcr.io/{owner}/blog-api` | Node.js 백엔드 서버 | `backend/**` 변경 |
| `ghcr.io/{owner}/blog-terminal` | WebSocket 터미널 | `backend/terminal-server/**` 변경 |

### 외부 이미지 (빌드 안 함)

| 이미지 | 설명 |
|--------|------|
| `n8nio/n8n:latest` | Workflow 자동화 |
| `postgres:15` | 메인 데이터베이스 |
| `redis:7-alpine` | 캐시/세션 |
| `chromadb/chroma` | 벡터 데이터베이스 |

---

## 2. Architecture & Data Flow (구조 및 흐름)

### 새로운 배포 모델

```mermaid
flowchart LR
    subgraph "GitHub"
        PUSH[Push to main]
        DISPATCH[Manual Dispatch]
    end

    subgraph "GitHub Actions"
        BUILD[Build Images]
        PUSH_REG[Push to GHCR]
        SYNC_ENV[Sync Env Vars]
    end

    subgraph "Server Admin"
        SSH[SSH to Server]
        SCRIPT[manual-deploy.sh]
    end

    subgraph "Production Server"
        PULL[docker pull]
        COMPOSE[docker compose up]
    end

    PUSH --> BUILD
    DISPATCH --> BUILD
    BUILD --> PUSH_REG
    
    DISPATCH -.->|별도 워크플로우| SYNC_ENV
    SYNC_ENV -.->|.env 업로드| SSH
    
    SSH --> SCRIPT
    SCRIPT --> PULL
    PULL --> COMPOSE
```

### 워크플로우 분리

| 워크플로우 | 목적 | 트리거 |
|------------|------|--------|
| `deploy-blog-workflow.yml` | 이미지 빌드 & GHCR 푸시 | `backend/**` push, 수동 |
| `sync-backend-env.yml` | `.env` 및 SSL 인증서 동기화 | 수동만 |
| `deploy-api-gateway.yml` | Cloudflare Workers 배포 | `workers/**` push |

---

## 3. Workflow Specification (워크플로우 명세)

### deploy-blog-workflow.yml (이미지 빌드)

#### Trigger Conditions

| 트리거 | 경로 | 설명 |
|--------|------|------|
| **push** | `backend/**` | 백엔드 코드 변경 |
| **push** | `shared/**` | 공유 라이브러리 변경 |
| **workflow_dispatch** | - | 수동 실행 |

#### Manual Dispatch Options

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `image_tag` | 커스텀 이미지 태그 | Git SHA |

#### 빌드 결과물

```bash
ghcr.io/{owner}/blog-api:{sha}
ghcr.io/{owner}/blog-api:latest
ghcr.io/{owner}/blog-terminal:{sha}
ghcr.io/{owner}/blog-terminal:latest
```

### sync-backend-env.yml (환경 변수 동기화)

#### Trigger Conditions

| 트리거 | 설명 |
|--------|------|
| **workflow_dispatch** | 수동 실행만 |

#### Manual Dispatch Options

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `restart_services` | 환경 변수 업데이트 후 서비스 재시작 | `false` |
| `services_to_restart` | 재시작할 서비스 (쉼표 구분) | `none` |

#### 수행 작업

1. GitHub Secrets에서 `.env` 파일 생성
2. 서버의 `~/blog-stack/.env`로 업로드
3. SSL 인증서 업데이트 (secrets에 있을 경우)
4. 선택적으로 Docker 서비스 재시작

---

## 4. Manual Deployment (수동 배포)

### 초기 서버 설정

```bash
# 1. 저장소 클론
cd ~
git clone https://github.com/choisimo/blog.git
cd blog/backend

# 2. 배포 디렉토리 설정
./scripts/manual-deploy.sh setup

# 3. GitHub Actions에서 환경 변수 동기화
# Actions > sync-backend-env > Run workflow

# 4. 서비스 시작
./scripts/manual-deploy.sh deploy
```

### 코드 업데이트 및 배포

```bash
cd ~/blog/backend

# 1. 최신 코드 가져오기
./scripts/manual-deploy.sh pull

# 2. (선택) 로컬 빌드 또는 GHCR에서 풀
./scripts/manual-deploy.sh deploy

# 또는 API만 재시작
./scripts/manual-deploy.sh restart-api
```

### manual-deploy.sh 명령어

| 명령어 | 설명 |
|--------|------|
| `setup` | 초기 설정 (디렉토리 생성, 설정 파일 복사) |
| `pull` | git에서 최신 코드 가져오기 |
| `build` | Docker 이미지 로컬 빌드 |
| `deploy` | GHCR에서 이미지 풀 + 서비스 시작 |
| `restart` | 모든 서비스 재시작 |
| `restart-api` | API 서비스만 재시작 |
| `status` | 서비스 상태 확인 |
| `logs [service]` | 로그 확인 |
| `health` | 헬스 체크 실행 |
| `env-check` | 환경 변수 검증 |
| `cleanup` | 오래된 이미지/컨테이너 정리 |

### Rollback (롤백)

```bash
cd ~/blog-stack

# 특정 버전으로 롤백
docker pull ghcr.io/choisimo/blog-api:abc1234
docker compose up -d api

# 또는 .env에서 IMAGE_TAG 수정 후
docker compose up -d
```

---

## 5. Configuration (설정)

### GitHub Secrets (필수)

```yaml
# SSH 접속
SSH_HOST: "123.45.67.89"          # 배포 서버 IP
SSH_USER: "deploy"                 # SSH 사용자명
SSH_PRIVATE_KEY: |                 # SSH Private Key
  -----BEGIN OPENSSH PRIVATE KEY-----
  ...
SSH_PORT: "22"                     # SSH 포트 (선택)

# 데이터베이스
POSTGRES_PASSWORD: "secure-pass"
REDIS_PASSWORD: "redis-pass"

# AI 서비스
AI_API_KEY: "sk-xxx"
OPENAI_API_KEY: "sk-optional"
ANTHROPIC_API_KEY: "sk-ant-xxx"
GOOGLE_API_KEY: "AIza..."

# 인증
JWT_SECRET: "jwt-secret"
ADMIN_PASSWORD: "admin-pass"
ADMIN_BEARER_TOKEN: "bearer-xxx"

# n8n
N8N_PASS: "n8n-pass"
N8N_ENCRYPTION_KEY: "32-chars..."

# SSL (Cloudflare Origin Certificate)
SSL_CERT: |
  -----BEGIN CERTIFICATE-----
  ...
SSL_KEY: |
  -----BEGIN PRIVATE KEY-----
  ...
```

### GitHub Variables (비민감)

```yaml
APP_ENV: "production"
SITE_BASE_URL: "https://noblog.nodove.com"
API_BASE_URL: "https://blog-b.nodove.com"
ALLOWED_ORIGINS: "https://noblog.nodove.com,https://blog.nodove.com"

POSTGRES_DB: "blog"
POSTGRES_USER: "bloguser"

N8N_USER: "admin"
N8N_HOST: "blog-bw.nodove.com"
N8N_WEBHOOK_URL: "https://blog-bw.nodove.com/"

# AI
AI_SERVER_URL: "https://api.openai.com/v1"
AI_DEFAULT_MODEL: "gpt-4.1"
```

---

## 6. Server Directory Structure (서버 디렉토리)

### 배포 디렉토리

```
~/blog-stack/
├── docker-compose.yml           # 메인 compose 파일
├── .env                         # 환경변수 (GitHub Actions가 동기화)
├── nginx.conf                   # Nginx 설정
├── ssl/
│   ├── origin.crt               # SSL 인증서
│   └── origin.key               # SSL 키
├── scripts/
│   ├── manual-deploy.sh         # 수동 배포 스크립트
│   └── setup-api-credentials.sh # API 자격증명 설정
├── n8n-workflows/               # n8n 워크플로우 JSON
└── n8n_files/                   # n8n 파일 저장소
```

### 소스 코드 디렉토리

```
~/blog/                          # git clone한 저장소
├── backend/
│   ├── scripts/
│   │   └── manual-deploy.sh     # 원본 스크립트
│   ├── docker-compose.blog-workflow.yml
│   └── ...
└── ...
```

---

## 7. Operations (운영)

### Health Checks

| 서비스 | 내부 URL | 외부 URL |
|--------|----------|----------|
| API | `http://localhost:8080/api/v1/healthz` | `https://blog-b.nodove.com/api/v1/healthz` |
| n8n | `http://localhost:5678/healthz` | `https://blog-bw.nodove.com/healthz` |

### Monitoring

```bash
cd ~/blog-stack

# 서비스 상태
./scripts/manual-deploy.sh status

# 전체 로그
docker compose logs -f

# 특정 서비스 로그
docker compose logs -f api

# 헬스 체크
./scripts/manual-deploy.sh health
```

### 일반적인 작업 흐름

```bash
# 1. 개발자: 코드 푸시
git push origin main

# 2. GitHub Actions: 자동으로 이미지 빌드 & GHCR 푸시

# 3. 서버 관리자: 수동 배포
ssh user@server
cd ~/blog-stack
./scripts/manual-deploy.sh deploy

# 4. 환경 변수 변경 시 (GitHub Secrets 업데이트 후)
# GitHub Actions > sync-backend-env > Run workflow
# 서버에서: ./scripts/manual-deploy.sh restart
```

---

## 8. Troubleshooting (문제 해결)

### Common Issues

| 문제 | 원인 | 해결 |
|------|------|------|
| 이미지 Pull 실패 | GHCR 인증 만료 | `docker login ghcr.io` 재실행 |
| 포트 충돌 | 기존 컨테이너 점유 | `docker compose down`, 충돌 컨테이너 제거 |
| .env 없음 | 환경 변수 미동기화 | `sync-backend-env` 워크플로우 실행 |
| Health check 실패 | 서비스 시작 지연 | 로그 확인 후 재시작 |
| SSL 오류 | 인증서 만료/불일치 | `SSL_CERT`, `SSL_KEY` secrets 재설정 |

### Debug Commands

```bash
# 컨테이너 상태
docker compose ps -a

# 상세 로그
docker compose logs api --tail 100

# 네트워크 확인
docker network ls
docker network inspect blog-stack_backend

# 포트 확인
netstat -tlnp | grep -E '(80|443|5080|5678)'

# PostgreSQL 연결 테스트
docker compose exec postgres psql -U bloguser -d blog -c "SELECT 1"

# Redis 연결 테스트
docker compose exec redis redis-cli -a $REDIS_PASSWORD ping

# 환경 변수 검증
./scripts/manual-deploy.sh env-check
```

---

## Quick Reference

### Workflow Files

| 파일 | 설명 | 상태 |
|------|------|------|
| `deploy-blog-workflow.yml` | 이미지 빌드 전용 | ✅ Active |
| `sync-backend-env.yml` | 환경 변수 동기화 | ✅ Active |
| `deploy-api-gateway.yml` | Workers API Gateway | ✅ Active |
| `backend-deploy.yml` | 레거시 배포 | ❌ Deprecated |

### 배포 체크리스트

**초기 설정:**
1. [ ] GitHub Secrets 설정 완료
2. [ ] 서버 SSH 접속 가능
3. [ ] 서버에 Docker/Docker Compose 설치
4. [ ] 방화벽 포트 개방 (22, 80, 443, 8080, 8443)
5. [ ] 도메인 DNS 설정 (Cloudflare)
6. [ ] SSL 인증서 발급 (Cloudflare Origin Certificate)
7. [ ] 서버에서 git clone 완료
8. [ ] `manual-deploy.sh setup` 실행
9. [ ] `sync-backend-env` 워크플로우 실행

**일상 배포:**
1. [ ] 코드 푸시 → GitHub Actions 이미지 빌드 대기
2. [ ] 서버 SSH 접속
3. [ ] `./scripts/manual-deploy.sh deploy` 실행
4. [ ] `./scripts/manual-deploy.sh health` 확인

### 관련 문서

- [Backend README](./README.md) - 백엔드 서버 개요
- [Workers 문서](../workers/README.md) - API Gateway
- [API Gateway](../workers/api-gateway/README.md) - 주 진입점
