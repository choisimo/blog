---
title: "Docker와 Kubernetes 실전 가이드"
date: "2025-01-10"
category: "DevOps"
tags: ["Docker", "Kubernetes", "DevOps", "Container"]
excerpt: "컨테이너 기술의 핵심인 Docker와 오케스트레이션 도구 Kubernetes 활용법을 다룹니다."
readTime: "12분"
---

# Docker와 Kubernetes 실전 가이드

## Docker 기초

Docker는 애플리케이션을 컨테이너로 패키징하여 어떤 환경에서도 일관되게 실행할 수 있게 해주는 플랫폼입니다.

### Dockerfile 작성

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### Docker 명령어

```bash
# 이미지 빌드
docker build -t myapp:latest .

# 컨테이너 실행
docker run -p 3000:3000 myapp:latest

# 컨테이너 목록 조회
docker ps
```

## Kubernetes 기초

Kubernetes는 컨테이너화된 애플리케이션의 배포, 확장, 관리를 자동화하는 오케스트레이션 플랫폼입니다.

### Pod 정의

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
spec:
  containers:
  - name: myapp
    image: myapp:latest
    ports:
    - containerPort: 3000
```

### Deployment 생성

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myapp:latest
        ports:
        - containerPort: 3000
```

## 실전 활용 팁

### 1. 멀티 스테이지 빌드
Docker 이미지 크기를 줄이기 위해 멀티 스테이지 빌드를 활용하세요.

### 2. 헬스 체크
애플리케이션의 상태를 모니터링하기 위해 헬스 체크를 구현하세요.

### 3. 로그 관리
중앙화된 로그 시스템을 구축하여 문제 해결을 용이하게 하세요.

## 결론

Docker와 Kubernetes는 현대적인 애플리케이션 배포의 핵심 기술입니다. 점진적으로 학습하고 실무에 적용해 나가는 것이 중요합니다.