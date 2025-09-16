# Docker Guide (Backend API)

이 문서는 백엔드 API 서버를 Docker/Docker Compose로 구동하는 방법과 운영 시 고려사항을 정리합니다.

## 이미지 빌드
프로젝트 루트에서:

```bash
docker build -t blog-backend:local backend
```

- 베이스: `node:20-alpine`
- 포트: `5080`

## 단독 컨테이너 실행 (로컬 테스트)
변경 사항을 호스트에 보존하려면 `frontend/public`을 바인드 마운트하세요.

```bash
# .env 준비
cp -n backend/.env.example backend/.env

# 임시 또는 실제 정적 경로 선택
PUBLIC_DIR=$(realpath frontend/public)
mkdir -p "$PUBLIC_DIR"

docker run --rm -it \
  --name blog-backend \
  -p 5080:5080 \
  --env-file backend/.env \
  -v "$PUBLIC_DIR:/frontend/public" \
  blog-backend:local
```

- API 확인: `http://localhost:5080/api/v1/healthz`
- 업로드 파일은 컨테이너 내 `/frontend/public/images`에 저장되며, 호스트의 `frontend/public/images`에 반영됩니다.

## docker compose (nginx 리버스 프록시 포함)
`backend/docker-compose.yml`을 사용하면 API와 nginx를 함께 구동합니다.

1) `.env` 준비

```bash
cd backend
cp -n .env.example .env
```

2) (권장) `docker-compose.override.yml`로 정적 자산 볼륨과 포트를 오버라이드

```yaml
# backend/docker-compose.override.yml
services:
  api:
    volumes:
      - ../frontend/public:/frontend/public
  nginx:
    ports:
      - "8091:80"
```

3) 실행

```bash
docker compose up --build
# http://localhost:8091/api/v1/healthz
```

### Nginx 업로드 용량
`backend/nginx.conf` 기본 설정은 `client_max_body_size 2m`입니다. 이미지 업로드가 413으로 실패하면 값을 늘리세요.

```nginx
server {
  client_max_body_size 25m; # 필요 시 확대
  ...
}
```

## 환경 변수 전달
- compose: `env_file: .env`
- docker run: `--env-file backend/.env`

운영에서는 `ADMIN_BEARER_TOKEN`을 반드시 설정하고, `ALLOWED_ORIGINS`를 제한하세요.

## 퍼시스턴스 전략
- 게시글/이미지 파일은 컨테이너 수명과 별개로 유지되어야 합니다.
- 권장: 호스트 디렉터리 `frontend/public`을 컨테이너 `/frontend/public`에 마운트.
- 대안: 외부 볼륨(예: `-v blog_public:/frontend/public`) 사용.

## 헬스체크/모니터링
- 헬스: `GET /api/v1/healthz`
- 로그: `docker compose logs -f api` 또는 `docker logs -f blog-backend`

## 보안 체크리스트
- `ADMIN_BEARER_TOKEN` 설정
- `ALLOWED_ORIGINS` 제한
- 프록시 앞단에서 HTTPS 종단
- 레이트 리밋(`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`) 적절히 설정

## 업그레이드/배포 팁
- 이미지 태깅: `blog-backend:<git-sha>` 또는 날짜 태그
- 롤백 대비 이전 태그 보존
- 프론트 정적 자산과 동일 볼륨을 공유해 컨텐츠 일관성 유지
