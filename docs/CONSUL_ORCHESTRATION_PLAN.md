# Consul KV 기반 서비스 오케스트레이션 계획안

## 1. 현황 분석

### 1.1 현재 문제점

| 문제 | 영향 | 예시 |
|------|------|------|
| **URL 하드코딩** | 서비스 주소 변경 시 다수 파일 수정 필요 | `ai-gateway:7000`, `chromadb:8000` 등 10+ 위치 |
| **환경변수 분산** | 각 서비스별 `.env`, `wrangler.toml` 개별 관리 | Backend 30+, Workers 10+ 환경변수 |
| **설정 동기화 어려움** | 서비스 간 설정 불일치 발생 가능 | CORS origins, JWT secrets 등 |
| **스케일링 복잡성** | 새 인스턴스 추가 시 수동 설정 필요 | AI 서버 수평 확장 시 |

### 1.2 현재 서비스 토폴로지

```
┌─────────────────────────────────────────────────────────────────┐
│                    Edge Layer (Cloudflare)                      │
├─────────────────────────────────────────────────────────────────┤
│  api.nodove.com     │ assets-b.nodove.com │ terminal.nodove.com │
│  (API Gateway)      │ (R2 Gateway)        │ (Terminal Gateway)  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    Cloudflare Tunnel
                              │
┌─────────────────────────────────────────────────────────────────┐
│                  Origin Server (Docker Stack)                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌────────────────────┐│
│  │ Backend │  │   n8n   │  │ Terminal │  │    AI Stack        ││
│  │  :5080  │  │  :5678  │  │  :8080   │  │ Gateway→Backend→   ││
│  └────┬────┘  └────┬────┘  └──────────┘  │ Serve :7000→7016→  ││
│       │            │                      │ 7012               ││
│       └────────────┴──────────────────────┴────────────────────┤│
│                              │                                  │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐         │
│  │Postgres │  │  Redis  │  │ ChromaDB │  │   TEI    │         │
│  │  :5432  │  │  :6379  │  │  :8000   │  │   :80    │         │
│  └─────────┘  └─────────┘  └──────────┘  └──────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Consul 기반 목표 아키텍처

### 2.1 설계 원칙

1. **Single Source of Truth**: 모든 설정은 Consul KV에서 관리
2. **서비스 디스커버리**: 서비스 등록/해제 자동화
3. **헬스체크 통합**: 서비스 상태 기반 라우팅
4. **환경별 분리**: dev/staging/production 네임스페이스
5. **보안**: ACL 기반 접근 제어, Vault 연동 (민감 정보)

### 2.2 목표 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Consul Cluster                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        Consul Server                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│  │  │   KV Store   │  │   Service    │  │   Health Checks      │  │   │
│  │  │              │  │   Catalog    │  │                      │  │   │
│  │  │ /blog/       │  │              │  │ HTTP/TCP/Script      │  │   │
│  │  │   config/    │  │ backend      │  │ Checks per service   │  │   │
│  │  │   services/  │  │ ai-gateway   │  │                      │  │   │
│  │  │   secrets/   │  │ chromadb     │  │                      │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                    ┌───────────────┼───────────────┐                   │
│                    │               │               │                   │
│                    ▼               ▼               ▼                   │
│  ┌─────────────────────┐ ┌─────────────────┐ ┌─────────────────────┐  │
│  │  Consul Agent       │ │  Consul Agent   │ │   Consul Agent      │  │
│  │  (Backend Node)     │ │  (AI Node)      │ │   (DB Node)         │  │
│  │                     │ │                 │ │                     │  │
│  │  - Backend API      │ │  - AI Gateway   │ │   - PostgreSQL      │  │
│  │  - n8n              │ │  - AI Backend   │ │   - Redis           │  │
│  │  - Terminal         │ │  - AI Serve     │ │   - ChromaDB        │  │
│  │                     │ │  - TEI          │ │                     │  │
│  └─────────────────────┘ └─────────────────┘ └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Consul KV 스키마 설계

### 3.1 키 구조 (Namespace Pattern)

```
blog/
├── config/                          # 글로벌 설정
│   ├── env                          # 현재 환경 (production/staging/dev)
│   ├── domains/
│   │   ├── frontend                 # noblog.nodove.com
│   │   ├── api                      # api.nodove.com
│   │   ├── assets                   # assets-b.nodove.com
│   │   ├── terminal                 # terminal.nodove.com
│   │   └── n8n                      # blog-bw.nodove.com
│   ├── cors/
│   │   └── allowed_origins          # JSON array
│   └── features/
│       ├── ai_enabled               # true/false
│       ├── rag_enabled              # true/false
│       └── terminal_enabled         # true/false
│
├── services/                        # 서비스 엔드포인트
│   ├── backend/
│   │   ├── url                      # http://backend:5080
│   │   ├── health_path              # /api/v1/healthz
│   │   └── timeout                  # 30000
│   ├── ai-gateway/
│   │   ├── url                      # http://ai-gateway:7000
│   │   ├── health_path              # /health
│   │   └── timeout                  # 120000
│   ├── ai-backend/
│   │   ├── url                      # http://ai-server-backend:7016
│   │   └── openai_compat_path       # /v1
│   ├── ai-serve/
│   │   ├── url                      # http://ai-server-serve:7012
│   │   └── health_path              # /health
│   ├── chromadb/
│   │   ├── url                      # http://chromadb:8000
│   │   ├── collection               # blog-posts-all-MiniLM-L6-v2
│   │   └── health_path              # /api/v1/heartbeat
│   ├── embedding/
│   │   ├── url                      # http://embedding-server:80
│   │   └── model                    # all-MiniLM-L6-v2
│   ├── postgres/
│   │   ├── host                     # postgres
│   │   ├── port                     # 5432
│   │   └── database                 # blog
│   ├── redis/
│   │   ├── url                      # redis://redis:6379
│   │   └── db                       # 0
│   ├── n8n/
│   │   ├── internal_url             # http://n8n:5678
│   │   ├── webhook_url              # https://blog-bw.nodove.com
│   │   └── webhooks/
│   │       ├── chat                 # /webhook/ai/chat
│   │       ├── vision               # /webhook/ai/vision
│   │       └── task                 # /webhook/ai/task
│   └── terminal/
│       ├── url                      # http://terminal:8080
│       └── origin                   # https://terminal-origin.nodove.com
│
├── secrets/                         # 민감 정보 (Vault 연동 또는 암호화)
│   ├── jwt_secret
│   ├── admin_credentials/
│   │   ├── username
│   │   └── password_hash
│   ├── api_keys/
│   │   ├── ai_serve
│   │   ├── backend
│   │   ├── r2_internal
│   │   └── resend
│   └── database/
│       ├── postgres_password
│       └── redis_password
│
└── env/                             # 환경별 오버라이드
    ├── production/
    │   └── ... (production 전용 설정)
    ├── staging/
    │   └── ... (staging 전용 설정)
    └── development/
        └── ... (development 전용 설정)
