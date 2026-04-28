# Operational State Boundaries

The backend origin must run behind the API Gateway only. Production ingress must block direct public access to the backend with firewall rules, mTLS, or an IP allowlist, and every origin request must carry `X-Backend-Key` from the Worker.

Process-local state is limited to single-instance operation unless a durable adapter is explicitly enabled:

- Backend chat sessions and notebook bootstrap jobs in `backend/src/services/session.service.js` are single-instance only.
- Backend debate sessions in `backend/src/routes/debate.js` are single-instance only; Worker debate sessions use D1.
- Live room SSE streams are process-local, while Redis pub/sub bridges fan-out between instances when Redis is healthy.
- Runtime live prompt/policy overrides are process-local and should be treated as ephemeral unless moved to Redis or D1.
- Legacy auth fallback maps are process-local and are not acceptable for horizontally scaled production; Worker-native auth state uses D1/KV.

For multi-instance production, prefer Worker-native routes or add Redis/D1 persistence before scaling the backend above one instance.

Cross-store side effects that leave the backend process use `domain_outbox`
where possible. The backend outbox worker consumes GitHub PR, image vision,
RAG Chroma index, and deployment-hook events with retry/dead-letter state.
Set `BACKEND_DOMAIN_OUTBOX_ENABLED=false` only for maintenance windows or
single-shot local debugging.
