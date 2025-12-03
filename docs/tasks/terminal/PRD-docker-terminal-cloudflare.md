# Docker Terminal via Cloudflare Tunnel - Implementation Plan

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  FloatingActionBar.tsx (Shell Commander)                                 │ │
│  │  - 현재: 가상 파일시스템 (VFS)                                            │ │
│  │  - 확장: xterm.js WebSocket 연결                                         │ │
│  │  - 모드 전환: "local" (VFS) ↔ "docker" (실제 컨테이너)                    │ │
│  └────────────────────────────────┬────────────────────────────────────────┘ │
└───────────────────────────────────┼──────────────────────────────────────────┘
                                    │ wss://terminal.nodove.com
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE WORKERS (Security Gateway)                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  workers/terminal-gateway/                                               │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐                 │ │
│  │  │ Auth Layer  │→ │ Rate Limiter │→ │ Secret Injector │                 │ │
│  │  │ (JWT/Token) │  │ (KV-based)   │  │ (X-Origin-Key)  │                 │ │
│  │  └─────────────┘  └──────────────┘  └────────┬────────┘                 │ │
│  └──────────────────────────────────────────────┼──────────────────────────┘ │
└─────────────────────────────────────────────────┼────────────────────────────┘
                                                  │ Cloudflare Tunnel
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         ORIGIN SERVER (Home/VPS)                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  backend/terminal-server/ (Node.js + ws + node-pty)                      │ │
│  │  - Secret Key 검증                                                       │ │
│  │  - Docker 컨테이너 생성/관리                                              │ │
│  │  - WebSocket ↔ PTY 브릿지                                                │ │
│  └────────────────────────────────┬────────────────────────────────────────┘ │
│                                   │ docker run                               │
│                                   ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Sandboxed Container (per user session)                                  │ │
│  │  - Alpine Linux                                                          │ │
│  │  - --network none (외부 접근 차단)                                        │ │
│  │  - --cpus 0.5 --memory 128m (리소스 제한)                                │ │
│  │  - 10분 타임아웃 후 자동 삭제                                             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Implementation Phases

### Phase 1: Cloudflare Infrastructure Setup
**Cloudflare MCP로 확인/생성할 리소스**

| Resource | Purpose | MCP Command |
|----------|---------|-------------|
| Workers KV | Rate limiting, session tracking | `kv_namespace_create` |
| Durable Objects | WebSocket 세션 관리 (Optional) | Workers 코드에서 선언 |
| Tunnel | Origin 연결 | `cloudflared tunnel create` (CLI) |
| DNS Record | terminal.nodove.com | `dns_record_create` |

**체크리스트:**
- [ ] 기존 KV namespace 확인 (`blog-kv`)
- [ ] 새 tunnel 생성 여부 (기존 `blog-api` 재사용 가능)
- [ ] DNS 레코드 추가: `terminal.nodove.com` → Tunnel

### Phase 2: Terminal Gateway Worker
**파일 구조:**
```
workers/
├── terminal-gateway/
│   ├── src/
│   │   ├── index.ts          # WebSocket 업그레이드 핸들링
│   │   ├── auth.ts           # JWT/토큰 검증
│   │   ├── ratelimit.ts      # KV 기반 속도 제한
│   │   └── types.ts
│   ├── wrangler.toml
│   └── package.json
```

**핵심 코드 (index.ts):**
```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 1. WebSocket 업그레이드 요청 확인
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    // 2. 인증 (쿼리 파라미터 또는 쿠키에서 토큰)
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const user = await verifyToken(token, env);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 3. Rate Limiting
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitOk = await checkRateLimit(clientIP, env.KV);
    if (!rateLimitOk) {
      return new Response('Too Many Requests', { status: 429 });
    }

    // 4. Origin으로 프록시 (Secret Key 주입)
    const originUrl = `${env.TERMINAL_ORIGIN}/terminal`;
    const originRequest = new Request(originUrl, request);
    originRequest.headers.set('X-Origin-Secret', env.ORIGIN_SECRET_KEY);
    originRequest.headers.set('X-User-ID', user.id);
    originRequest.headers.set('X-Client-IP', clientIP);

    return fetch(originRequest);
  }
};
```

