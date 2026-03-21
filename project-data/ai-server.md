---
id: ai-server
title: "AI Server"
description: "Node.js/TypeScript 기반 AI 운영 플랫폼. AI Gateway, OpenCode Serve, Redpanda/Bytewax 스트리밍, Grafana/Langfuse 관측성, GHCR 배포 파이프라인을 포함한 멀티서비스 AI 인프라."
date: 2026-02-19
category: "AI"
tags: ["AI Gateway", "OpenAI Compatible", "Docker Compose", "Observability", "Redpanda", "Bytewax"]
stack: ["Node.js", "TypeScript", "React", "Docker", "PostgreSQL", "Redis", "Redpanda", "Bytewax", "Grafana", "Langfuse", "Python"]
status: "Live"
type: "link"
url: "https://github.com/choisimo/AI-server"
codeUrl: "https://github.com/choisimo/AI-server"
featured: false
published: true
---

# AI Server

로컬 체크아웃 기준 `main @ 30ac27a`를 읽고, 2026-03-10에 실제 실행 중인 도커 컨테이너에 접속해 다시 정리한 프로젝트 문서다.

기존 설명과 달리 이 저장소는 `Python + SQLAlchemy ORM` 단일 백엔드가 아니다. 실제 코드는 `AI Gateway + OpenCode Serve + 스트리밍/관측성 도구`를 한 저장소에서 운영하는 멀티서비스 AI 플랫폼 구조에 가깝다.

## 이 프로젝트가 실제로 하는 일

- `apps/ai-gateway`: Express + TypeScript 기반 통합 게이트웨이. `/v1/chat/completions`, `/v1/responses`, `/zen/v1/*`, `/admin/*`, `/api/realtime`를 제공한다.
- `apps/ai-gateway/ui`: React 기반 운영 콘솔. Providers, API Keys, Streaming, Pipeline, Observability, MCP, Vector DB, Storage, Sandboxes, Deploy 페이지가 구현돼 있다.
- `apps/noaicode-serve`: OpenCode UI/serve 컨테이너. 게이트웨이가 이 서비스와 연결되어 실제 모델/에이전트 작업을 위임한다.
- `apps/bytewax-ml/traffic_flow.py`: Redpanda 토픽을 소비해 적응형 IP 정책 명령을 만드는 Python 실시간 워커다.
- `apps/litellm-proxy`, `infra/nginx`, `infra/cloudflare/workers`, `infra/k8s`: OpenAI-compatible routing, 인증 프록시, 엣지 진입점, 배포 실험까지 같이 포함돼 있다.

## 아키텍처

```text
Browser
  -> AI Gateway UI (7016/ui)
  -> OpenAI-compatible API (/v1/*)
  -> Zen proxy (/zen/v1/*)

AI Gateway
  -> NoAICode / OpenCode Serve
  -> Redis / PostgreSQL
  -> Redpanda / Bytewax
  -> ClickHouse / Grafana / Langfuse
```

`docker-compose.yml` 기준으로 `redis`, `noaicode`, `ai-gateway`, `litellm`, `nginx`, `cloudflared`, `postgres`, `qdrant`, `chromadb`, `weaviate`, `redpanda`, `redpanda-console`, `bytewax-ml`, `clickhouse`, `grafana`, `langfuse`, `minio` 등 20개가 넘는 서비스가 정의돼 있다.

## 코드 기준 핵심 구현

### 1. AI Gateway와 인증

- `apps/ai-gateway/src/routes/openai.routes.ts`: OpenAI-compatible chat/responses, session 연결, vector store/MCP tool 조합 지원
- `apps/ai-gateway/src/routes/auth.routes.ts`: `ADMIN_MASTER_KEY` 로그인, access/refresh JWT 발급
- `apps/ai-gateway/src/routes/admin.routes.ts`: API key 발급/회수, model/provider/MCP 관리
- `apps/ai-gateway/ui/src/pages/Providers.tsx`, `ApiKeys.tsx`, `Playground.tsx`: 운영 UI 구현

### 2. 스트리밍과 실시간 운영

- `apps/ai-gateway/ui/src/pages/Streaming.tsx`: Kafka/Redpanda broker 상태, 토픽, consumer group, publish UI
- `apps/ai-gateway/src/routes/security.routes.ts`: IP policy, Bytewax threshold/model checkpoint 제어, runtime probe
- `apps/bytewax-ml/traffic_flow.py`: `ai.gateway.traffic.raw` -> `ai.gateway.ip.policy` 파이프라인

