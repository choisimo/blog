# PRD: GitHub Pages 정적 블로그(프론트엔드)와 로컬 Ubuntu 백엔드 연동

버전: 1.0  
작성일: 2025-09-22  
대상 리포지토리: `choisimo/blog`

본 PRD는 개발 지식이 없는 사용자도 따라 할 수 있도록, GitHub Pages로 배포된 정적 블로그(`frontend/`)와 로컬 Ubuntu 서버에서 구동되는 백엔드(`backend/`)를 안전하고 간단하게 연동하는 방법을 정의합니다. 이 문서는 저장소의 현 구조와 파이프라인을 그대로 활용하며, 필수 환경값과 단계별 절차를 상세히 안내합니다.

참고 소스:
- GitHub Actions: `.github/workflows/deploy.yml` (Pages 배포, `VITE_API_BASE_URL` 주입)
- 아키텍처: `docs/ARCHITECTURE.md` (런타임 백엔드 디스커버리, 엔드포인트)
- 백엔드 라우트: `backend/src/routes/admin.js` (PR/아카이브)
- 패키지: `backend/package.json` (Node 20+)

---

## 1. 배경 및 요약

- 정적 블로그는 GitHub Pages로 호스팅됩니다.
- 동적 기능(댓글, AI, OG 이미지, Admin PR 생성)은 단일 백엔드(`backend/`)가 제공합니다.
- 프론트엔드는 빌드 시 또는 런타임에 백엔드 베이스 URL을 주입받아 `/api/v1/*`로 호출합니다.
- 비개발자도 쉽게 연결할 수 있도록 2가지 설치 경로를 제공합니다.
  - 빠른 연결(Cloudflare Tunnel): 공인 IP/포트 개방 없이 안전하게 외부 공개
  - 표준 설치(Nginx + systemd + TLS): 도메인, 인증서, 역프록시 구성

---

## 2. 목표와 비목표

- 목표
  - 비개발자도 30~60분 내 연동 완료
  - 코드 수정 없이 환경 설정만으로 연결
  - HTTPS 종단 보안, 기본 속도/안정성, 운영 가이드 포함
- 비목표
  - SSR/서버 사이드 렌더링 전환
  - 멀티테넌시/다중 백엔드 오케스트레이션
  - 대규모 실시간 기능(웹소켓 등)

---

## 3. 핵심 지표

- 첫 설치 리드타임: 60분 이내(Cloudflare Tunnel 경로는 30분 이내)
- 필수 설정 개수: 5개 이하(도메인, GitHub Secret, 백엔드 .env)
- 핵심 경로 성공률: 댓글 쓰기/읽기 100%, Admin PR 생성 95%+

---

## 4. 대상 사용자/페르소나

- 비개발 운영자: UI/명령 복사-붙여넣기 정도로 운영 가능
- 개발자/DevOps: 세부 튜닝(Nginx, systemd, TLS, 방화벽)을 원하는 사용자

---

## 5. 아키텍처 개요

- 저장소 구조 요약(`docs/ARCHITECTURE.md`와 일치)
  - 프론트엔드: `frontend/` → GitHub Pages에 `frontend/dist/` 배포
  - 백엔드: `backend/` → Express API `/api/v1/*`
- 런타임 백엔드 디스커버리(`frontend/src/utils/apiBase.ts#getApiBaseUrl()`):
  1) `window.APP_CONFIG.apiBaseUrl` (빌드 시 `index.html`에 주입)  
  2) `import.meta.env.VITE_API_BASE_URL`  
  3) `localStorage['aiMemo.backendUrl']` (개발용 오버라이드)

```mermaid
flowchart LR
  A[사용자 브라우저] -->|https://noblog.nodove.com| B[GitHub Pages (frontend/dist)]
  B -->|JS 실행 & API 호출| C{getApiBaseUrl()}
  C -->|1. window.APP_CONFIG.apiBaseUrl| D[백엔드 HTTPS 도메인]
  C -->|2. VITE_API_BASE_URL| D
  C -->|3. localStorage override| D
  D -->|/api/v1/*| E[Ubuntu 로컬 서버의 Express(backend)]
  F[GitHub Actions] -->|빌드 시 VITE_API_BASE_URL 주입| B
```

---

## 6. 기능 요구사항(Functional)

- 프론트엔드가 백엔드 베이스 URL을 자동 인식해 `/api/v1/*` 호출
- 댓글 API
  - `GET /api/v1/comments?postId=...`
  - `POST /api/v1/comments {postId, author, content, website?}`
- AI/OG/헬스/공개설정
  - `GET /api/v1/healthz`, `GET /api/v1/public/config`, `GET /api/v1/og`, `POST /api/v1/ai/*`
