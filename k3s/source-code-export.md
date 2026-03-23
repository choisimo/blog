# Source Code Export

- Root: `/home/nodove/workspace/blog/k3s`
- Generated at: `2026-03-22T14:51:16.466Z`
- Files: `22`

## File List

- `api.yaml`
- `chromadb.yaml`
- `configmap.yaml`
- `ingress.yaml`
- `kustomization.yaml`
- `limitrange.yaml`
- `middleware.yaml`
- `namespace.yaml`
- `open-notebook.yaml`
- `optional/cloudflared/cloudflared.yaml`
- `optional/cloudflared/kustomization.yaml`
- `optional/cloudflared/secret.example.yaml`
- `optional/terminal/kustomization.yaml`
- `optional/terminal/terminal-ingress-optional.yaml`
- `optional/terminal/terminal-optional.yaml`
- `piston.yaml`
- `postgres.yaml`
- `redis.yaml`
- `registry-secret.example.yaml`
- `resourcequota.yaml`
- `secret-example.yaml`
- `surrealdb.yaml`

## api.yaml

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: api-sqlite
  namespace: blog
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path
  resources:
    requests:
      storage: 5Gi
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: blog
spec:
  selector:
    app: api
  ports:
    - name: http
      port: 5080
      targetPort: http
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: blog
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      automountServiceAccountToken: false
      terminationGracePeriodSeconds: 30
      imagePullSecrets:
        - name: ghcr-creds
      initContainers:
        - name: sync-repo
          image: alpine/git:2.47.2
          imagePullPolicy: Always
          command:
            - /bin/sh
            - -ec
            - |
              repo_url="${CONTENT_GIT_REPO_AUTH:-$CONTENT_GIT_REPO}"
              test -n "$repo_url"
              git clone --depth 1 --branch "$CONTENT_GIT_REF" "$repo_url" /repo
          envFrom:
            - configMapRef:
                name: blog-app-config
            - secretRef:
                name: blog-app-secrets
          resources:
            requests:
              cpu: 50m
              memory: 128Mi
            limits:
              cpu: 250m
              memory: 256Mi
          volumeMounts:
            - name: repo-data
              mountPath: /repo
      containers:
        - name: api
          image: ghcr.io/choisimo/blog-api:latest
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 5080
          envFrom:
            - configMapRef:
                name: blog-app-config
            - secretRef:
                name: blog-app-secrets
          volumeMounts:
            - name: sqlite-data
              mountPath: /app/.data
            - name: repo-data
              mountPath: /frontend
              subPath: frontend
              readOnly: true
            - name: repo-data
              mountPath: /workers
              subPath: workers
              readOnly: true
            - name: repo-data
              mountPath: /backend
              subPath: backend
              readOnly: true
          startupProbe:
            httpGet:
              path: /api/v1/healthz
              port: http
            failureThreshold: 30
            periodSeconds: 5
          readinessProbe:
            httpGet:
              path: /api/v1/healthz
              port: http
            initialDelaySeconds: 15
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/v1/healthz
              port: http
            initialDelaySeconds: 45
            periodSeconds: 20
          resources:
            requests:
              cpu: 200m
              memory: 512Mi
            limits:
              cpu: 1
              memory: 1Gi
      volumes:
        - name: sqlite-data
          persistentVolumeClaim:
            claimName: api-sqlite
        - name: repo-data
          emptyDir:
            sizeLimit: 2Gi

```

## chromadb.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: chromadb
  namespace: blog
spec:
  clusterIP: None
  selector:
    app: chromadb
  ports:
    - name: http
      port: 8000
      targetPort: http
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: chromadb
  namespace: blog
spec:
  serviceName: chromadb
  replicas: 1
  selector:
    matchLabels:
      app: chromadb
  template:
    metadata:
      labels:
        app: chromadb
    spec:
      automountServiceAccountToken: false
      terminationGracePeriodSeconds: 30
      containers:
        - name: chromadb
          image: chromadb/chroma:latest
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 8000
          env:
            - name: ANONYMIZED_TELEMETRY
              value: "false"
            - name: ALLOW_RESET
              value: "false"
          volumeMounts:
            - name: data
              mountPath: /chroma/chroma
          startupProbe:
            httpGet:
              path: /api/v2/heartbeat
              port: http
            failureThreshold: 30
            periodSeconds: 5
          readinessProbe:
            httpGet:
              path: /api/v2/heartbeat
              port: http
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/v2/heartbeat
              port: http
            initialDelaySeconds: 30
            periodSeconds: 20
          resources:
            requests:
              cpu: 100m
              memory: 512Mi
            limits:
              cpu: 1
              memory: 2Gi
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes:
          - ReadWriteOnce
        storageClassName: local-path
        resources:
          requests:
            storage: 20Gi

```