### 3. 관측성과 외부 도구 브리지

- `apps/ai-gateway/ui/src/pages/Observability.tsx`: usage/cost summary, Grafana dashboards, Langfuse traces
- `apps/ai-gateway/src/routes/external-tools.routes.ts`: Grafana/Langfuse/Redpanda/Bytewax auto-login proxy
- `docker-compose.local.yml`: ClickHouse, Grafana, Langfuse, MinIO까지 포함한 로컬 관측성 스택

### 4. 배포/운영 자동화

- `.github/workflows/docker-publish.yml`: `noaicode-serve`, `ai-gateway`, `nginx` 이미지 멀티아키 GHCR 빌드/푸시
- `infra/cloudflare/workers/src/index.ts`: Cloudflare Worker 진입점
- `infra/k8s/*`: namespace, configmap, pvc, hpa 등 쿠버네티스 매니페스트 포함

## 2026-03-10 실행 검증

- 실행 중 컨테이너 확인: `ai-gateway`, `noaicode`, `postgres`, `redis`, `redpanda`, `redpanda-console`, `bytewax-ml`, `clickhouse`, `grafana`, `langfuse`, `minio`
- `POST /zen/v1/chat/completions` 실검증: `opencode/gpt-5-nano` 모델에 `"Reply with exactly: AI server ok"` 요청을 보내 `"AI server ok"` 응답을 받았다
- Admin API 실검증: `/admin/api-keys`로 실제 API key 생성이 성공했다
- 현재 로컬 DB는 초기 상태에 가까워 `model catalog`, `traffic/cost` 데이터는 대부분 비어 있고, 대신 운영 패널/브로커/런타임 상태는 실제 값이 표시된다

## 실제 실행 화면

### Providers 관리

![AI Gateway Providers](/images/2026/ai-server/01-gateway-providers.png)

`OpenCode Zen` provider와 `Ollama`, `Gemini CLI` 같은 외부 OpenAI-compatible provider를 운영 UI에서 직접 관리하는 화면.

### Kafka / Redpanda 스트리밍 패널

![AI Gateway Streaming](/images/2026/ai-server/02-gateway-streaming.png)

Redpanda broker 연결 상태, consumer group, topic 목록, publish form까지 한 화면에 모여 있다.

### Bytewax 파이프라인 제어 패널

![AI Gateway Pipeline](/images/2026/ai-server/03-gateway-pipeline-runtime.png)

Bytewax runtime 상태, Redpanda/Langfuse/ClickHouse 연동, threshold/model checkpoint control이 운영 UI에 직접 들어가 있다.

### Grafana 대시보드

![Grafana Dashboard](/images/2026/ai-server/07-grafana-proxy.png)

실행 중인 Grafana 대시보드. 게이트웨이 외부 도구 브리지로 접속한 실제 화면이다.

### Langfuse 조직 / 프로젝트

![Langfuse Organization](/images/2026/ai-server/08-langfuse-proxy.png)

Langfuse가 실제로 붙어 있고, 초기 organization / project가 생성된 상태를 확인할 수 있다.

### Redpanda Console

![Redpanda Console](/images/2026/ai-server/09-redpanda-proxy.png)

브로커 수, 토픽 수, replica 수 같은 Kafka 운영 정보를 Redpanda Console에서 직접 볼 수 있다.

### OpenCode Serve UI

![OpenCode Serve](/images/2026/ai-server/10-opencode-serve-app.png)

`noaicode-serve` 컨테이너가 띄운 OpenCode 기반 작업 UI. 이 프로젝트에서 게이트웨이가 연결하는 상위 작업 환경이다.

### Bytewax Runtime Status

![Bytewax Runtime](/images/2026/ai-server/11-bytewax-proxy.png)

실행 중인 Bytewax 워커가 처리한 메시지 수, alert 수, last event time을 `/status` 페이지에서 직접 노출한다.

## 정리

이 프로젝트는 단순한 “개인 AI 서버”보다 `OpenAI-compatible gateway + 운영 콘솔 + 스트리밍/관측성 스택 + OpenCode UI`를 함께 가진 AI 운영 플랫폼에 가깝다.

모델 호출만 제공하는 서버가 아니라, provider 관리, API key 관리, Redpanda/Bytewax 파이프라인, Grafana/Langfuse 연동, GHCR 기반 이미지 배포까지 한 저장소에서 다루는 점이 핵심이다.
