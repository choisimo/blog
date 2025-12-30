# Blog + n8n Workflow CI/CD 가이드

이 문서는 GitHub Actions를 통한 Blog Backend + n8n Workflow 스택의 자동 배포 설정을 설명합니다.

## 아키텍처 개요

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           GitHub Actions Pipeline                             │
│                                                                               │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────────────┐│
│  │   Trigger   │────▶│    Build    │────▶│           Deploy                ││
│  │  (push/PR)  │     │  & Push     │     │     (SSH to Server)             ││
│  └─────────────┘     │  to GHCR    │     │                                 ││
│                      └─────────────┘     │  1. Generate .env               ││
│                                          │  2. Upload compose/configs      ││
│                                          │  3. docker compose pull         ││
│                                          │  4. docker compose up -d        ││
│                                          │  5. Health checks               ││
│                                          └─────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Production Server                                     │
│                         /opt/blog-stack/                                      │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         docker-compose.yml                               ││
│  │                                                                          ││
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     ││
│  │   │ nginx   │  │   api   │  │ litellm │  │   n8n   │  │ workers │     ││
│  │   │  :8080  │  │  :5080  │  │  :4000  │  │  :5678  │  │  (x2)   │     ││
│  │   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └─────────┘     ││
│  │        │            │            │            │                         ││
│  │        └────────────┴────────────┴────────────┘                         ││
│  │                              │                                           ││
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     ││
│  │   │postgres │  │  redis  │  │ mongodb │  │ qdrant  │  │chromadb │     ││
│  │   │  :5432  │  │  :6379  │  │  :27017 │  │  :6333  │  │  :8100  │     ││
│  │   └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

## 1. GitHub Secrets 설정

### 필수 Secrets (민감 정보)

GitHub Repository > Settings > Secrets and variables > Actions > Secrets

| Secret Name | 설명 | 예시 |
|-------------|------|------|
| **SSH 접속** |
| `PROD_SSH_HOST` | 배포 서버 IP/호스트 | `123.45.67.89` |
| `PROD_SSH_USER` | SSH 사용자명 | `deploy` |
| `PROD_SSH_KEY` | SSH Private Key (전체 내용) | `-----BEGIN OPENSSH...` |
| `PROD_SSH_PORT` | SSH 포트 (선택, 기본 22) | `22` |
| **데이터베이스** |
| `POSTGRES_PASSWORD` | PostgreSQL 비밀번호 | `secure-pg-pass-123` |
| `REDIS_PASSWORD` | Redis 비밀번호 | `secure-redis-pass` |
| `MONGO_PASSWORD` | MongoDB 비밀번호 | `secure-mongo-pass` |
| `QDRANT_API_KEY` | Qdrant API 키 | `qdrant-api-key-xxx` |
| **AI 서비스** |
| `LITELLM_MASTER_KEY` | LiteLLM 마스터 키 | `sk-litellm-xxx` |
| `OPENAI_API_KEY` | OpenAI API 키 (선택) | `sk-xxx` |
| `GOOGLE_API_KEY` | Google/Gemini API 키 (선택) | `AIza...` |
| `ANTHROPIC_API_KEY` | Anthropic API 키 (선택) | `sk-ant-xxx` |
| **관리자 인증** |
| `ADMIN_JWT_SECRET` | Admin JWT 시크릿 | `random-32-char-secret` |
| `ADMIN_PASSWORD` | 관리자 비밀번호 | `secure-admin-pass` |
| `ADMIN_BEARER_TOKEN` | API Bearer 토큰 | `bearer-token-xxx` |
| `JWT_SECRET` | 일반 JWT 시크릿 | `another-secret-key` |
| **n8n** |
| `N8N_PASS` | n8n 로그인 비밀번호 | `n8n-secure-pass` |
| `N8N_ENCRYPTION_KEY` | n8n 암호화 키 (32자) | `32-char-encryption-key-here!!` |
| `N8N_API_KEY` | n8n API 키 (선택) | `n8n-api-key-xxx` |
| **Cloudflare** |
| `CF_API_TOKEN` | Cloudflare API 토큰 | `xxxxx` |
| **기타** |
| `GH_PAT_TOKEN` | GitHub PAT (PR 생성용) | `ghp_xxx` |
| `ORIGIN_SECRET_KEY` | Terminal Server 시크릿 | `terminal-secret` |
| `MINIO_PASSWORD` | MinIO 비밀번호 | `minio-secure-pass` |
| `FIRECRAWL_API_TOKEN` | Firecrawl API 토큰 | `fc-token-xxx` |
| `GRAFANA_PASSWORD` | Grafana 비밀번호 (선택) | `grafana-pass` |
| `PGADMIN_PASSWORD` | pgAdmin 비밀번호 (선택) | `pgadmin-pass` |

### Variables (비민감 설정값)

GitHub Repository > Settings > Secrets and variables > Actions > Variables