### Phase 3: Origin Terminal Server
**파일 구조:**
```
backend/
├── terminal-server/
│   ├── src/
│   │   ├── index.ts          # HTTP + WebSocket 서버
│   │   ├── docker.ts         # Docker 컨테이너 관리
│   │   ├── pty-bridge.ts     # node-pty ↔ WebSocket
│   │   └── session.ts        # 세션 타임아웃 관리
│   ├── Dockerfile            # 서버용 (node-pty 빌드 필요)
│   ├── sandbox/
│   │   └── Dockerfile        # 사용자 컨테이너 이미지
│   └── package.json
```

**핵심 코드 (index.ts):**
```typescript
import { WebSocketServer } from 'ws';
import { spawn } from 'node-pty';
import http from 'http';

const EXPECTED_SECRET = process.env.ORIGIN_SECRET_KEY;
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10분

const server = http.createServer();
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  // Secret 검증
  const secret = req.headers['x-origin-secret'];
  if (secret !== EXPECTED_SECRET) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws, req) => {
  const userId = req.headers['x-user-id'] as string;
  
  // Docker 컨테이너 생성
  const containerName = `terminal-${userId}-${Date.now()}`;
  const term = spawn('docker', [
    'run', '-it', '--rm',
    '--name', containerName,
    '--network', 'none',
    '--cpus', '0.5',
    '--memory', '128m',
    '--pids-limit', '50',
    'blog-terminal-sandbox', '/bin/sh'
  ], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
  });

  // 타임아웃 설정
  const timeout = setTimeout(() => {
    ws.send('\r\n\x1b[31m[Session timeout - disconnecting...]\x1b[0m\r\n');
    term.kill();
    ws.close();
  }, SESSION_TIMEOUT);

  // 양방향 데이터 파이프
  term.onData((data) => ws.send(data));
  ws.on('message', (msg) => term.write(msg.toString()));

  ws.on('close', () => {
    clearTimeout(timeout);
    term.kill();
    // 컨테이너 강제 삭제 (혹시 남아있으면)
    spawn('docker', ['rm', '-f', containerName]);
  });
});

server.listen(8080);
```

### Phase 4: Frontend Integration
**기존 FloatingActionBar.tsx 확장:**

```typescript
// 새 모드 추가
type ShellMode = 'local' | 'docker';

// xterm.js 통합 훅
function useDockerTerminal(enabled: boolean) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled || !terminalRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1a1a2e',
        foreground: '#eee',
        cursor: '#0ff',
      },
    });
    terminal.open(terminalRef.current);
    xtermRef.current = terminal;

    // WebSocket 연결
    const token = getAuthToken(); // 인증 토큰 가져오기
    const ws = new WebSocket(`wss://terminal.nodove.com?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (e) => terminal.write(e.data);
    terminal.onData((data) => ws.send(data));

    return () => {
      ws.close();
      terminal.dispose();
    };
  }, [enabled]);

  return { terminalRef };
}
```

### Phase 5: Cloudflare Tunnel Configuration
**업데이트된 `cloudflared-config.yml`:**

```yaml
tunnel: blog-api  # 기존 터널 재사용

ingress:
  # 기존 서비스들...
  - hostname: tei.yourdomain.com
    service: http://embedding-server:80
  - hostname: api.yourdomain.com
    service: http://opencode-serve:7012

  # 새 터미널 서비스
  - hostname: terminal.nodove.com
    service: http://localhost:8080
    originRequest:
      noTLSVerify: true
      # WebSocket 지원 활성화
      http2Origin: false
      connectTimeout: 30s
      noHappyEyeballs: true

  - service: http_status:404
```

---

## 3. Security Measures

### 3.1 Worker Level (Cloudflare)
| Layer | Implementation |
|-------|----------------|
| **Authentication** | JWT 토큰 검증 (blog-api와 동일한 secret 사용) |
| **Rate Limiting** | IP당 분당 5개 연결, 동시 1개 세션 |
| **Geo-Blocking** | (선택) 특정 국가 차단 |
| **Bot Detection** | CF Bot Management score 활용 |

### 3.2 Origin Level (Node.js)
| Layer | Implementation |
|-------|----------------|
| **Secret Verification** | X-Origin-Secret 헤더 필수 |
| **Session Limit** | 사용자당 1개 세션 |
| **Container Isolation** | --network none, 리소스 제한 |
| **Timeout** | 10분 자동 종료 |

### 3.3 Container Level (Docker)
| Restriction | Flag |
|-------------|------|
| 네트워크 차단 | `--network none` |
| CPU 제한 | `--cpus 0.5` |
| 메모리 제한 | `--memory 128m` |
| 프로세스 제한 | `--pids-limit 50` |
| 읽기 전용 rootfs | `--read-only` (선택) |
| non-root 사용자 | `USER nobody` in Dockerfile |

---

## 4. Cloudflare MCP Verification Steps

### Step 1: 현재 리소스 확인
```bash
# MCP를 통해 실행 (opencode에서)
# 또는 wrangler CLI 직접 사용