## configmap.yaml

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: blog-app-config
  namespace: blog
data:
  APP_ENV: "production"
  HOST: "0.0.0.0"
  PORT: "5080"
  TRUST_PROXY: "1"
  LOG_LEVEL: "info"
  SITE_BASE_URL: "https://noblog.nodove.com"
  API_BASE_URL: "https://api.nodove.com"
  ALLOWED_ORIGINS: "https://noblog.nodove.com,http://localhost:5173"
  RATE_LIMIT_MAX: "60"
  RATE_LIMIT_WINDOW_MS: "60000"
  AI_DEFAULT_MODEL: "gpt-4.1"
  AI_ASYNC_MODE: "false"
  AI_EMBED_MODEL: "text-embedding-3-small"
  CHROMA_URL: "http://chromadb:8000"
  CHROMA_COLLECTION: "blog-posts__all-MiniLM-L6-v2"
  SQLITE_PATH: "/app/.data/blog.db"
  SQLITE_MIGRATIONS_DIR: "/workers/migrations"
  CONTENT_PUBLIC_DIR: "/frontend/public"
  CONTENT_POSTS_DIR: "/frontend/public/posts"
  CONTENT_IMAGES_DIR: "/frontend/public/images"
  POSTS_SOURCE: "filesystem"
  OPEN_NOTEBOOK_URL: "http://open-notebook:8501"
  OPEN_NOTEBOOK_ENABLED: "true"
  TERMINAL_SERVER_URL: "http://terminal-server:8080"
  TERMINAL_GATEWAY_URL: "https://terminal.nodove.com"
  FEATURE_AI_ENABLED: "true"
  FEATURE_RAG_ENABLED: "true"
  FEATURE_TERMINAL_ENABLED: "false"
  FEATURE_AI_INLINE: "true"
  FEATURE_COMMENTS_ENABLED: "true"
  USE_CONSUL: "false"
  POSTGRES_DB: "bloganalytics"
  POSTGRES_USER: "bloguser"
  CONTENT_GIT_REPO: "https://github.com/choisimo/blog.git"
  CONTENT_GIT_REF: "main"
  SANDBOX_IMAGE: "alpine:latest"

```

## ingress.yaml

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: blog-backend
  namespace: blog
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.middlewares: blog-redirect-https@kubernetescrd
spec:
  ingressClassName: traefik
  tls:
    - secretName: blog-origin-tls
      hosts:
        - api.nodove.com
  rules:
    - host: api.nodove.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  name: http

```

## kustomization.yaml

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - namespace.yaml
  - limitrange.yaml
  - resourcequota.yaml
  - configmap.yaml
  - postgres.yaml
  - redis.yaml
  - chromadb.yaml
  - surrealdb.yaml
  - open-notebook.yaml
  - api.yaml
  - ingress.yaml
  - middleware.yaml
  - piston.yaml

```

## limitrange.yaml

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: blog-default-limits
  namespace: blog
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 512Mi
        ephemeral-storage: 1Gi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
        ephemeral-storage: 256Mi
    - type: PersistentVolumeClaim
      min:
        storage: 1Gi
      max:
        storage: 100Gi

```

## middleware.yaml

```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: redirect-https
  namespace: blog
spec:
  redirectScheme:
    scheme: https
    permanent: true

```

## namespace.yaml

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: blog

