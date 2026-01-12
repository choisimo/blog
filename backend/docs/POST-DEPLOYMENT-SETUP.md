# 서버 배포 후 필수 설정 가이드

## 📋 설정 체크리스트 요약

| 순서 | 항목 | 자동화 | 필수여부 |
|------|------|--------|----------|
| 1 | 환경 변수 (.env) 확인 | ✅ GitHub Actions | 필수 |
| 2 | SSL 인증서 확인 | ✅ GitHub Actions | 필수 |
| 3 | n8n 초기 로그인 | ❌ 수동 | 필수 |
| 4 | n8n 환경 변수 설정 | ❌ 수동 | 필수 |
| 5 | n8n 워크플로우 Import | ⚠️ 반자동 | 필수 |
| 6 | n8n 워크플로우 활성화 | ❌ 수동 | 필수 |
| 7 | Blog API 자격증명 설정 | ⚠️ 스크립트 | 선택 |
| 8 | Cloudflare DNS 설정 | ❌ 수동 | 필수 |
| 9 | 헬스체크 확인 | ⚠️ 스크립트 | 필수 |

---

## 1. 환경 변수 확인

### GitHub Secrets 필수 항목

```bash
# 서버에서 확인
cd ~/blog-stack
./scripts/manual-deploy.sh env-check
```

**필수 Secrets (GitHub Repository Settings > Secrets)**:

| Secret | 설명 | 예시 |
|--------|------|------|
| `SSH_HOST` | 서버 IP | `123.45.67.89` |
| `SSH_USER` | SSH 사용자 | `deploy` |
| `SSH_PRIVATE_KEY` | SSH 개인키 | `-----BEGIN OPENSSH...` |
| `POSTGRES_PASSWORD` | PostgreSQL 비밀번호 | 강력한 랜덤 문자열 |
| `REDIS_PASSWORD` | Redis 비밀번호 | 강력한 랜덤 문자열 |
| `JWT_SECRET` | JWT 서명 키 | 32자 이상 랜덤 문자열 |
| `ADMIN_PASSWORD` | 관리자 비밀번호 | 강력한 비밀번호 |
| `N8N_PASS` | n8n 로그인 비밀번호 | 강력한 비밀번호 |
| `N8N_ENCRYPTION_KEY` | n8n 암호화 키 | 정확히 32자 문자열 |
| `SSL_CERT` | SSL 인증서 | Cloudflare Origin 인증서 |
| `SSL_KEY` | SSL 개인키 | Cloudflare Origin 키 |

**선택 Secrets (AI 기능 사용 시)**:

| Secret | 설명 |
|--------|------|
| `OPENAI_API_KEY` | OpenAI API 키 |
| `ANTHROPIC_API_KEY` | Anthropic API 키 |
| `GOOGLE_API_KEY` | Google/Gemini API 키 |

---

## 2. SSL 인증서 설정

### Cloudflare Origin Certificate 발급

1. **Cloudflare Dashboard** → SSL/TLS → Origin Server
2. **Create Certificate** 클릭
3. 설정:
   - Private key type: `RSA (2048)`
   - Hostnames: `*.nodove.com, nodove.com`
   - Certificate Validity: `15 years`
4. 인증서와 키를 GitHub Secrets에 저장:
   - `SSL_CERT`: Certificate 내용
   - `SSL_KEY`: Private Key 내용

### 서버에서 확인

```bash
cd ~/blog-stack
ls -la ssl/
openssl x509 -in ssl/origin.crt -noout -dates
```

---

## 3. n8n 초기 설정 (필수)

### 3.1 첫 로그인

1. **접속**: `https://blog-bw.nodove.com`
2. **로그인**: 
   - Username: `.env`의 `N8N_USER` (기본: `admin`)
   - Password: GitHub Secret `N8N_PASS`

### 3.2 환경 변수 설정 (n8n UI에서)

**Settings → Variables** 에서 다음 변수들 추가:

| Variable Name | 값 | 설명 |
|---------------|-----|------|
| `OPENCODE_BACKEND_URL` | `http://ai-server-backend:7016` | AI 백엔드 URL |
| `OPENCODE_DEFAULT_PROVIDER` | `github-copilot` | 기본 AI Provider |
| `OPENCODE_DEFAULT_MODEL` | `gpt-4.1` | 기본 AI 모델 |
| `BLOG_API_URL` | `http://api:5080` | Blog API URL |
| `CHROMADB_URL` | `http://chromadb:8000` | ChromaDB URL |

> ⚠️ **중요**: 이 변수들은 n8n 워크플로우에서 `$env.VARIABLE_NAME` 형태로 사용됩니다.

### 3.3 워크플로우 Import

**방법 1: n8n UI에서 수동 Import**

1. **Workflows** → **Add workflow** → **Import from File**
2. `~/blog-stack/n8n-workflows/` 폴더의 JSON 파일들 하나씩 Import:
   - `ai-chat.json` - AI 채팅 웹훅
   - `ai-task.json` - AI 태스크 (sketch, prism, chain, summary)
   - `ai-generate.json` - 텍스트 생성
   - `ai-translate.json` - 번역
   - `ai-embeddings.json` - 임베딩 생성
   - `ai-health.json` - AI 헬스체크
   - `ai-vision.json` - 이미지 분석

**방법 2: CLI로 Import**