- Admin 기능(보호됨)
  - `POST /api/v1/admin/propose-new-version` → `frontend/public/posts/...` 경로에 브랜치 생성+PR
  - `POST /api/v1/admin/archive-comments` → `frontend/src/data/comments/*.json` 커밋
- GitHub Actions가 `VITE_API_BASE_URL`을 `index.html`에 주입해 배포

---

## 7. 비기능 요구사항(Non-Functional)

- 성능: API 평균 응답 500ms 이하, 95%tile 1s 이하
- 보안: HTTPS 필수, CORS 화이트리스트, Admin Bearer Token 보호
- 신뢰성: 백엔드 프로세스 자동 재시작(systemd/pm2), 로그 보존
- 운영성: 헬스 체크 엔드포인트, 간단한 트러블슈팅 가이드 제공

---

## 8. 의존성/가정

- 프론트엔드 도메인: `https://noblog.nodove.com` (Pages, `.github/workflows/deploy.yml`의 `SITE_BASE_URL`/`VITE_SITE_BASE_URL`)
- 백엔드 Node 런타임: Node 20 이상(`backend/package.json: engines.node: >=20.0.0`)
- 백엔드 .env: `backend/.env.example` 기준으로 설정
- GitHub Actions: `.github/workflows/deploy.yml`에서 `VITE_API_BASE_URL`을 Secret으로 전달

---

## 9. 설정 개요

- GitHub Actions Secret
  - 이름: `VITE_API_BASE_URL`
  - 값: 백엔드의 공개 HTTPS 베이스 URL (예: `https://api.nodove.com`) — 끝에 슬래시 없음
- 백엔드 `.env` (샘플)
```
APP_ENV=production
HOST=0.0.0.0
PORT=5080
ALLOWED_ORIGINS=https://noblog.nodove.com,http://localhost:5173

# Admin/PR 관련
GITHUB_TOKEN=ghp_xxx   # repo 권한 필요
GITHUB_REPO_OWNER=<깃헙오너>
GITHUB_REPO_NAME=<깃헙리포>
GIT_USER_NAME=<커밋 사용자명>
GIT_USER_EMAIL=<커밋 이메일>
ADMIN_BEARER_TOKEN=<강력한 랜덤값>

# (선택) AI/파이어베이스
GEMINI_API_KEY=...
FIREBASE_SERVICE_ACCOUNT_JSON=...
FIREBASE_PROJECT_ID=...
```

---

## 10. 설치 경로 A — 빠른 연결(Cloudflare Tunnel, 비개발자 권장)

- 개요: 공인 IP/포트 개방 없이 로컬 백엔드를 퍼블릭 HTTPS로 노출
- 준비물
  - Cloudflare 계정(+관리 중인 도메인 권장). 도메인이 없다면 터널 전용 임시 호스트를 사용할 수도 있음
  - Ubuntu 서버(백엔드 실행용)

- 단계
  1) 백엔드 실행 준비
     - Node 20 설치(권장: NodeSource)
       ```bash
       curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
       sudo apt-get install -y nodejs
       node -v
       ```
     - 저장소 클론 및 의존성 설치
       ```bash
       # 예: /home/ubuntu/workspace/blog
       npm --prefix backend install
       cp backend/.env.example backend/.env
       nano backend/.env   # 위 샘플에 맞춰 값 채우기
       ```
     - 프로세스 실행(초보자용 pm2)
       ```bash
       sudo npm i -g pm2
       pm2 start npm --prefix backend --name blog-api -- start
       pm2 save
       pm2 startup systemd
       ```
       - 헬스 체크: `curl http://127.0.0.1:5080/api/v1/healthz`

  2) Cloudflared 설치 및 인증
     ```bash
     curl -fsSL https://pkg.cloudflare.com/install.sh | sudo bash
     sudo apt-get install -y cloudflared
     cloudflared --version
     cloudflared tunnel login  # 브라우저에서 Cloudflare 계정 인증
     ```

  3) 터널 생성 및 도메인 연결
     ```bash
     cloudflared tunnel create blog-api
     cloudflared tunnel list
     # 도메인을 보유한 경우:
     cloudflared tunnel route dns blog-api api.yourdomain.com
     ```
     - 설정파일 작성(`/etc/cloudflared/config.yml`)
       ```yaml
       sudo tee /etc/cloudflared/config.yml >/dev/null <<'EOF'
       tunnel: blog-api
       credentials-file: /etc/cloudflared/<터널-uuid>.json
       ingress:
         - hostname: api.yourdomain.com
           service: http://localhost:5080
         - service: http_status:404
       EOF
       ```
     - 서비스로 실행
       ```bash
       sudo systemctl enable cloudflared
       sudo systemctl restart cloudflared
       systemctl status cloudflared
       ```

  4) GitHub Actions Secret 설정
     - 리포지토리 > Settings > Secrets and variables > Actions > New repository secret
       - Name: `VITE_API_BASE_URL`
       - Value: `https://api.yourdomain.com`

  5) 배포 트리거
     - `main`에 푸시 혹은 수동 재실행 → `.github/workflows/deploy.yml`이 `frontend/` 빌드 및 Pages 배포
     - 완료 시 정적 사이트가 `VITE_API_BASE_URL`을 주입받아 `/api/v1/*`를 터널로 호출