```

## open-notebook.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: open-notebook
  namespace: blog
spec:
  selector:
    app: open-notebook
  ports:
    - name: web
      port: 8501
      targetPort: web
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: open-notebook
  namespace: blog
spec:
  replicas: 1
  selector:
    matchLabels:
      app: open-notebook
  template:
    metadata:
      labels:
        app: open-notebook
    spec:
      automountServiceAccountToken: false
      terminationGracePeriodSeconds: 30
      initContainers:
        - name: wait-for-surrealdb
          image: busybox:1.36
          command:
            - sh
            - -c
            - until nc -zw2 surrealdb 8000; do echo "waiting for surrealdb..."; sleep 2; done
          resources:
            requests:
              cpu: 25m
              memory: 32Mi
            limits:
              cpu: 100m
              memory: 64Mi
      containers:
        - name: open-notebook
          image: lfnovo/open_notebook:v1-latest
          imagePullPolicy: IfNotPresent
          ports:
            - name: web
              containerPort: 8501
            - name: health
              containerPort: 5055
          env:
            - name: SURREAL_URL
              value: ws://surrealdb:8000/rpc
            - name: SURREAL_USER
              value: root
            - name: SURREAL_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: blog-app-secrets
                  key: SURREALDB_ROOT_PASSWORD
            - name: SURREAL_NAMESPACE
              value: open_notebook
            - name: SURREAL_DATABASE
              value: open_notebook
            - name: DEFAULT_CHAT_MODEL
              valueFrom:
                configMapKeyRef:
                  name: blog-app-config
                  key: AI_DEFAULT_MODEL
            - name: DEFAULT_TRANSFORMATION_MODEL
              valueFrom:
                configMapKeyRef:
                  name: blog-app-config
                  key: AI_DEFAULT_MODEL
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: blog-app-secrets
                  key: AI_API_KEY
                  optional: true
            - name: OPENAI_COMPATIBLE_BASE_URL
              valueFrom:
                secretKeyRef:
                  name: blog-app-secrets
                  key: AI_SERVER_URL
                  optional: true
            - name: OPENAI_COMPATIBLE_API_KEY
              valueFrom:
                secretKeyRef:
                  name: blog-app-secrets
                  key: AI_API_KEY
                  optional: true
            - name: OPENAI_COMPATIBLE_BASE_URL_LLM
              valueFrom:
                secretKeyRef:
                  name: blog-app-secrets
                  key: AI_SERVER_URL
                  optional: true
            - name: OPENAI_COMPATIBLE_API_KEY_LLM
              valueFrom:
                secretKeyRef:
                  name: blog-app-secrets
                  key: AI_API_KEY
                  optional: true
            - name: OPENAI_COMPATIBLE_BASE_URL_EMBEDDING
              valueFrom:
                secretKeyRef:
                  name: blog-app-secrets
                  key: AI_EMBEDDING_URL
                  optional: true
            - name: OPENAI_COMPATIBLE_API_KEY_EMBEDDING
              valueFrom:
                secretKeyRef:
                  name: blog-app-secrets
                  key: AI_EMBEDDING_API_KEY
                  optional: true
            - name: OPENAI_API_BASE
              valueFrom:
                secretKeyRef:
                  name: blog-app-secrets
                  key: AI_SERVER_URL
                  optional: true
            - name: DEFAULT_EMBEDDING_MODEL
              valueFrom:
                configMapKeyRef:
                  name: blog-app-config
                  key: AI_EMBED_MODEL
            - name: EMBEDDING_API_KEY
              valueFrom:
                secretKeyRef:
                  name: blog-app-secrets
                  key: AI_EMBEDDING_API_KEY
                  optional: true
            - name: EMBEDDING_API_BASE
              valueFrom:
                secretKeyRef:
                  name: blog-app-secrets
                  key: AI_EMBEDDING_URL
                  optional: true
          startupProbe:
            httpGet:
              path: /health
              port: health
            failureThreshold: 30
            periodSeconds: 5
          readinessProbe:
            httpGet:
              path: /health
              port: health
            initialDelaySeconds: 20
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: health
            initialDelaySeconds: 60
            periodSeconds: 20
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 1
              memory: 1Gi

```

