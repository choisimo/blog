# Docker 환경 설정 가이드

## 사용법

### 1. 자동 설정 (권장)
```bash
# 블로그 프로젝트 경로와 함께 실행
./setup-docker.sh /path/to/your/blog/project

# 또는 대화형으로 실행
./setup-docker.sh
```

### 2. 수동 설정

1. **환경 변수 설정**
   ```bash
   cp .env.example .env
   # .env 파일에서 BLOG_DIR을 실제 블로그 프로젝트 경로로 수정
   ```

2. **클라이언트 빌드**
   ```bash
   cd client
   npm install
   npm run build
   cd ..
   ```

3. **Docker 컨테이너 실행**
   ```bash
   docker-compose up --build -d
   ```

## 접속 정보

- **Frontend (Nginx)**: http://localhost
- **Frontend (Direct)**: http://localhost:3000  
- **Backend API**: http://localhost:5000

## 네트워크 구성

- **네트워크 이름**: blog-network
- **서브넷**: 172.20.0.0/16
- **브릿지 타입**: Docker bridge network

## 볼륨 구성

- **blog_data**: 블로그 데이터 영구 저장
- **posts 마운트**: 호스트의 실제 블로그 프로젝트와 연결

## 유용한 명령어

```bash
# 로그 확인
docker-compose logs -f

# 특정 서비스 로그만 확인
docker-compose logs -f blog-admin-backend

# 컨테이너 상태 확인
docker-compose ps

# 컨테이너 재시작
docker-compose restart

# 컨테이너 중지
docker-compose down

# 볼륨 포함 완전 제거
docker-compose down -v

# 컨테이너 내부 접속
docker-compose exec blog-admin-backend sh
```

## 문제 해결

### 포트 충돌 시
```bash
# 사용 중인 포트 확인
netstat -tulpn | grep :3000
netstat -tulpn | grep :5000

# docker-compose.yml에서 포트 변경
# 예: "3001:3000" (호스트:컨테이너)
```

### 컨테이너 재빌드
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 보안 고려사항

- 프로덕션 환경에서는 nginx.conf에 SSL 설정 추가
- 환경 변수로 민감한 정보 관리
- 방화벽 설정으로 필요한 포트만 노출