```

### 3.2 KV 값 예시 (JSON)

```json
// blog/services/ai-gateway
{
  "url": "http://ai-gateway:7000",
  "health_path": "/health",
  "timeout": 120000,
  "retry": {
    "attempts": 3,
    "delay": 1000,
    "backoff": "exponential"
  },
  "circuit_breaker": {
    "threshold": 5,
    "reset_time": 30000
  }
}

// blog/config/cors/allowed_origins
[
  "https://noblog.nodove.com",
  "https://blog.nodove.com",
  "https://api.nodove.com",
  "http://localhost:5173",
  "http://localhost:3000"
]

// blog/services/n8n/webhooks
{
  "chat": "/webhook/ai/chat",
  "vision": "/webhook/ai/vision",
  "task": "/webhook/ai/task",
  "translate": "/webhook/ai/translate",
  "embeddings": "/webhook/ai/embeddings"
}
```

---

## 4. 구현 계획

### 4.1 Phase 1: Consul 인프라 구축 (1-2일)

#### 4.1.1 Docker Compose에 Consul 추가

```yaml
# docker-compose.consul.yml
services:
  consul:
    image: hashicorp/consul:1.18
    container_name: blog-consul
    command: agent -server -bootstrap-expect=1 -ui -client=0.0.0.0 -datacenter=blog-dc
    ports:
      - "8500:8500"   # HTTP API + UI
      - "8600:8600/udp" # DNS
    volumes:
      - consul-data:/consul/data
      - ./consul/config:/consul/config:ro
    environment:
      CONSUL_BIND_INTERFACE: eth0
    networks:
      - blog-network
    healthcheck:
      test: ["CMD", "consul", "members"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  consul-data:
```

#### 4.1.2 초기 KV 데이터 시딩 스크립트

```bash
#!/bin/bash
# scripts/consul/seed-kv.sh

CONSUL_ADDR="${CONSUL_HTTP_ADDR:-http://localhost:8500}"

# 글로벌 설정
consul kv put blog/config/env "production"
consul kv put blog/config/domains/frontend "https://noblog.nodove.com"
consul kv put blog/config/domains/api "https://api.nodove.com"
consul kv put blog/config/domains/assets "https://assets-b.nodove.com"

# 서비스 엔드포인트
consul kv put blog/services/backend/url "http://backend:5080"
consul kv put blog/services/ai-gateway/url "http://ai-gateway:7000"
consul kv put blog/services/chromadb/url "http://chromadb:8000"
consul kv put blog/services/embedding/url "http://embedding-server:80"
consul kv put blog/services/redis/url "redis://redis:6379"

# 복잡한 설정 (JSON 파일에서)
consul kv put blog/config/cors/allowed_origins @consul/data/cors-origins.json
consul kv put blog/services/n8n/webhooks @consul/data/n8n-webhooks.json
```

### 4.2 Phase 2: 서비스 등록 및 헬스체크 (2-3일)

#### 4.2.1 서비스 정의 파일

```json
// consul/services/backend.json
{
  "service": {
    "id": "backend-1",
    "name": "backend",
    "tags": ["api", "nodejs", "primary"],
    "port": 5080,
    "check": {
      "http": "http://localhost:5080/api/v1/healthz",
      "interval": "10s",
      "timeout": "5s",
      "deregister_critical_service_after": "1m"
    },
    "meta": {
      "version": "1.0.0",
      "environment": "production"
    }
  }
}
```

```json
// consul/services/ai-gateway.json
{
  "service": {
    "id": "ai-gateway-1",
    "name": "ai-gateway",
    "tags": ["ai", "nginx", "gateway"],
    "port": 7000,
    "check": {
      "http": "http://localhost:7000/health",
      "interval": "15s",
      "timeout": "10s"
    },
    "connect": {
      "sidecar_service": {}
    }
  }
}
```

#### 4.2.2 Docker 서비스에 Consul Agent 통합

```yaml
# docker-compose.yml (수정)
services:
  backend:
    # ... 기존 설정
    depends_on:
      - consul
    environment:
      CONSUL_HTTP_ADDR: http://consul:8500
    volumes:
      - ./consul/services/backend.json:/consul/config/backend.json:ro
    labels:
      - "consul.register=true"
      - "consul.service=backend"
```

### 4.3 Phase 3: 애플리케이션 통합 (3-5일)

#### 4.3.1 Node.js Consul 클라이언트

```javascript
// backend/src/lib/consul-client.js
import Consul from 'consul';

const consul = new Consul({
  host: process.env.CONSUL_HOST || 'consul',
  port: process.env.CONSUL_PORT || 8500,
  promisify: true,
});

const CONFIG_PREFIX = 'blog';
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

export async function getServiceUrl(serviceName) {
  const cacheKey = `service:${serviceName}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }

  // KV에서 먼저 조회
  const kvKey = `${CONFIG_PREFIX}/services/${serviceName}/url`;
  const kvResult = await consul.kv.get(kvKey);
  
  if (kvResult?.Value) {
    const url = kvResult.Value;
    cache.set(cacheKey, { value: url, timestamp: Date.now() });
    return url;
  }

  // Service Catalog에서 조회 (동적 디스커버리)
  const services = await consul.health.service({
    service: serviceName,
    passing: true,
  });

  if (services.length > 0) {
    const { Address, Port } = services[0].Service;
    const url = `http://${Address}:${Port}`;
    cache.set(cacheKey, { value: url, timestamp: Date.now() });
    return url;
  }

  throw new Error(`Service not found: ${serviceName}`);
}

