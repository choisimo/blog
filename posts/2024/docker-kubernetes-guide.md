---
title: "Docker와 Kubernetes 삽질기"
date: "2024-10-04"
category: "DevOps"
tags: ["Docker", "Kubernetes", "DevOps", "Container"]
excerpt: "컨테이너 기술의 핵심인 Docker와 오케스트레이션 도구 Kubernetes 활용법을 다룹니다."
readTime: "12분"
---

# Docker와 Kubernetes 삽질기

## Docker를 처음 만났을 때

사실 처음에는 Docker가 뭔지도 몰랐다. "내 컴퓨터에서는 잘 되는데?" 하는 상황을 겪다가 선배가 "Docker 써봐"라고 해서 시작했다.

가상머신과 비슷한 건가 싶었는데, 막상 써보니 훨씬 가볍고 빠르더라. 특히 팀 프로젝트할 때 "내 환경에서는 안 돼요" 이런 문제가 없어지니까 정말 편했다.

### 첫 Dockerfile 만들어보기

Node.js 프로젝트를 Docker로 감싸보는 게 첫 도전이었다.

```dockerfile
# 처음 만든 Dockerfile (지금 보니 개선할 점이 많다)
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json 먼저 복사 (캐싱 활용하려고)
COPY package*.json ./
RUN npm ci --only=production

# 나머지 소스코드 복사
COPY . .

# 포트 열어주기
EXPOSE 3000

# 앱 실행
CMD ["npm", "start"]
```

처음에는 이게 뭔지도 모르고 그냥 복붙했는데, 나중에 하나씩 이해하니까 재밌더라. 특히 package.json을 먼저 복사하는 이유를 알았을 때 '아, 이래서 Docker가 빠른구나' 싶었다.

### Docker 명령어들 - 처음엔 헷갈렸다

```bash
# 이미지 빌드하기
docker build -t my-app .

# 컨테이너 실행하기  
docker run -p 3000:3000 my-app

# 실행 중인 컨테이너 확인
docker ps

# 컨테이너 안으로 들어가기 (디버깅할 때 유용함)
docker exec -it container_name /bin/sh
```

처음에는 `docker run`과 `docker exec`의 차이도 몰랐다. 컨테이너가 왜 자꾸 종료되는지도 몰라서 한참 헤맸다.

### docker-compose - 여러 컨테이너 관리하기

프로젝트가 복잡해지면서 데이터베이스, 레디스, 앱 서버를 다 따로 실행해야 했다. 그때 docker-compose를 알게 됐다.

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - db
      - redis
    environment:
      - DB_HOST=db
      - REDIS_HOST=redis

  db:
    image: postgres:13
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:alpine
    
volumes:
  postgres_data:
```

이제는 `docker-compose up` 한 번이면 개발 환경이 뚝딱 세팅된다. 신입팀원이 와도 "Docker 설치하고 이 명령어만 쳐봐"라고 하면 끝이니까 정말 편하다.

## Kubernetes - 이건 진짜 어려웠다

Docker에 어느 정도 익숙해진 후에 Kubernetes를 처음 접했을 때는 정말 막막했다. '이게 정말 필요한가?' 싶기도 하고.

하지만 서비스 규모가 커지면서 필요성을 느꼈다. 컨테이너가 죽으면 자동으로 다시 시작해주고, 트래픽에 따라 자동으로 확장/축소해주고...

### 첫 Pod 만들어보기

```yaml
# my-first-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app-pod
  labels:
    app: my-app
spec:
  containers:
  - name: my-app
    image: my-app:latest
    ports:
    - containerPort: 3000
```

Pod가 뭔지도 모르고 일단 만들어봤다. "컨테이너를 감싸는 또 다른 껍데기?" 정도로 이해했는데, 나중에 보니 Pod는 쿠버네티스의 기본 단위더라.

### Deployment - Pod들을 관리하는 상위 개념

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app-deployment
spec:
  replicas: 3  # Pod를 3개 실행
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-app
        image: my-app:latest
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
```

Deployment를 처음 만들어보고 `kubectl get pods`를 쳤을 때 Pod 3개가 자동으로 생성된 걸 보고 신기했다. 하나를 지워도 자동으로 다시 생성되더라.

### Service - 외부에서 접근하게 하기

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app-service
spec:
  selector:
    app: my-app
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

Pod들은 내부 IP를 갖고 있어서 외부에서 직접 접근할 수 없다는 걸 모르고 한참 헤맸다. Service를 만들어야 한다는 걸 알고 나서야 해결됐다.

## 실제로 겪은 삽질들

### 이미지 태그 관리

처음에는 `latest` 태그만 썼는데, 배포할 때마다 어떤 버전인지 헷갈리더라. 지금은 Git commit hash나 버전 번호를 태그로 쓴다.

```bash
# 이전: 어떤 버전인지 모름
docker build -t my-app:latest .

# 지금: 명확한 버전 관리
docker build -t my-app:v1.2.3 .
docker build -t my-app:abc123def .
```

### 리소스 설정

리소스 제한을 안 걸어놨다가 Pod 하나가 메모리를 다 먹어서 노드가 죽은 적이 있다. 그 이후로는 항상 requests/limits를 설정한다.

### 볼륨 마운트

데이터가 컨테이너와 함께 사라진다는 걸 몰라서 중요한 데이터를 날린 적이 있다. 이후로는 영구 저장이 필요한 건 꼭 PersistentVolume을 쓴다.

```yaml
# PersistentVolumeClaim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-app-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

### Secret 관리

처음에는 환경변수에 비밀번호를 그대로 넣었는데, 이게 보안상 위험하다는 걸 알고 Secret을 쓰기 시작했다.

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-app-secret
type: Opaque
data:
  database-password: cGFzc3dvcmQxMjM= # base64 인코딩된 값
```

## 지금 쓰고 있는 워크플로우

### 개발 환경
로컬에서는 docker-compose를 쓴다. 빠르고 간단해서.

### 스테이징/프로덕션
Kubernetes를 쓴다. 자동 복구, 스케일링, 롤링 업데이트 등이 필요해서.

### CI/CD 파이프라인
```yaml
# GitHub Actions 예시
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Build Docker image
      run: |
        docker build -t my-app:${{ github.sha }} .
        
    - name: Push to registry
      run: |
        docker push my-app:${{ github.sha }}
        
    - name: Deploy to Kubernetes
      run: |
        kubectl set image deployment/my-app my-app=my-app:${{ github.sha }}
```

## 앞으로 배워보고 싶은 것들

### Helm
Kubernetes 매니페스트 파일들이 점점 많아지면서 관리가 어려워지고 있다. Helm을 써서 템플릿화하면 좋을 것 같다.

### Istio
서비스 메시라는 개념이 궁금하다. 특히 마이크로서비스 간 통신을 관리하는 부분이.

### 모니터링
Prometheus + Grafana 조합을 써보고 싶다. 지금은 그냥 로그만 보는데, 메트릭도 제대로 수집하고 싶다.

## 마무리하며

Docker와 Kubernetes를 배우면서 느낀 건, 처음에는 복잡해 보이지만 하나씩 이해하면 정말 강력한 도구라는 것이다.

특히 "내 컴퓨터에서는 잘 되는데"라는 말을 안 하게 된 게 가장 큰 수확이다. 개발 환경과 프로덕션 환경이 동일하니까 예상치 못한 버그가 줄어들었다.

물론 아직 배울 게 많다. 특히 Kubernetes는 정말 깊이가 있는 기술이라 계속 공부해야 할 것 같다. 하지만 한 번 익숙해지면 정말 편한 도구인 건 확실하다.
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