| Variable Name | 설명 | 기본값 |
|---------------|------|--------|
| **애플리케이션** |
| `APP_ENV` | 환경 (production/staging) | `production` |
| `SITE_BASE_URL` | 프론트엔드 URL | `https://noblog.nodove.com` |
| `API_BASE_URL` | API 공개 URL | `https://api.nodove.com` |
| **데이터베이스** |
| `POSTGRES_DB` | PostgreSQL DB명 | `blog` |
| `POSTGRES_USER` | PostgreSQL 사용자 | `bloguser` |
| `MONGO_USER` | MongoDB 사용자 | `mongouser` |
| `MONGO_DB` | MongoDB DB명 | `blog` |
| **AI** |
| `AI_DEFAULT_MODEL` | 기본 AI 모델 | `gpt-4.1` |
| **n8n** |
| `N8N_USER` | n8n 로그인 ID | `admin` |
| `N8N_WEBHOOK_URL` | n8n 웹훅 공개 URL | `https://workflow.nodove.com/` |
| `N8N_HOST` | n8n 호스트명 | `workflow.nodove.com` |
| `N8N_WORKER_REPLICAS` | Worker 수 | `2` |
| **Cloudflare** |
| `CF_ACCOUNT_ID` | Cloudflare Account ID | `xxxxx` |
| `D1_DATABASE_ID` | D1 Database ID | `xxxxx` |
| `R2_BUCKET_NAME` | R2 버킷명 | `blog` |
| `R2_ASSETS_BASE_URL` | R2 에셋 URL | `https://assets-b.nodove.com` |
| **GitHub** |
| `GITHUB_REPO_OWNER` | 저장소 소유자 | `choisimo` |
| `GITHUB_REPO_NAME` | 저장소 이름 | `blog` |
| **기타** |
| `ADMIN_EMAIL` | 관리자 이메일 | `admin@nodove.com` |
| `ADMIN_USERNAME` | 관리자 ID | `admin` |
| `MINIO_USER` | MinIO 사용자 | `minioadmin` |
| `SANDBOX_IMAGE` | Terminal Sandbox 이미지 | `alpine:latest` |
| `PGADMIN_EMAIL` | pgAdmin 이메일 | `admin@nodove.com` |

## 2. 서버 사전 준비

### 2.1 필수 소프트웨어

```bash
# Docker & Docker Compose 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 배포 디렉토리 생성
sudo mkdir -p /opt/blog-stack
sudo chown $USER:$USER /opt/blog-stack
```

### 2.2 방화벽 설정

```bash
# UFW 예시
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 8080/tcp    # Nginx (Cloudflare Only)
sudo ufw enable
```

### 2.3 SSH 키 설정

```bash
# 서버에서 실행
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# GitHub Actions용 deploy key 추가
echo "DEPLOY_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## 3. 배포 트리거

### 자동 배포 (Push)

다음 경로에 변경이 있으면 자동 배포:
- `backend/**`
- `shared/**`
- `.github/workflows/deploy-blog-workflow.yml`

### 수동 배포

GitHub Actions > Deploy Blog + n8n Workflow Stack > Run workflow

옵션:
- `environment`: production / staging
- `skip_build`: 빌드 스킵 (설정만 변경 시)
- `image_tag`: 커스텀 이미지 태그

## 4. 서버 디렉토리 구조

```
/opt/blog-stack/
├── docker-compose.yml           # 메인 compose 파일
├── .env                         # 환경변수 (GitHub Actions가 생성)
├── nginx-blog-workflow.conf     # Nginx 설정
├── litellm_config.yaml          # LiteLLM 설정
├── scripts/
│   └── bootstrap-token.sh       # VAS 토큰 부트스트랩
├── n8n-workflows/               # n8n 워크플로우 JSON
│   ├── buffer-zone-chat.json
│   ├── buffer-zone-rag-chat.json
│   └── ...
├── n8n_files/                   # n8n 파일 저장소
└── opencode-config/             # AI Engine 설정
```

## 5. 롤백 방법

### 이전 버전으로 롤백

```bash
# 서버에서 실행
cd /opt/blog-stack

# 이전 이미지 태그로 변경
export IMAGE_TAG=abc1234  # 이전 커밋 SHA

# .env 파일의 IMAGE_TAG 수정
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${IMAGE_TAG}/" .env

# 재배포
docker compose pull
docker compose up -d
```

### GitHub Actions에서 롤백

1. Actions > Deploy Blog + n8n Workflow Stack
2. Run workflow 클릭
3. `image_tag`에 롤백할 SHA 입력
4. `skip_build` 체크
5. Run workflow

## 6. 모니터링

### 로그 확인

```bash
cd /opt/blog-stack

# 전체 로그
docker compose logs -f

# 특정 서비스
docker compose logs -f api
docker compose logs -f n8n
docker compose logs -f litellm
```

### 서비스 상태

```bash
docker compose ps
docker compose top
```

### 헬스체크 엔드포인트

| 서비스 | 내부 URL | 외부 URL |
|--------|----------|----------|
| API | `http://localhost:8080/api/v1/healthz` | `https://api.nodove.com/api/v1/healthz` |
| LiteLLM | `http://localhost:4000/health` | `https://api.nodove.com/ai/health` |
| n8n | `http://localhost:5678/healthz` | `https://workflow.nodove.com/healthz` |

## 7. 문제 해결

### 이미지 Pull 실패

```bash
# GHCR 로그인
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

### 컨테이너 시작 실패

```bash
# 상세 로그 확인
docker compose logs SERVICE_NAME

# 컨테이너 상태 확인
docker compose ps -a

# 재시작
docker compose restart SERVICE_NAME
```

### 데이터베이스 연결 실패

```bash
# PostgreSQL 접속 테스트
docker compose exec postgres psql -U bloguser -d blog -c "SELECT 1"

# Redis 접속 테스트
docker compose exec redis redis-cli -a $REDIS_PASSWORD ping
```