export async function getConfig(key, defaultValue = null) {
  const fullKey = `${CONFIG_PREFIX}/config/${key}`;
  
  try {
    const result = await consul.kv.get(fullKey);
    if (result?.Value) {
      try {
        return JSON.parse(result.Value);
      } catch {
        return result.Value;
      }
    }
  } catch (error) {
    console.warn(`Consul config fetch failed for ${key}:`, error.message);
  }
  
  return defaultValue;
}

export async function watchKey(key, callback) {
  const fullKey = `${CONFIG_PREFIX}/${key}`;
  
  const watch = consul.watch({
    method: consul.kv.get,
    options: { key: fullKey },
  });

  watch.on('change', (data) => {
    if (data?.Value) {
      try {
        callback(JSON.parse(data.Value));
      } catch {
        callback(data.Value);
      }
    }
  });

  watch.on('error', (err) => {
    console.error(`Watch error for ${key}:`, err);
  });

  return watch;
}

export { consul };
```

#### 4.3.2 설정 로더 업데이트

```javascript
// backend/src/config.js (수정)
import { z } from 'zod';
import { getServiceUrl, getConfig } from './lib/consul-client.js';

const USE_CONSUL = process.env.USE_CONSUL === 'true';

async function loadFromConsul() {
  const [
    aiGatewayUrl,
    chromaUrl,
    embeddingUrl,
    redisUrl,
    corsOrigins,
    frontendDomain,
    apiDomain,
  ] = await Promise.all([
    getServiceUrl('ai-gateway'),
    getServiceUrl('chromadb'),
    getServiceUrl('embedding'),
    getServiceUrl('redis'),
    getConfig('cors/allowed_origins', []),
    getConfig('domains/frontend'),
    getConfig('domains/api'),
  ]);

  return {
    AI_GATEWAY_URL: aiGatewayUrl,
    CHROMA_URL: chromaUrl,
    TEI_URL: embeddingUrl,
    REDIS_URL: redisUrl,
    ALLOWED_ORIGINS: corsOrigins.join(','),
    SITE_BASE_URL: frontendDomain,
    API_BASE_URL: apiDomain,
  };
}

