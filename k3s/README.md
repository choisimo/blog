# k3s Migration Notes

## Assessment

Moving this stack from `docker-compose` plus Watchtower to k3s is viable, but not as a 1:1 translation.

The backend-side services map cleanly to Kubernetes primitives:

- `api`, `open-notebook`: `Deployment`
- `postgres`, `redis`, `chromadb`, `surrealdb`: `StatefulSet`
- `nginx`: replaced by `Ingress` on k3s Traefik

Two compose-era services are intentionally not part of the base set:

- `workers-local`: local-only Wrangler emulator, not a production workload
- `watchtower`: Docker-socket polling updater, replaced by declarative rollout flow

## Why k3s Helps Here

This directory addresses the main limitations of the current compose setup:

- no declarative rollout or rollback model
- Docker socket dependency for auto-update tooling
- weak service orchestration based on `depends_on`
- host bind-mount coupling to the checked-out repo
- manual TLS/reverse-proxy management inside an `nginx` container

## Important Constraints

This repo still has a few runtime assumptions that matter in Kubernetes:

1. The backend reads content and worker config from the local filesystem.
   The base `api` manifest solves this with an init container that clones the repo into an in-pod shared volume and mounts it at `/frontend`, `/workers`, and `/backend`.

2. The backend still uses SQLite for some local state.
   The `api` deployment is therefore pinned to a single replica and uses `Recreate` strategy with a PVC.

3. Admin endpoints that mutate repo files or invoke Wrangler are not a strong fit for in-cluster runtime.
   Read-only inspection works with the cloned repo, but write/deploy style admin actions should move to CI or a separate admin job runner.

4. `terminal-server` is not included in the base kustomization.
   It shells out to Docker, so on k3s it needs a privileged nested Docker daemon sidecar. Optional manifests are included, but that is a deliberate tradeoff and should be reviewed before enabling.

## Files

- `namespace.yaml`: namespace
- `configmap.yaml`: non-secret runtime config
- `api.yaml`: backend API deployment, repo-sync init container, sqlite PVC
- `postgres.yaml`, `redis.yaml`, `chromadb.yaml`, `surrealdb.yaml`: stateful services
- `open-notebook.yaml`: notebook deployment
- `ingress.yaml`: Traefik ingress for `blog-b.nodove.com`
- `terminal-optional.yaml`, `terminal-ingress-optional.yaml`: optional terminal path using DinD
- `secret-example.yaml`, `registry-secret.example.yaml`: examples only, not included in kustomization

## Rollout Model

This setup intentionally does not recreate Watchtower.

Recommended replacements:

- CI applies `kubectl apply -k k3s` on image or config changes
- or GitOps via FluxCD / Argo CD

## Prerequisites

Before applying the base set, create real secrets from the examples:

- app secret: `blog-app-secrets`
- registry pull secret: `ghcr-creds` if GHCR images are private
- TLS secret: `blog-origin-tls`

The manifests assume k3s default `local-path` storage class and the default Traefik ingress controller.
