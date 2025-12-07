# GitHub Secrets 설정 가이드

GitHub Actions 배포를 위한 Secret 설정 방법입니다.

## 목차
- [Part 1: Cloudflare Workers 배포](#part-1-cloudflare-workers-배포)
- [Part 2: Backend 서버 배포 (SSH)](#part-2-backend-서버-배포-ssh)

---

# Part 1: Cloudflare Workers 배포

## 필요한 Secrets

다음 5개의 Secret을 설정해야 합니다:
1. `CLOUDFLARE_ACCOUNT_ID` - Cloudflare 계정 ID
2. `CLOUDFLARE_API_TOKEN` - Cloudflare API 토큰
3. `GEMINI_API_KEY` - Google Gemini API 키
4. `JWT_SECRET` - JWT 서명용 비밀 키
5. `VITE_API_BASE_URL` - 프론트엔드가 사용할 백엔드 API 기본 URL (프로덕션 권장)

---

## 1. CLOUDFLARE_ACCOUNT_ID 설정

### 계정 ID 확인 방법
1. https://dash.cloudflare.com 로그인
2. 오른쪽 사이드바에서 **Account ID** 확인
3. 또는 `wrangler.toml`에서 확인:
   ```toml
   account_id = "f6f11e2a4e5178d2f37476785018f761"
   ```

### GitHub Secret 설정
1. GitHub Repository → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** 클릭
3. Name: `CLOUDFLARE_ACCOUNT_ID`
4. Value: 계정 ID 입력 (예: `f6f11e2a4e5178d2f37476785018f761`)
5. **Add secret** 클릭

---

## 2. CLOUDFLARE_API_TOKEN 설정

### API Token 생성
1. https://dash.cloudflare.com/profile/api-tokens 방문
2. **Create Token** 클릭
3. **Edit Cloudflare Workers** 템플릿 선택
4. 또는 **Custom token**으로 다음 권한 설정:
   - **Account**: 
     - D1: Edit
     - Workers Scripts: Edit
   - **Zone**: 
     - Workers Routes: Edit (선택사항)

5. **Continue to summary** → **Create Token**
6. 생성된 토큰 복사 (다시 볼 수 없으니 주의!)

### 필수 권한 확인
생성한 API Token이 다음 권한을 포함해야 합니다:
- ✅ Account - D1: Edit
- ✅ Account - Workers Scripts: Edit
- ✅ Account - Account Settings: Read

### GitHub Secret 설정
1. GitHub Repository → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** 클릭
3. Name: `CLOUDFLARE_API_TOKEN`
4. Value: 생성한 API Token 붙여넣기
5. **Add secret** 클릭

---

## 3. GEMINI_API_KEY 설정

### API Key 발급
1. https://aistudio.google.com/app/apikey 방문
2. **Create API Key** 클릭
3. 키 복사 (AIza로 시작하는 문자열)

### GitHub Secret 설정
1. GitHub Repository → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** 클릭
3. Name: `GEMINI_API_KEY`
4. Value: 발급받은 API Key
5. **Add secret** 클릭

---

## 4. JWT_SECRET 설정

### Secret 생성
로컬에서 안전한 랜덤 문자열 생성:
```bash
openssl rand -base64 32
```

출력 예시:
```
DtRlOC1noMuWlWTZw2e3Ob58zx1j7av5vJuv0RPz3GY=
```

### GitHub Secret 설정
1. GitHub Repository → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** 클릭
3. Name: `JWT_SECRET`
4. Value: 생성한 랜덤 문자열
5. **Add secret** 클릭

---

## ✅ 설정 확인

### 모든 Secret이 설정되었는지 확인
GitHub Repository → **Settings** → **Secrets and variables** → **Actions**에서:
- [x] CLOUDFLARE_ACCOUNT_ID
- [x] CLOUDFLARE_API_TOKEN
- [x] GEMINI_API_KEY
- [x] JWT_SECRET
- [x] VITE_API_BASE_URL

### 로컬 테스트
로컬에서 API Token이 올바른지 테스트:
```bash
cd workers
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
npx wrangler whoami
```

성공 응답 예시:
```
Getting User settings...
👋 You are logged in with an API Token, associated with the email '***@example.com'!
```

---

## 🚨 트러블슈팅

### 7403 에러: "account is not authorized"
**원인**: API Token 권한 부족 또는 Account ID 불일치

**해결**:
1. Cloudflare Dashboard에서 Account ID 재확인
2. API Token에 D1 Edit 권한이 있는지 확인
3. 필요시 Token 재생성하여 다시 설정

### Secret이 반영되지 않음
**해결**: Secret 변경 후 새 workflow를 트리거해야 합니다
```bash
git commit --allow-empty -m "chore: trigger workflow"
git push
```

### API Token 테스트 실패
**해결**: Token이 만료되었거나 권한이 부족한 경우 재발급
1. https://dash.cloudflare.com/profile/api-tokens
2. 기존 Token 삭제
3. 새 Token 생성
4. GitHub Secret 업데이트

### 프론트엔드가 잘못된 API로 호출함
**원인**: `VITE_API_BASE_URL` Secret 미설정으로 기본값(`blog-api.immuddelo.workers.dev`) 사용

**해결**:
- Repository Secret에 `VITE_API_BASE_URL` 추가 (예: `https://blog-api-prod.immuddelo.workers.dev`)
- 또는 사용자 정의 도메인을 사용 중이면 해당 URL로 설정

---

## 📚 참고 문서

- [Cloudflare API Tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Wrangler Authentication](https://developers.cloudflare.com/workers/wrangler/ci-cd/)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

# Part 2: Backend 서버 배포 (SSH)

Backend API + VAS (Virtual Agent Service) 스택을 원격 서버에 배포합니다.

## 아키텍처

```
GitHub Actions (ubuntu-latest)
       │
       │ SSH (port 11223)
       ▼
┌─────────────────────────────────────────────────────────┐
│  Remote Server (Fedora 43)                              │
│  suhak.nodove.com                                       │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │ cloudflared │───▶│    nginx    │───▶│     api     │ │
│  │  (tunnel)   │    │  (reverse)  │    │  (Node.js)  │ │
│  └─────────────┘    └─────────────┘    └──────┬──────┘ │
│                                               │        │
│                                               ▼        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │  vas-admin  │───▶│  vas-proxy  │───▶│  vas-core   │ │
│  │ (token UI)  │    │ (/auto-chat)│    │ (OpenCode)  │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
│                                                         │
│  + embedding-server, chromadb, terminal-server          │
└─────────────────────────────────────────────────────────┘
```

## 필요한 Secrets

### SSH 접속 정보

| Secret | 값 | 설명 |
|--------|-----|------|
| `SSH_HOST` | `suhak.nodove.com` | 원격 서버 호스트 |
| `SSH_PORT` | `11223` | SSH 포트 |
| `SSH_USER` | `nodove` | SSH 사용자명 |
| `SSH_PRIVATE_KEY` | (아래 참조) | SSH 개인키 전체 내용 |
| `REMOTE_DIR` | `/home/nodove/blog-backend` | 배포 디렉토리 |
| `PUBLIC_API_BASE_URL` | `https://api.nodove.com` | 공개 API URL |
| `BACKEND_ENV_FILE` | (아래 참조) | .env 파일 전체 내용 |

---

## 1. SSH_PRIVATE_KEY 설정

### 개인키 내용 확인
```bash
cat ~/.ssh/pmx.ed25519
```

출력 예시:
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAA...
...
-----END OPENSSH PRIVATE KEY-----
```

### GitHub Secret 설정
1. GitHub Repository → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** 클릭
3. Name: `SSH_PRIVATE_KEY`
4. Value: 개인키 전체 내용 붙여넣기 (BEGIN/END 포함)
5. **Add secret** 클릭

---

## 2. SSH 접속 정보 설정

| Secret Name | Value |
|-------------|-------|
| `SSH_HOST` | `suhak.nodove.com` |
| `SSH_PORT` | `11223` |
| `SSH_USER` | `nodove` |
| `REMOTE_DIR` | `/home/nodove/blog-backend` |
| `PUBLIC_API_BASE_URL` | `https://api.nodove.com` |

각각 동일한 방법으로 추가합니다.

---

## 3. BACKEND_ENV_FILE 설정

`.env` 파일 전체 내용을 Secret으로 저장합니다.

### 필수 환경변수 템플릿

```env
# ===================================
# 기본 서버 설정
# ===================================
APP_ENV=production
HOST=0.0.0.0
PORT=5080
LOG_LEVEL=info

# ===================================
# Cloudflare Tunnel (필수)
# ===================================
# Zero Trust Dashboard에서 터널 생성 후 토큰 복사
# https://one.dash.cloudflare.com/ → Access → Tunnels
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiZjZmMTF...

# ===================================
# CORS 설정
# ===================================
ALLOWED_ORIGINS=https://noblog.nodove.com,https://blog.nodove.com,http://localhost:5173

# ===================================
# VAS (Virtual Agent Service) 설정
# ===================================
# Admin JWT Secret (랜덤 생성: openssl rand -base64 32)
ADMIN_JWT_SECRET=your-secure-random-secret-here

# Admin 계정 (자동 생성용)
ADMIN_EMAIL=admin@nodove.com
ADMIN_PASSWORD=your-admin-password

# ===================================
# Terminal Server 설정
# ===================================
ORIGIN_SECRET_KEY=your-origin-secret-key
SANDBOX_IMAGE=alpine:latest

# ===================================
# GitHub 설정 (Admin PR 생성용)
# ===================================
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_REPO_OWNER=choisimo
GITHUB_REPO_NAME=blog
GIT_USER_NAME=CI Bot
GIT_USER_EMAIL=ci@nodove.com

# ===================================
# Admin 보호 설정
# ===================================
ADMIN_BEARER_TOKEN=your_secure_random_token_here

# ===================================
# AI 기능 설정 (선택사항 - VAS 사용시 불필요)
# ===================================
# Gemini API (VAS로 대체됨, 백업용)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash

# ===================================
# Firebase 설정 (댓글 기능)
# ===================================
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

### GitHub Secret 설정
1. 위 템플릿을 복사하여 실제 값으로 채우기
2. GitHub Repository → **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret** 클릭
4. Name: `BACKEND_ENV_FILE`
5. Value: 완성된 .env 내용 전체 붙여넣기
6. **Add secret** 클릭

---

## 4. Cloudflare Tunnel 토큰 발급

### 터널 생성 방법
1. https://one.dash.cloudflare.com/ 로그인
2. **Access** → **Tunnels** → **Create a tunnel**
3. Tunnel name: `blog-backend` (또는 원하는 이름)
4. **Save tunnel**
5. 토큰 복사 (eyJ...로 시작하는 긴 문자열)

### Public Hostname 설정
터널 설정에서 다음 hostname을 추가:

| Public hostname | Service |
|-----------------|---------|
| `api.nodove.com` | `http://nginx:80` |
| `ai-serve.nodove.com` | `http://vas-core:7012` (선택사항) |

---

## ✅ Backend Secrets 체크리스트

GitHub Repository → **Settings** → **Secrets and variables** → **Actions**에서:

- [ ] `SSH_HOST` = `suhak.nodove.com`
- [ ] `SSH_PORT` = `11223`
- [ ] `SSH_USER` = `nodove`
- [ ] `SSH_PRIVATE_KEY` = (개인키 전체 내용)
- [ ] `REMOTE_DIR` = `/home/nodove/blog-backend`
- [ ] `PUBLIC_API_BASE_URL` = `https://api.nodove.com`
- [ ] `BACKEND_ENV_FILE` = (.env 전체 내용)

---

## 🚀 첫 배포 후 추가 작업

### GitHub Copilot 인증 (VAS 사용시 필수)

배포 완료 후, 원격 서버에서 GitHub Copilot 인증을 해야 합니다:

```bash
ssh -p 11223 nodove@suhak.nodove.com
cd ~/blog-backend
docker compose -f compose.runtime.yml exec vas-core opencode auth login
```

브라우저에서 GitHub 인증 후 터미널에서 완료됩니다.

### 인증 확인
```bash
docker compose -f compose.runtime.yml exec vas-core opencode auth status
```

---

## 🚨 Backend 트러블슈팅

### SSH 연결 실패
**원인**: SSH 키 또는 호스트 설정 오류

**확인**:
```bash
# 로컬에서 테스트
ssh -p 11223 -i ~/.ssh/pmx.ed25519 nodove@suhak.nodove.com "hostname"
```

### VAS Proxy 헬스체크 실패
**원인**: GitHub Copilot 인증 미완료

**해결**: 위의 "GitHub Copilot 인증" 섹션 참조

### Cloudflare Tunnel 연결 안됨
**원인**: 토큰 오류 또는 터널 설정 문제

**확인**:
```bash
ssh -p 11223 nodove@suhak.nodove.com
cd ~/blog-backend
docker compose -f compose.runtime.yml logs cloudflared
```

### 배포 디렉토리 권한 오류
**해결**:
```bash
ssh -p 11223 nodove@suhak.nodove.com "mkdir -p ~/blog-backend && chmod 755 ~/blog-backend"
```

---

## 📚 참고 문서

- [Cloudflare Tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Docker Compose](https://docs.docker.com/compose/)
- [GitHub Actions SSH Deploy](https://github.com/webfactory/ssh-agent)
