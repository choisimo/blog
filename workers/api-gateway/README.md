# Cloudflare Workers API Gateway

이 Worker는 백엔드 API에 대한 프록시로 작동하며, Cloudflare Tunnel 대신 사용됩니다.

## 아키텍처

```
┌─────────────────┐
│ Cloudflare      │
│ Workers        │
│ (API Gateway)  │
└────────┬────────┘
         │ HTTPS (Custom Domain)
         ▼
┌─────────────────┐
│ Server Nginx    │
│ :8080           │
└────────┬────────┘
         │ Docker Network
    ┌────┼────┬────┬────┐
    ▼    ▼    ▼    ▼
  api  litellm  terminal  etc
```

## 설정

### 1. Worker 환경 변수 설정

```bash
cd workers/api-gateway

# 백엔드 서버 Origin 설정 (시크릿)
npx wrangler secret put BACKEND_ORIGIN
# Enter: http://YOUR_SERVER_PUBLIC_IP:8080
```

### 2. wrangler.toml 확인

```toml
[vars]
ALLOWED_ORIGINS = "https://noblog.nodove.com,https://nodove.com,http://localhost:5173"
```

### 3. 배포

```bash
npm install
npx wrangler deploy
# 또는 production 환경:
npx wrangler deploy --env production
```

## 서버 설정

### 1. Nginx 포트 변경 (80 → 8080)

`backend/nginx.conf`에서:

```nginx
server {
    listen 8080;  # 80에서 8080으로 변경
    server_name _;  # server_name 제거 (Workers가 Host 헤더 설정)
    # ... 나머지 설정 유지
}
```

### 2. 방화벽 설정 (Cloudflare IP만 허용)

```bash
# Cloudflare IP ranges 가져오기
curl -s https://www.cloudflare.com/ips-v4 > /tmp/cloudflare-ips.txt

# 방화벽 규칙 추가 (firewalld)
for ip in $(cat /tmp/cloudflare-ips.txt); do
  sudo firewall-cmd --permanent --add-rich-rule="rule family='ipv4' source address='$ip' port protocol='tcp' port='8080' accept"
done

sudo firewall-cmd --reload
```

또는 ufw 사용 시:

```bash
for ip in $(cat /tmp/cloudflare-ips.txt); do
  sudo ufw allow from $ip to any port 8080 proto tcp
done
```

### 3. Docker Compose 포트 노출

`compose.runtime.yml`에서 nginx 포트 변경:

```yaml
nginx:
  ports:
    - "0.0.0.0:8080:80"  # 호스트 8080 포트에 노출
```

### 4. Cloudflare 터널 제거

```bash
ssh [SSH_USER]@[SSH_HOST]
cd [REMOTE_DIR]

# 터널 컨테이너 제거
docker compose -f compose.runtime.yml down cloudflared
docker compose -f compose.runtime.yml up -d --remove-orphans
```

## GitHub Actions 업데이트

`.github/workflows/backend-deploy.yml`에서 터널 관련 부분 제거:

```yaml
# Cloudflare Tunnel 컨테이너 제거
# cloudflared:
#   image: cloudflare/cloudflared:latest
#   ...
```

## 장점

✅ **터널 데몬 불필요** - 서버 리소스 절약  
✅ **단일 진입점** - Workers에서 모든 요청 처리  
✅ **추가 기능** - Workers에서 인증, 속도 제한, 캐싱 가능  
✅ **더 나은 디버깅** - Workers 로그와 서버 로그 분리  
✅ **단순화된 아키텍처** - 복잡한 Ingress Rules 제거

## 테스트

```bash
# Workers 테스트
curl https://api.nodove.com/api/v1/healthz

# CORS 테스트
curl -H "Origin: https://noblog.nodove.com" \
  -I https://api.nodove.com/api/v1/healthz
```

## 문제 해결

### CORS 에러

Worker의 `ALLOWED_ORIGINS` 변수에 정확한 도메인 설정:

```bash
npx wrangler secret put ALLOWED_ORIGINS
# https://noblog.nodove.com,https://nodove.com
```

### 서버 접속 불가

방화벽에서 Cloudflare IP 허용 확인:

```bash
sudo firewall-cmd --list-all
```

### Workers 로그 확인

```bash
npx wrangler tail
```
