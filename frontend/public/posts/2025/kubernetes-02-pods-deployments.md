---
title: "Kubernetes Pod와 Deployment 핵심 실습"
date: "2025-01-17"
category: "DevOps"
tags: ["DevOps","Kubernetes","Pod","Deployment","실습"]
excerpt: "단일/멀티 컨테이너 Pod, Deployment 생성·스케일·롤링 업데이트·롤백·레이블·셀렉터·Probe까지 실무 핵심 정리."
author: "Admin"
published: true
---

# Kubernetes Pod와 Deployment

##  개요
Pod는 K8s 최소 배포 단위, Deployment는 ReplicaSet을 통해 Pod를 선언적으로 관리합니다. 여기서는 두 리소스의 필수 실습과 운영 패턴을 정리합니다.

##  학습 목표
- Pod 구조 & 생명주기 이해
- 단일/멀티 컨테이너 Pod 작성
- Deployment 롤링 업데이트/롤백
- Label & Selector 활용
- Liveness/Readiness/Startup Probe 적용

##  Pod 기본 개념
```
Pod
├─ Container 1 (Main)
├─ Container 2 (Sidecar)
└─ Shared: Network, Storage
```
상태: Pending → Running → Succeeded/Failed → Terminating

## ️ 단일 Pod 생성
```bash
kubectl run nginx-pod --image=nginx:latest
kubectl get pods
kubectl describe pod nginx-pod
kubectl logs nginx-pod
kubectl exec -it nginx-pod -- /bin/bash
kubectl delete pod nginx-pod
```
YAML (`pod-nginx.yaml`):
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  labels:
    app: nginx
spec:
  containers:
  - name: nginx
    image: nginx:1.21
    ports:
    - containerPort: 80
    resources:
      requests:
        memory: "64Mi"
        cpu: "250m"
      limits:
        memory: "128Mi"
        cpu: "500m"
```

##  멀티 컨테이너 Pod (Sidecar)
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: multi-container-pod
spec:
  containers:
  - name: app
    image: nginx:latest
    volumeMounts:
    - name: shared-logs
      mountPath: /var/log/nginx
  - name: log-collector
    image: busybox
    command: ['sh','-c','tail -f /logs/access.log']
    volumeMounts:
    - name: shared-logs
      mountPath: /logs
  volumes:
  - name: shared-logs
    emptyDir: {}
```
```bash
kubectl apply -f pod-multi-container.yaml
kubectl logs multi-container-pod -c app
kubectl logs multi-container-pod -c log-collector
```

##  Deployment 생성
명령형:
```bash
kubectl create deployment nginx-deploy --image=nginx:1.21 --replicas=3
kubectl get deployments,replicasets,pods
```
선언형 (`deployment-nginx.yaml` 요약):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.21
        ports:
        - containerPort: 80
        livenessProbe:
          httpGet: { path: /, port: 80 }
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet: { path: /, port: 80 }
          initialDelaySeconds: 5
          periodSeconds: 5
```
```bash
kubectl apply -f deployment-nginx.yaml
kubectl describe deployment nginx-deployment
```

##  롤링 업데이트 & 히스토리
```bash
kubectl set image deployment/nginx-deployment nginx=nginx:1.22
kubectl rollout status deployment/nginx-deployment
kubectl rollout history deployment/nginx-deployment
kubectl rollout undo deployment/nginx-deployment
```
전략 설정:
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 2
    maxUnavailable: 1
```
업데이트 제어:
```bash
kubectl rollout pause deployment/nginx-deployment
kubectl rollout resume deployment/nginx-deployment
```

##  Label & Selector
레이블 추가/수정/삭제:
```bash
kubectl label pod nginx-pod env=staging
kubectl label pod nginx-pod env=production --overwrite
kubectl label pod nginx-pod env-
```
셀렉터 질의:
```bash
kubectl get pods -l app=nginx
kubectl get pods -l app=nginx,env=production
kubectl get pods -l 'env in (production,staging)'
```

##  Probe 유형 요약
| Probe | 목적 | 실패 시 |
|-------|------|---------|
| Liveness | 생존 체크 | 컨테이너 재시작 |
| Readiness | 트래픽 준비 | Service 대상 제외 |
| Startup | 느린 시작 보호 | 설정된 재시도 내 대기 |

예시:
```yaml
livenessProbe:
  httpGet: { path: /health, port: 8080 }
  initialDelaySeconds: 30
readinessProbe:
  httpGet: { path: /ready, port: 8080 }
  initialDelaySeconds: 5
startupProbe:
  httpGet: { path: /startup, port: 8080 }
  failureThreshold: 30
  periodSeconds: 10
```

##  실습 과제
1. 다중 Revision 히스토리 남긴 후 특정 revision으로 롤백
2. Blue/Green Deployment 라벨 `version=blue/green` 으로 나누어 Service 전환 시뮬레이션
3. CrashLoopBackOff 재현 후 로그 및 이전 컨테이너 로그 분석

##  문제 해결 패턴
| 상태 | 원인 | 해결 |
|------|------|------|
| ImagePullBackOff | 잘못된 이미지 | `kubectl describe` 로 오류 확인 후 이미지 수정 |
| CrashLoopBackOff | 앱 런타임 에러 | 이전 로그 `--previous` 확인, 환경변수/리소스 조정 |
| Pending | 리소스 부족 | `kubectl top nodes` 로 자원 확인 후 스케일 업 |

## ▶ 다음 단계
- Service & Networking (예정)
- ConfigMap & Secret (예정)

##  참고
- Pod Docs: https://kubernetes.io/docs/concepts/workloads/pods/
- Deployment Docs: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