## optional/cloudflared/cloudflared.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloudflared
  namespace: blog
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cloudflared
  template:
    metadata:
      labels:
        app: cloudflared
    spec:
      automountServiceAccountToken: false
      terminationGracePeriodSeconds: 30
      securityContext:
        sysctls:
          - name: net.ipv4.ping_group_range
            value: "65532 65532"
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: cloudflared
                topologyKey: kubernetes.io/hostname
      containers:
        - name: cloudflared
          image: cloudflare/cloudflared:2025.6.0
          imagePullPolicy: IfNotPresent
          env:
            - name: TUNNEL_TOKEN
              valueFrom:
                secretKeyRef:
                  name: cloudflared-tunnel-token
                  key: token
          command:
            - cloudflared
            - tunnel
            - --no-autoupdate
            - --loglevel
            - info
            - --metrics
            - 0.0.0.0:2000
            - run
          ports:
            - name: metrics
              containerPort: 2000
          livenessProbe:
            httpGet:
              path: /ready
              port: metrics
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 1
          readinessProbe:
            httpGet:
              path: /ready
              port: metrics
            initialDelaySeconds: 10
            periodSeconds: 10
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi

```

## optional/cloudflared/kustomization.yaml

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - cloudflared.yaml

```

## optional/cloudflared/secret.example.yaml

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: cloudflared-tunnel-token
  namespace: blog
type: Opaque
stringData:
  # Reference only. Do not apply this file with a placeholder value.
  token: REQUIRED_SET_REAL_TUNNEL_TOKEN

```

## optional/terminal/kustomization.yaml

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - terminal-optional.yaml
  - terminal-ingress-optional.yaml

```

## optional/terminal/terminal-ingress-optional.yaml

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: terminal-origin
  namespace: blog
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
spec:
  ingressClassName: traefik
  tls:
    - secretName: blog-origin-tls
      hosts:
        - terminal.nodove.com
  rules:
    - host: terminal.nodove.com
      http:
        paths:
          - path: /terminal
            pathType: Prefix
            backend:
              service:
                name: terminal-server
                port:
                  name: http

```

## optional/terminal/terminal-optional.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: terminal-server
  namespace: blog
spec:
  selector:
    app: terminal-server
  ports:
    - name: http
      port: 8080
      targetPort: http
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: terminal-server
  namespace: blog
spec:
  replicas: 1
  selector:
    matchLabels:
      app: terminal-server
  template:
    metadata:
      labels:
        app: terminal-server
    spec:
      automountServiceAccountToken: false
      terminationGracePeriodSeconds: 30
      imagePullSecrets:
        - name: ghcr-creds
      containers:
        - name: dind
          image: docker:27-dind
          imagePullPolicy: Always
          args:
            - --host=unix:///var/run/docker.sock
          env:
            - name: DOCKER_TLS_CERTDIR
              value: ""
          securityContext:
            privileged: true
          volumeMounts:
            - name: docker-sock
              mountPath: /var/run
            - name: docker-graph
              mountPath: /var/lib/docker
          startupProbe:
            exec:
              command:
                - /bin/sh
                - -ec
                - docker info >/dev/null 2>&1
            failureThreshold: 30
            periodSeconds: 5
        - name: terminal-server
          image: ghcr.io/choisimo/blog-terminal:latest
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 8080
          env:
            - name: BACKEND_KEY
              valueFrom:
                secretKeyRef:
                  name: blog-app-secrets
                  key: BACKEND_KEY
            - name: SANDBOX_IMAGE
              valueFrom:
                configMapKeyRef:
                  name: blog-app-config
                  key: SANDBOX_IMAGE
            - name: DOCKER_HOST
              value: unix:///var/run/docker.sock
          volumeMounts:
            - name: docker-sock
              mountPath: /var/run
          startupProbe:
            exec:
              command:
                - /bin/sh
                - -ec
                - test -S /var/run/docker.sock
            failureThreshold: 30
            periodSeconds: 5
          readinessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 20
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 1
              memory: 1Gi
      volumes:
        - name: docker-sock
          emptyDir:
            sizeLimit: 16Mi
        - name: docker-graph
          emptyDir:
            sizeLimit: 10Gi

```

## piston.yaml

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: piston-packages
  namespace: blog
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path
  resources:
    requests:
      storage: 10Gi
---
apiVersion: v1
kind: Service
metadata:
  name: piston
  namespace: blog
spec:
  selector:
    app: piston
  ports:
    - name: http
      port: 2000
      targetPort: http
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: piston
  namespace: blog