```bash
cd ~/blog-stack
DC="docker compose"

for workflow in n8n-workflows/*.json; do
  name=$(basename "$workflow" .json)
  echo "Importing: $name"
  $DC exec -T n8n n8n import:workflow --input="/workflows/$(basename $workflow)"
done
```

### 3.4 워크플로우 활성화

각 Import된 워크플로우를 열고:
1. 우상단 **Inactive** 토글을 **Active**로 변경
2. **Save** 클릭

**필수 활성화 워크플로우**:

| 워크플로우 | Webhook Path | 기능 |
|-----------|--------------|------|
| AI Chat Webhook | `/webhook/ai/chat` | AI 채팅 |
| AI Task Webhook | `/webhook/ai/task` | Sketch/Prism/Chain |
| AI Generate Webhook | `/webhook/ai/generate` | 텍스트 생성 |
| AI Health | `/webhook/ai/health` | 헬스체크 |

---

## 4. Blog API 자격증명 설정

n8n에서 Blog API를 호출하려면 HTTP Header Auth 자격증명이 필요합니다.

### 4.1 자동 설정 (스크립트)

```bash
cd ~/blog-stack

# 환경변수 설정
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="<GitHub Secret의 ADMIN_PASSWORD>"
export N8N_USER="admin"
export N8N_PASS="<GitHub Secret의 N8N_PASS>"

# 자격증명 자동 설정
./scripts/setup-api-credentials.sh --all
```

### 4.2 수동 설정 (n8n UI)

1. **Settings** → **Credentials** → **Add credential**
2. **Credential type**: `Header Auth`
3. 설정:
   - **Name**: `Blog API Auth`
   - **Header Name**: `Authorization`
   - **Header Value**: `Bearer <JWT_TOKEN>`

JWT 토큰 얻기:
```bash
curl -X POST http://localhost:5080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}'
```

---

## 5. Cloudflare 설정

### 5.1 DNS 레코드

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `blog-b` | 서버 IP | ✅ Proxied |
| A | `blog-bw` | 서버 IP | ✅ Proxied |

### 5.2 SSL/TLS 설정

- **Encryption mode**: `Full (strict)`
- **Origin Certificate**: 위에서 발급한 인증서 사용

### 5.3 Origin Rules (선택)

포트 8443 사용 시:
1. **Rules** → **Origin Rules**
2. **Create rule**:
   - When: `Hostname equals blog-b.nodove.com`
   - Then: Destination Port → `8443`

---

## 6. 헬스체크 확인

### 서비스 상태 확인

```bash
cd ~/blog-stack
./scripts/manual-deploy.sh health
```

### 개별 엔드포인트 확인

```bash
# API
curl -sf http://localhost:8080/api/v1/healthz && echo "OK"

# n8n
curl -sf http://localhost:5678/healthz && echo "OK"

# n8n Webhook (외부)
curl -sf https://blog-bw.nodove.com/webhook/ai/health

# PostgreSQL
docker compose exec -T postgres pg_isready -U bloguser

# Redis
docker compose exec -T redis redis-cli -a $REDIS_PASSWORD ping
```

### 외부 접속 확인

```bash
# API (Cloudflare 경유)
curl -sf https://blog-b.nodove.com/api/v1/healthz

# n8n (Cloudflare 경유)
curl -sf https://blog-bw.nodove.com/healthz
```

---

## 7. 문제 해결

### n8n 워크플로우 에러

**"환경 변수를 찾을 수 없음"**
```
n8n Settings → Variables에서 OPENCODE_BACKEND_URL 등 설정 확인
```

**"Connection refused to ai-server-backend"**
```bash
# AI 서비스 상태 확인
docker compose ps ai-server-backend noaicode
docker compose logs ai-server-backend --tail 50
```

**"Webhook URL not found"**
```
워크플로우가 Active 상태인지 확인
n8n 재시작: docker compose restart n8n
```

### SSL 에러

**"SSL certificate problem"**
```bash
# 인증서 확인
openssl s_client -connect blog-b.nodove.com:443 -servername blog-b.nodove.com

# 인증서 갱신
# GitHub Actions → sync-backend-env 실행
```

### 포트 충돌

```bash
# 사용 중인 포트 확인
netstat -tlnp | grep -E '(80|443|5678|8080)'

# 컨테이너 재시작
docker compose down
docker compose up -d
```

---

## 8. 정기 유지보수

### 토큰 갱신 (권장: 월 1회)

```bash
cd ~/blog-stack
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="<password>"
export N8N_USER="admin"
export N8N_PASS="<password>"

./scripts/setup-api-credentials.sh --rotate
```

### 로그 정리

```bash
# Docker 로그 정리
docker system prune -f
docker volume prune -f

# 오래된 이미지 정리
./scripts/manual-deploy.sh cleanup
```

### 백업

```bash
# PostgreSQL 백업
docker compose exec -T postgres pg_dump -U bloguser blog > backup_$(date +%Y%m%d).sql

# n8n 워크플로우 Export
# n8n UI → Workflows → 각 워크플로우 → Download
```

---

## 빠른 참조: 배포 후 5분 체크리스트

```bash
# 1. 서비스 상태 확인
cd ~/blog-stack
docker compose ps

# 2. 헬스체크
./scripts/manual-deploy.sh health

# 3. n8n 접속 확인
echo "n8n: https://blog-bw.nodove.com"

# 4. API 확인
curl -sf https://blog-b.nodove.com/api/v1/healthz && echo "API OK"

# 5. 로그 확인 (에러 없는지)
docker compose logs --tail 20 api n8n
```