- 검증
  - 프론트엔드 도메인에서 개발자도구 네트워크 탭으로 `/api/v1/healthz` 200 확인
  - 댓글 작성/조회 정상 동작
  - Admin PR 생성은 `Authorization: Bearer <ADMIN_BEARER_TOKEN>`로 호출 후 PR URL 반환 확인

---

## 11. 설치 경로 B — 표준 설치(Nginx + systemd + TLS)

- 준비물
  - 고정 FQDN(예: `api.nodove.com`)의 DNS A레코드 → Ubuntu 서버
  - Ubuntu 방화벽(UFW)에서 80/443 허용

- 단계
  1) 백엔드 실행(위 10-1 동일: Node 20, `.env`, `pm2` 또는 `systemd`)
     - systemd 예시(`/etc/systemd/system/blog-backend.service`)
       ```ini
       [Unit]
       Description=Blog Backend (Express)
       After=network.target

       [Service]
       WorkingDirectory=/home/ubuntu/workspace/blog/backend
       EnvironmentFile=/home/ubuntu/workspace/blog/backend/.env
       ExecStart=/usr/bin/node /home/ubuntu/workspace/blog/backend/src/index.js
       Restart=always
       RestartSec=5
       User=ubuntu
       KillSignal=SIGINT

       [Install]
       WantedBy=multi-user.target
       ```
       ```bash
       sudo systemctl daemon-reload
       sudo systemctl enable --now blog-backend
       systemctl status blog-backend
       ```

  2) Nginx 설치 및 리버스 프록시
     ```bash
     sudo apt-get update && sudo apt-get install -y nginx
     sudo nano /etc/nginx/sites-available/blog-api
     ```
     - 서버블록(예시)
       ```nginx
       server {
         listen 80;
         server_name api.nodove.com;

         location /api/ {
           proxy_pass         http://127.0.0.1:5080;
           proxy_http_version 1.1;
           proxy_set_header   Host $host;
           proxy_set_header   X-Real-IP $remote_addr;
           proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header   X-Forwarded-Proto $scheme;
         }
       }
       ```
       ```bash
       sudo ln -s /etc/nginx/sites-available/blog-api /etc/nginx/sites-enabled/blog-api
       sudo nginx -t
       sudo systemctl reload nginx
       ```

  3) TLS 발급/설치(자동 리다이렉트)
     ```bash
     sudo apt-get install -y certbot python3-certbot-nginx
     sudo certbot --nginx -d api.nodove.com --redirect
     ```
     - 이후 백엔드 `.env`의 `ALLOWED_ORIGINS`에 `https://noblog.nodove.com` 포함 확인

  4) GitHub Actions Secret 설정(동일)
     - `VITE_API_BASE_URL = https://api.nodove.com`

  5) 배포 및 검증(동일)

---

## 12. 보안 체크리스트

- CORS: `ALLOWED_ORIGINS`에 프론트엔드 도메인 포함  
  예: `https://noblog.nodove.com,http://localhost:5173`
- Admin 보호: `ADMIN_BEARER_TOKEN` 필수 설정 → `backend/src/middleware/adminAuth.js` 사용
- 레이트리밋/헬멧: 기본 활성(`backend/src/index.js`), 민감 엔드포인트에 강화 권장
- GitHub 토큰: `GITHUB_TOKEN`은 `repo` 권한 필요. 최소 권한 원칙 적용
- TLS: 반드시 HTTPS 종단 사용(Cloudflare Tunnel 또는 Nginx+Certbot)
- 방화벽: 443 외 외부 포트 차단(UFW), 백엔드 5080은 내부/로컬 전용

---

## 13. 운영/검증/수락 기준

- 수락 기준
  - 프론트엔드에서 `/api/v1/healthz`가 200 응답
  - 댓글 작성 후 목록에서 반영 확인
  - Admin PR 생성 시 GitHub PR 링크 반환
  - GH Actions가 `frontend/dist`를 Pages에 배포하며 `doc-converter` 서브앱 포함