spec:
  replicas: 1
  selector:
    matchLabels:
      app: piston
  template:
    metadata:
      labels:
        app: piston
    spec:
      automountServiceAccountToken: false
      terminationGracePeriodSeconds: 30
      containers:
        - name: piston
          image: ghcr.io/engineer-man/piston@sha256:2f66b7456189c4d713aa986d98eccd0b6ee16d26c7ec5f21b30e942756fd127a
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 2000
          # Upstream Piston documents privileged container execution, and upstream
          # isolate warns that containerized use is not recommended and probably
          # needs privileged mode. Keep the cluster manifest on that documented path
          # until a validated non-privileged profile exists.
          securityContext:
            privileged: true
          volumeMounts:
            - name: piston-packages
              mountPath: /piston/packages
            - name: piston-jobs
              mountPath: /piston/jobs
          startupProbe:
            exec:
              command:
                - node
                - -e
                - "require('http').get('http://127.0.0.1:2000/api/v2/runtimes',(res)=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"
            failureThreshold: 30
            periodSeconds: 5
          readinessProbe:
            exec:
              command:
                - node
                - -e
                - "require('http').get('http://127.0.0.1:2000/api/v2/runtimes',(res)=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"
            initialDelaySeconds: 20
            periodSeconds: 30
          livenessProbe:
            exec:
              command:
                - node
                - -e
                - "require('http').get('http://127.0.0.1:2000/api/v2/runtimes',(res)=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"
            initialDelaySeconds: 60
            periodSeconds: 30
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 2
              memory: 1Gi
      volumes:
        - name: piston-packages
          persistentVolumeClaim:
            claimName: piston-packages
        - name: piston-jobs
          emptyDir:
            medium: Memory
            sizeLimit: 256Mi

```

## postgres.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: blog
spec:
  clusterIP: None
  selector:
    app: postgres
  ports:
    - name: postgres
      port: 5432
      targetPort: postgres
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: blog
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      automountServiceAccountToken: false
      terminationGracePeriodSeconds: 60
      containers:
        - name: postgres
          image: postgres:16-alpine
          imagePullPolicy: IfNotPresent
          ports:
            - name: postgres
              containerPort: 5432
          env:
            - name: POSTGRES_DB
              valueFrom:
                configMapKeyRef:
                  name: blog-app-config
                  key: POSTGRES_DB
            - name: POSTGRES_USER
              valueFrom:
                configMapKeyRef:
                  name: blog-app-config
                  key: POSTGRES_USER
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: blog-app-secrets
                  key: POSTGRES_PASSWORD
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
          startupProbe:
            exec:
              command:
                - pg_isready
                - -U
                - bloguser
                - -d
                - bloganalytics
            failureThreshold: 30
            periodSeconds: 5
          readinessProbe:
            exec:
              command:
                - pg_isready
                - -U
                - bloguser
                - -d
                - bloganalytics
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
          livenessProbe:
            exec:
              command:
                - pg_isready
                - -U
                - bloguser
                - -d
                - bloganalytics
            initialDelaySeconds: 30
            periodSeconds: 20
            timeoutSeconds: 5
            failureThreshold: 3
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 1Gi
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes:
          - ReadWriteOnce
        storageClassName: local-path
        resources:
          requests:
            storage: 20Gi

```

## redis.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: blog
spec:
  clusterIP: None
  selector:
    app: redis
  ports:
    - name: redis
      port: 6379
      targetPort: redis
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: blog
spec:
  serviceName: redis
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      automountServiceAccountToken: false
      terminationGracePeriodSeconds: 30
      containers:
        - name: redis
          image: redis:7-alpine
          imagePullPolicy: IfNotPresent
          command:
            - /bin/sh
            - -ec
            - |
              if [ -n "${REDIS_PASSWORD:-}" ]; then
                exec redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru --requirepass "$REDIS_PASSWORD"
              else
                exec redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
              fi
          ports:
            - name: redis
              containerPort: 6379
          env:
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: blog-app-secrets
                  key: REDIS_PASSWORD
                  optional: true
          volumeMounts:
            - name: data
              mountPath: /data
          startupProbe:
            tcpSocket:
              port: redis
            failureThreshold: 30
            periodSeconds: 5
          readinessProbe:
            tcpSocket:
              port: redis
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            tcpSocket:
              port: redis
            initialDelaySeconds: 20
            periodSeconds: 20
          resources:
            requests:
              cpu: 50m
              memory: 128Mi
            limits:
              cpu: 300m
              memory: 512Mi
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes:
          - ReadWriteOnce
        storageClassName: local-path
        resources:
          requests:
            storage: 4Gi

