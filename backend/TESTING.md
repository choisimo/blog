# Testing Guide

백엔드 API 기능을 cURL/HTTP 클라이언트로 검증하는 방법을 정리했습니다. 운영에 영향을 주지 않도록 로컬 또는 샌드박스(임시 디렉터리)에서 테스트하세요.

## 사전 준비
- Node 20+ 또는 Docker
- `backend/.env` 생성 (예: `cp -n backend/.env.example backend/.env`)
- 로컬 실행 또는 Docker 실행(README/DOCKER 문서 참고)
- (권장) `ADMIN_BEARER_TOKEN` 설정 후 테스트

## 헬스체크
```bash
curl -s http://localhost:5080/api/v1/healthz
```

## Posts API
### 1) 목록 조회
```bash
curl -s "http://localhost:5080/api/v1/posts?year=2025&includeDrafts=true" | jq .
```

### 2) 신규 작성 (admin)
```bash
TOKEN="<your-admin-token>"
curl -s -X POST http://localhost:5080/api/v1/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "테스트 포스트",
    "year": "2025",
    "frontmatter": { "tags": ["test"], "category": "Dev" },
    "content": "본문입니다."
  }' | jq .
```

### 3) 단건 조회
```bash
curl -s http://localhost:5080/api/v1/posts/2025/testeuseu-poseuteu | jq .
# slug는 생성 로직에 따라 title을 slugify(lower, strict)한 값입니다.
```

### 4) 수정 (admin)
```bash
curl -s -X PUT http://localhost:5080/api/v1/posts/2025/testeuseu-poseuteu \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "frontmatter": { "published": false },
    "content": "수정된 본문입니다."
  }' | jq .
```

### 5) 삭제 (admin)
```bash
curl -s -X DELETE http://localhost:5080/api/v1/posts/2025/testeuseu-poseuteu \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### 6) 매니페스트 재생성 (admin)
```bash
curl -s -X POST http://localhost:5080/api/v1/posts/regenerate-manifests \
  -H "Authorization: Bearer $TOKEN" | jq .
```

## Images API
### 업로드 (admin)
```bash
curl -s -X POST http://localhost:5080/api/v1/images/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "year=2025" -F "slug=my-post" \
  -F "files=@/path/to/image.jpg" | jq .
# 또는 디렉터리 기반
# -F "dir=covers" -F "files=@/path/to/cover.png"
```

### 목록
```bash
curl -s "http://localhost:5080/api/v1/images?year=2025&slug=my-post" | jq .
# 또는
curl -s "http://localhost:5080/api/v1/images?dir=covers" | jq .
```

### 삭제 (admin)
```bash
curl -s -X DELETE http://localhost:5080/api/v1/images/2025/my-post/cover.png \
  -H "Authorization: Bearer $TOKEN" | jq .
```

## 샌드박스(안전) 테스트 팁
- 실제 콘텐츠를 보호하려면 임시 디렉터리를 `/frontend/public`에 마운트:
  - Docker: `-v $(mktemp -d):/frontend/public`
- 프록시(nginx) 앞에 둘 경우 `client_max_body_size`를 충분히 설정
- CORS가 필요한 클라이언트는 `ALLOWED_ORIGINS`에 원본 추가

## 자주 발생하는 이슈
- 401 Unauthorized: `Authorization: Bearer` 토큰 누락/오타
- 404 Not Found: 연도/슬러그/파일명 확인, `.md` 확장자 자동 처리 확인
- 413 Payload Too Large: Nginx/프록시 본문 크기 제한 증가
- 매니페스트 누락: 쓰기 직후 에러 로그 확인, 권한/볼륨 경로 확인