- 운영 점검
  - 백엔드 로그(morgan/systemd/pm2) 확인
  - 실패시 재시작(systemd/pm2)
- 간단 검증 명령
  ```bash
  # 백엔드 로컬
  curl -s http://127.0.0.1:5080/api/v1/healthz
  # 퍼블릭(도메인)
  curl -s https://api.yourdomain.com/api/v1/healthz
  ```

---

## 14. 트러블슈팅

- CORS 오류
  - 증상: 브라우저 콘솔에 CORS 관련 에러
  - 조치: `.env` `ALLOWED_ORIGINS`에 프론트엔드 도메인 추가 후 재시작
- Mixed Content
  - 증상: HTTPS 페이지에서 HTTP API 호출 차단
  - 조치: `VITE_API_BASE_URL`을 HTTPS로 설정
- 401/403 Admin 호출 실패
  - 조치: `Authorization: Bearer <ADMIN_BEARER_TOKEN>` 헤더 확인 및 토큰 재설정
- PR 생성 실패(422/403)
  - 조치: `GITHUB_TOKEN` 권한, `GITHUB_REPO_OWNER/NAME` 정확성, 기본 브랜치 권한 확인
- 404/500 API
  - 조치: 백엔드 로그 확인, `.env` 필수값 점검, 헬스 체크로 기동 여부 확인
- GH Pages가 백엔드 URL을 모를 때
  - 조치: 리포 `VITE_API_BASE_URL` Secret 값 설정/수정 후 재배포

---

## 15. 운영 팁

- 개발/테스트 시 로컬 오버라이드
  - 브라우저 콘솔:
    ```javascript
    localStorage.setItem('aiMemo.backendUrl', 'http://localhost:5080');
    location.reload();
    ```
- 아카이브 스케줄링
  - 외부 스케줄러에서 `POST /api/v1/admin/archive-comments` 호출(보호 필요)
- 로그/모니터링
  - `journalctl -u blog-backend -f`, `pm2 logs blog-api`
- 백엔드 업그레이드
  ```bash
  git pull
  npm --prefix backend ci
  sudo systemctl restart blog-backend   # or pm2 restart blog-api
  ```

---

## 16. 위험요인 및 대응

- 잘못된 도메인/Secret 값 → 배포는 성공하나 API 실패
  - 대응: 배포 전 값 검증 체크리스트 수행
- Cloudflare Tunnel 인증 만료/중단
  - 대응: `systemctl status cloudflared` 주기 점검, 대안 경로(B 경로) 준비
- GitHub 권한 변화로 PR 실패
  - 대응: 토큰 회전/권한 재설정 플레이북 준비

---

## 17. 개방 이슈(Open Questions)

- 백엔드 Docker 운영 표준화 필요 여부(`backend/docker-compose.yml` 사용 가이드화)
- 로그/알림(예: Telegram/Slack) 연동 기준
- 댓글 데이터 보존/백업 방식 표준

---

## 18. 부록: 설정 스니펫 모음

- GitHub Actions(`.github/workflows/deploy.yml`)에서의 환경 주입
  - `env.VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}`
- `index.html` 런타임 주입(`docs/ARCHITECTURE.md` 인용)
  ```html
  <script type="module">
    window.APP_CONFIG = Object.assign({}, window.APP_CONFIG || {}, {
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL || null,
    });
  </script>
  ```
- Nginx TLS 자동 리다이렉트: `certbot --nginx --redirect`

---

## 19. 적용 순서 요약(체크리스트)

- [ ] 백엔드 서버에 Node 20 설치 및 `backend/.env` 채우기  
- [ ] 백엔드 실행(pm2 또는 systemd) 후 `healthz` 200 확인  
- [ ] A(Cloudflare Tunnel) 또는 B(Nginx+TLS)로 퍼블릭 도메인 확보  
- [ ] 리포에 `VITE_API_BASE_URL` Secret 등록(예: `https://api.example.com`)  
- [ ] `main`에 푸시하여 Pages 재배포  
- [ ] 프론트엔드 → API 호출 정상 동작 확인(댓글/AI/Admin)

---

## 20. 관련 파일 및 스크립트

실제 설정 파일과 스크립트는 다음 위치에서 찾을 수 있습니다:

- 백엔드 프로덕션 설정 예시: `backend/.env.production.example`
- PM2 설정: `backend/ecosystem.config.js`
- systemd 서비스: `backend/deploy/blog-backend.service`
- Nginx 설정: `backend/deploy/nginx-blog-api.conf`
- Cloudflare Tunnel 설정: `backend/deploy/cloudflared-config.yml`
- 빠른 설치 스크립트: `backend/scripts/setup.sh`
- 백엔드 README: `backend/README.md`