# KV 네임스페이스 목록
wrangler kv:namespace list

# 현재 Workers 목록  
wrangler deployments list

# Tunnel 목록
cloudflared tunnel list
```

### Step 2: 필요한 리소스 생성
```bash
# 1. Terminal Gateway Worker용 KV (rate limiting)
wrangler kv:namespace create "TERMINAL_SESSIONS"

# 2. DNS 레코드 (Cloudflare Dashboard 또는 API)
# terminal.nodove.com -> CNAME -> <tunnel-id>.cfargotunnel.com

# 3. Tunnel 설정 업데이트
# cloudflared-config.yml에 terminal hostname 추가 후
cloudflared tunnel ingress update
```

### Step 3: Secrets 설정
```bash
# Terminal Gateway Worker에 secrets 추가
cd workers/terminal-gateway
wrangler secret put ORIGIN_SECRET_KEY
wrangler secret put JWT_SECRET
```

---

## 5. File Structure (Final)

```
blog-1120/
├── workers/
│   ├── terminal-gateway/          # NEW: WebSocket 게이트웨이
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── auth.ts
│   │   │   └── ratelimit.ts
│   │   ├── wrangler.toml
│   │   └── package.json
│   └── ... (기존 workers)
│
├── backend/
│   ├── terminal-server/           # NEW: Origin 터미널 서버
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── docker.ts
│   │   │   └── pty-bridge.ts
│   │   ├── Dockerfile
│   │   ├── sandbox/
│   │   │   └── Dockerfile         # 샌드박스 컨테이너 이미지
│   │   └── package.json
│   ├── deploy/
│   │   └── cloudflared-config.yml # UPDATED: terminal hostname 추가
│   └── ... (기존 backend)
│
└── frontend/
    └── src/
        └── components/
            └── features/
                └── terminal/      # NEW: xterm.js 통합
                    ├── DockerTerminal.tsx
                    └── useDockerTerminal.ts
```

---

## 6. Implementation Checklist

### Cloudflare Setup
- [ ] KV namespace 생성 (TERMINAL_SESSIONS)
- [ ] DNS 레코드 추가 (terminal.nodove.com)
- [ ] Tunnel ingress 설정 업데이트
- [ ] Worker secrets 설정

### Worker Development
- [ ] terminal-gateway Worker 생성
- [ ] JWT 인증 로직 구현
- [ ] Rate limiting 구현
- [ ] WebSocket 프록시 로직

### Origin Server Development  
- [ ] terminal-server Node.js 앱 생성
- [ ] Docker 컨테이너 관리 로직
- [ ] node-pty 통합
- [ ] 세션 타임아웃 관리
- [ ] Sandbox Dockerfile 작성

### Frontend Integration
- [ ] xterm.js 패키지 추가
- [ ] DockerTerminal 컴포넌트 생성
- [ ] FloatingActionBar에 모드 전환 UI 추가
- [ ] 연결 상태 표시 (connecting/connected/disconnected)

### Deployment
- [ ] Sandbox 이미지 빌드 및 Origin에 배포
- [ ] terminal-server 시스템 서비스 등록
- [ ] cloudflared tunnel 재시작
- [ ] terminal-gateway Worker 배포
- [ ] E2E 테스트

---

## 7. Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Cloudflare Setup | 1-2 hours | Cloudflare 계정 접근 |
| Phase 2: Gateway Worker | 3-4 hours | Phase 1 완료 |
| Phase 3: Origin Server | 4-6 hours | Docker 환경 |
| Phase 4: Frontend | 2-3 hours | Phase 2, 3 완료 |
| Phase 5: Tunnel Config | 1 hour | cloudflared 설치됨 |
| Testing & Debug | 2-4 hours | 전체 완료 |

**Total: ~15-20 hours**

---

## 8. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Container escape | AppArmor/seccomp 프로파일 적용 |
| Resource exhaustion | Cgroup 제한 + 자동 정리 cron |
| WebSocket 연결 끊김 | Heartbeat + 자동 재연결 |
| Origin 서버 다운 | Cloudflare에서 503 반환, 프론트엔드에서 우아한 폴백 |