export async function initConfig() {
  let consulConfig = {};
  
  if (USE_CONSUL) {
    try {
      consulConfig = await loadFromConsul();
      console.log('Configuration loaded from Consul');
    } catch (error) {
      console.warn('Consul config load failed, using environment:', error.message);
    }
  }

  // Environment variables override Consul
  const env = { ...consulConfig, ...process.env };
  
  return ConfigSchema.parse(env);
}
```

#### 4.3.3 Python 스크립트 (RAG 인덱싱 등) 통합

```python
# scripts/rag/consul_config.py
import consul
import os
import json
from functools import lru_cache

CONSUL_HOST = os.getenv('CONSUL_HOST', 'consul')
CONSUL_PORT = int(os.getenv('CONSUL_PORT', 8500))
CONFIG_PREFIX = 'blog'

_consul_client = None

def get_consul():
    global _consul_client
    if _consul_client is None:
        _consul_client = consul.Consul(host=CONSUL_HOST, port=CONSUL_PORT)
    return _consul_client

@lru_cache(maxsize=100)
def get_service_url(service_name: str) -> str:
    c = get_consul()
    key = f"{CONFIG_PREFIX}/services/{service_name}/url"
    
    _, data = c.kv.get(key)
    if data and data.get('Value'):
        return data['Value'].decode('utf-8')
    
    # Fallback to service catalog
    _, services = c.health.service(service_name, passing=True)
    if services:
        addr = services[0]['Service']['Address']
        port = services[0]['Service']['Port']
        return f"http://{addr}:{port}"
    
    raise ValueError(f"Service not found: {service_name}")