```

## registry-secret.example.yaml

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ghcr-creds
  namespace: blog
type: kubernetes.io/dockerconfigjson
stringData:
  .dockerconfigjson: |
    {
      "auths": {
        "ghcr.io": {
          "username": "your-github-username",
          "password": "your-ghcr-token"
        }
      }
    }

```

## resourcequota.yaml

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: blog-resource-budget
  namespace: blog
spec:
  hard:
    pods: "20"
    services: "10"
    configmaps: "10"
    secrets: "20"
    persistentvolumeclaims: "10"
    requests.cpu: "4"
    requests.memory: 8Gi
    requests.ephemeral-storage: 10Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    limits.ephemeral-storage: 20Gi
    requests.storage: 100Gi

```

## secret-example.yaml

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: blog-app-secrets
  namespace: blog
type: Opaque
stringData:
  BACKEND_KEY: "replace-me"
  AI_SERVER_URL: "https://ai.dothechi.com/v1"
  AI_API_KEY: "replace-me"
  AI_EMBEDDING_URL: "https://ai.dothechi.com/v1"
  AI_EMBEDDING_API_KEY: "replace-me"
  DATABASE_URL: "postgresql://bloguser:replace-me@postgres:5432/bloganalytics"
  POSTGRES_PASSWORD: "replace-me"
  REDIS_URL: "redis://redis:6379"
  REDIS_PASSWORD: ""
  JWT_SECRET: "replace-me"
  ADMIN_BEARER_TOKEN: "replace-me"
  TOTP_SECRET: "replace-me"
  ADMIN_ALLOWED_EMAILS: "admin@example.com"
  GITHUB_TOKEN: ""
  GITHUB_REPO_OWNER: "choisimo"
  GITHUB_REPO_NAME: "blog"
  GIT_USER_NAME: "CI Bot"
  GIT_USER_EMAIL: "ci@example.com"
  GITHUB_CLIENT_ID: ""
  GITHUB_CLIENT_SECRET: ""
  GOOGLE_CLIENT_ID: ""
  GOOGLE_CLIENT_SECRET: ""
  OAUTH_REDIRECT_BASE_URL: "https://noblog.nodove.com/admin/auth/callback"
  VERCEL_DEPLOY_HOOK_URL: ""
  PERPLEXITY_API_KEY: ""
  TAVILY_API_KEY: ""
  BRAVE_SEARCH_API_KEY: ""
  SERPER_API_KEY: ""
  SURREALDB_ROOT_PASSWORD: "replace-me"
  CONTENT_GIT_REPO_AUTH: ""

```

## surrealdb.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: surrealdb
  namespace: blog
spec:
  clusterIP: None
  selector:
    app: surrealdb
  ports:
    - name: http
      port: 8000
      targetPort: http
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: surrealdb
  namespace: blog
spec:
  serviceName: surrealdb
  replicas: 1
  selector:
    matchLabels:
      app: surrealdb
  template:
    metadata:
      labels:
        app: surrealdb
    spec:
      automountServiceAccountToken: false
      terminationGracePeriodSeconds: 30
      containers:
        - name: surrealdb
          image: surrealdb/surrealdb:v2
          imagePullPolicy: IfNotPresent
          command:
            - /surreal
            - start
            - --user
            - root
            - --bind
            - 0.0.0.0:8000
            - rocksdb:///data/database.db
          ports:
            - name: http
              containerPort: 8000
          env:
            - name: SURREAL_PASS
              valueFrom:
                secretKeyRef:
                  name: blog-app-secrets
                  key: SURREALDB_ROOT_PASSWORD
            - name: SURREAL_USER
              value: "root"
          volumeMounts:
            - name: data
              mountPath: /data
          startupProbe:
            tcpSocket:
              port: http
            failureThreshold: 30
            periodSeconds: 5
          readinessProbe:
            tcpSocket:
              port: http
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            tcpSocket:
              port: http
            initialDelaySeconds: 30
            periodSeconds: 20
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 1Gi
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes:
          - ReadWriteOnce
        storageClassName: local-path
        resources:
          requests:
            storage: 10Gi

```
