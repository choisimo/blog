# Canonical Owner Matrix

작성일: 2026-03-23

이 문서는 Worker와 Backend가 동시에 `/api/v1/*` surface를 갖는 현재 구조에서
도메인별 canonical owner를 고정하기 위한 기준점이다.

## Owner Matrix

| Domain | Canonical Owner | Why |
| --- | --- | --- |
| Public config and public read orchestration | Worker | Edge cache and geo-aware orchestration belong at the edge. |
| Translation cache query | Worker | Public cache-first read path should stay edge-friendly. |
| Auth and session issuance | Worker | User session issuance is part of the edge-facing public contract. |
| User-facing D1 CRUD | Worker | D1-backed CRUD paths are edge-native and latency-sensitive. |
| Durable notifications and outbox delivery | Backend | Async completion and job fanout live with long-running execution. |
| AI, chat, agent, execute | Backend | Provider integration, queueing, and long-running compute are backend-owned. |
| RAG and embeddings | Backend | Vector store and embedding lifecycle are backend-owned. |
| Durable analytics and reporting | Backend | Postgres-backed aggregation belongs to the backend. |
| Static content authoring and manifest regeneration | Backend | Filesystem and build pipeline ownership stay at origin. |

## Immediate Cleanup Priorities

1. Posts identifier policy
2. User session contract
3. Personas and user-content boundaries
4. Translation owner surface
5. Memories and embeddings boundary

## Working Rule

When a domain is not the canonical owner, its route must be one of:

- proxy
- internal-only facade
- compatibility layer on the path to deprecation