def get_config(key: str, default=None):
    c = get_consul()
    full_key = f"{CONFIG_PREFIX}/config/{key}"
    
    _, data = c.kv.get(full_key)
    if data and data.get('Value'):
        value = data['Value'].decode('utf-8')
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    
    return default

# 사용 예시
# CHROMA_URL = get_service_url('chromadb')
# TEI_URL = get_service_url('embedding')
```

```python
# scripts/rag/index_posts.py (수정)
from consul_config import get_service_url, get_config

# 기존 하드코딩 대신
CHROMA_URL = get_service_url('chromadb')
TEI_URL = get_service_url('embedding')
COLLECTION_NAME = get_config('services/chromadb/collection', 'blog-posts')
```

### 4.4 Phase 4: Workers 통합 (2-3일)

#### 4.4.1 Cloudflare Workers용 Consul 브릿지

Workers는 직접 Consul에 접근할 수 없으므로 KV 동기화 방식 사용:

```javascript
// workers/shared/consul-sync.js
// GitHub Actions 또는 cron으로 실행

import Consul from 'consul';

const consul = new Consul({ host: process.env.CONSUL_HOST });

async function syncToCloudflareKV() {
  const wrangler = require('wrangler');
  
  // Consul에서 Workers가 필요한 설정만 추출
  const keysToSync = [
    'blog/config/domains/frontend',
    'blog/config/domains/api',
    'blog/config/domains/assets',
    'blog/config/cors/allowed_origins',
    'blog/services/backend/url',
  ];

  for (const key of keysToSync) {
    const result = await consul.kv.get(key);
    if (result?.Value) {
      const cfKey = key.replace('blog/', '');
      await wrangler.kv.put(
        process.env.CF_KV_NAMESPACE_ID,
        cfKey,
        result.Value
      );
    }
  }
}
```

#### 4.4.2 Workers에서 KV 설정 사용

```typescript
// workers/api-gateway/src/lib/config.ts
export async function getConfig(env: Env) {
  const [frontendDomain, apiDomain, corsOrigins] = await Promise.all([
    env.CONFIG_KV.get('config/domains/frontend'),
    env.CONFIG_KV.get('config/domains/api'),
    env.CONFIG_KV.get('config/cors/allowed_origins'),
  ]);

  return {
    FRONTEND_URL: frontendDomain || env.FRONTEND_URL,
    API_URL: apiDomain || env.API_URL,
    CORS_ORIGINS: corsOrigins ? JSON.parse(corsOrigins) : [],
  };
}
```

### 4.5 Phase 5: 운영 도구 (1-2일)

#### 4.5.1 CLI 관리 도구

```bash
#!/bin/bash
# scripts/consul/blog-config

CONSUL_ADDR="${CONSUL_HTTP_ADDR:-http://localhost:8500}"
PREFIX="blog"

case "$1" in
  list)
    consul kv get -recurse "${PREFIX}/" | column -t -s ':'
    ;;
  
  get)
    consul kv get "${PREFIX}/$2"
    ;;
  
  set)
    consul kv put "${PREFIX}/$2" "$3"
    ;;
  
  service-url)
    consul kv get "${PREFIX}/services/$2/url"
    ;;
  
  health)
    curl -s "${CONSUL_ADDR}/v1/health/service/$2?passing=true" | jq '.[].Service'
    ;;
  
  export)
    consul kv export "${PREFIX}/" > "consul-backup-$(date +%Y%m%d).json"
    ;;
  
  import)
    consul kv import @"$2"
    ;;
  
  *)
    echo "Usage: blog-config {list|get|set|service-url|health|export|import}"
    ;;
esac
```

#### 4.5.2 Consul UI 접근

```yaml
# docker-compose.consul.yml
services:
  consul:
    ports:
      - "127.0.0.1:8500:8500"  # UI: http://localhost:8500/ui
```

---

## 5. 마이그레이션 전략

### 5.1 단계별 마이그레이션

```
Week 1: Phase 1-2 (인프라 + 서비스 등록)
├── Consul 서버 배포
├── 기존 서비스 등록
├── 헬스체크 구성
└── KV 초기 데이터 시딩

Week 2: Phase 3 (Backend 통합)
├── consul-client.js 구현
├── config.js 수정 (Consul 우선, ENV fallback)
├── 서비스별 URL 참조 변경
└── 테스트 (개발 환경)

Week 3: Phase 4-5 (Workers + 운영도구)
├── Cloudflare KV 동기화 구성
├── Workers 설정 마이그레이션
├── CLI 도구 구현
└── 모니터링 대시보드 구성

Week 4: 안정화
├── Staging 환경 테스트
├── Production 마이그레이션
├── 문서화
└── 팀 교육
```

### 5.2 롤백 계획

모든 변경은 환경변수 fallback을 유지:

```javascript
// Consul 실패 시 자동 fallback
const AI_GATEWAY_URL = 
  await getServiceUrl('ai-gateway').catch(() => null) || 
  process.env.AI_GATEWAY_URL || 
  'http://ai-gateway:7000';
```

---

## 6. 보안 고려사항

### 6.1 ACL 구성

```hcl
# consul/acl-policy.hcl
agent_prefix "" {
  policy = "read"
}

key_prefix "blog/config/" {
  policy = "read"
}

key_prefix "blog/services/" {
  policy = "read"
}

key_prefix "blog/secrets/" {
  policy = "deny"  # Vault 전용
}

service_prefix "" {
  policy = "read"
}
```

### 6.2 Vault 연동 (민감 정보)

```hcl
# Consul KV의 secrets/ 경로 대신 Vault 사용
path "secret/data/blog/*" {
  capabilities = ["read"]
}
```

---

## 7. 모니터링 및 알림

### 7.1 Prometheus 메트릭

```yaml
# prometheus/consul-exporter.yml
- job_name: 'consul'
  consul_sd_configs:
    - server: 'consul:8500'
  relabel_configs:
    - source_labels: [__meta_consul_service]
      target_label: service
```

### 7.2 알림 규칙

```yaml
# prometheus/alerts/consul.yml
groups:
  - name: consul
    rules:
      - alert: ConsulServiceDown
        expr: consul_health_service_status{status="critical"} > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.service }} is down"
```

---

## 8. 예상 효과

| 영역 | Before | After |
|------|--------|-------|
| **서비스 URL 변경** | 10+ 파일 수정, 재배포 | Consul KV 1회 업데이트 |
| **환경변수 관리** | 분산된 .env 파일들 | 중앙 집중화, 버전 관리 |
| **서비스 스케일링** | 수동 설정 | 자동 등록/해제 |
| **장애 대응** | 수동 상태 확인 | 자동 헬스체크 + 라우팅 제외 |
| **설정 감사** | 불가능 | Consul UI + 변경 로그 |
| **환경별 분리** | 별도 파일 관리 | 네임스페이스 기반 |

---

## 9. 필요 리소스

### 9.1 인프라

- Consul Server: 512MB RAM, 1 vCPU
- 추가 네트워크 대역폭: 무시 가능 (KV 조회는 경량)

### 9.2 개발 공수

| Phase | 예상 시간 | 담당 |
|-------|----------|------|
| Phase 1: 인프라 | 1-2일 | DevOps |
| Phase 2: 서비스 등록 | 2-3일 | DevOps |
| Phase 3: Backend 통합 | 3-5일 | Backend |
| Phase 4: Workers 통합 | 2-3일 | Backend |
| Phase 5: 운영 도구 | 1-2일 | DevOps |
| **총계** | **~2주** | |

---

## 10. 다음 단계

1. [ ] Consul Docker 구성 추가 및 테스트
2. [ ] KV 스키마 최종 확정
3. [ ] consul-client.js 구현
4. [ ] 개발 환경에서 PoC 진행
5. [ ] 마이그레이션 스크립트 작성
6. [ ] Staging 환경 테스트
7. [ ] Production 롤아웃
