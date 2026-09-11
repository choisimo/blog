# A02 통합 소스 로컬 반영 — 2026-09-10

입력: `blog-integrated-a02-20260910.tar.gz`, SHA-256 `bf620d505e52485d645f29db4f26f7a6e1609d7aae710c4dcb3391b0b0e0da9c`.
기준: `feat/organizing-intelligence-citations`, HEAD `3ece7762`의 미커밋 작업을 포함한 실제 작업 트리.

## 반영 내용

- 번역 A02의 durable job/outbox, 단계별 checkpoint, 실행 lease, 읽기 전용 상태 관찰과 Backend wake/Worker drain 연결.
- R07-1 익명 소유 증명·철회와 공유 세션 runtime, AI 설정·독자 이미지 UI/API, SEO A01 변경.
- Projects Markdown 68개와 해당 원본으로 재생성한 manifest.
- migration 0039–0041 파일 추가. 로컬 테스트의 격리 DB에서 검증했으며 운영 DB에는 적용하지 않았다.

현재 저장소의 `secrets.ts` 두 파일, 게시글 원문·manifest·RSS·sitemap, k3s 설정, 기존 Sentio/FAB/모바일 작업은 보존했다. `backend/nginx.conf`는 현재의 `nginx/nginx.conf` 심볼릭 링크를 유지했다. 아카이브에 없는 파일은 삭제하지 않았다.

복구 스냅샷: `/home/nodove/workspace/blog-integration-backups/20260910-224016/before.tar.gz`.
같은 디렉터리에 변경 전 파일별 SHA-256, Git 상태, 원본 추출본이 있다. 복원 시 이후 작업을 덮어쓰지 않도록 파일별 비교 후 선택 복원한다. 기존 작업을 커밋·stash·reset하지 않았다.

## 통합 중 수정한 문제

1. Worker strict TypeScript에서 번역 실행 lease의 closure narrowing과 이미지 경로 파라미터의 undefined 검증을 수정했다.
2. Projects 생성/검토 도구에 기존 `gray-matter` 파서를 복원했다. 여러 줄 YAML, CRLF, YAML 배열을 실제 임시 Markdown 입력으로 검사했고 68개 ID의 유일성을 확인했다.
3. 새 설정·인증 복구창을 기존 Radix Sheet로 통합했다. 모바일/확장 채팅 모달 위에서 pointer events와 focus trap이 충돌하던 문제를 수정했다. 공유 UI primitive는 수정하지 않았다.
4. 변경된 queued 상태, outbox 결과, 채팅 preferences, 공유 익명 runtime에 맞게 기존 테스트 계약을 수정했다. 재사용된 Response 객체의 body 소진과 불완전한 Zustand 테스트 대역도 보정했다.
5. 계약 검사기가 익명 claims의 새 소유 모듈 `anonymous-auth-service.ts`를 추적하도록 수정하고 계약 snapshot을 재생성했다.

## 검증과 증거

현재 실행 기록은 `verification/integration-a02-20260910/`에 있다. 아카이브의 기존 `verification/*` 기록은 과거 전달본 기록이며 이번 실행의 증거와 구분한다.

| 검사 | 결과 및 범위 |
| --- | --- |
| A02 분리 검사 | 97 통과 — 실제 SQL/함수 + 외부 호출 fixture |
| R07-1 분리 검사 | 84 통과 |
| Reader 이미지 계약 | 26 통과 — SQLite |
| shared Zod 번역 계약 | 6 통과 |
| API Worker 타입·전체 테스트 | 타입 통과, 36개 파일·129개 테스트 통과 — 실제 workerd/D1 |
| Backend 전체 테스트 | 112 통과, 1 건너뜀 |
| SEO verify | 타입 통과, 단위 112 + 실제 HTMLRewriter 런타임 11 통과 |
| Frontend 타입·변경 영역 | 최종 타입 통과, 14개 파일·99개 테스트 통과 — 번역·인증·Projects·Sentio·채팅·메모·중첩 모달 |
| Frontend 번들 | Vite production bundle 통과. 콘텐츠 생성 prebuild/postbuild는 실행하지 않음 |
| 계약/라우트 검사 | 통과 |
| 실제 브라우저 | Chromium 390×900, 1440×900. Projects 68개 표시, 채팅 위 설정 저장/재열기, Tab 포커스 유지, Escape/포커스 복원, 인증 복구 확인 체크박스 통과. pageerror 없음 |

브라우저 증거: `frontend/verification-screenshots/integration-a02-20260910/`.
브라우저 검증은 외부 호스트 요청을 차단한 로컬 앱에서 수행했다. 인증 복구는 앱 이벤트로 창을 열고 확인 UI까지만 검사했으며 새 익명 주체 생성/실제 모델 호출은 하지 않았다. 이는 운영 인증·유료 생성 E2E를 증명하지 않는다.

전체 Frontend suite는 **전체 통과 상태가 아니다**. 초기 실행은 393개 파일 중 65개 실패, 1,556개 테스트 중 97개 실패였다. 반영 전 스냅샷에서 실패 파일 65개를 재실행해 93개 assertion 실패와 3개 파일 로딩 실패가 동일하게 재현됨을 확인했다. 이번 변경으로 발생한 2개의 오래된 기대값은 수정 후 통과했다. 나머지 FAB 2개는 반영 전·후 집중 실행에서 모두 통과했으나 전체 실행에서만 실패해 원인을 확정하지 않았다. 전체 suite의 잔여 문제는 `verification/integration-a02-20260910/frontend-baseline-comparison.md`에 기록했다.

## 체크섬 범위

입력 아카이브의 `MANIFEST.sha256`은 최종 내용과 52개 불일치했다. 현재 루트의 파일은 반영 후 내용으로 다시 생성했다. 범위는 전달본에 포함된 현재 파일(검증 스크린샷 제외)과 이번 통합에서 보완한 파일·기록이다. 현재 저장소의 모든 파일이나 운영 환경 일치를 증명하는 manifest는 아니다. 원래 체크섬 파일은 백업의 `incoming/blog/MANIFEST.sha256`에 보존했다.

## 배포 시 남은 경계

- `TRANSLATION_EXECUTION_ENABLED`, `TRANSLATION_WARM_ENABLED`, `FEATURE_READER_IMAGES`는 false 유지.
- 실제 D1 적용 전 구 번역 consumer 중지·백업·0041 전환과 rollback 검증 필요. 구/신 binary 혼합 쓰기를 허용하지 않는다.
- 실제 Backend–Worker SSE, 프록시 timeout, staging 독립 DB/KV, private R2, 공급자 비용·중단 복구는 아직 운영 검증하지 않았다.
- 30,000자 초과 번역과 Projects 전체 A03 후속 계획은 아카이브의 미완료 범위로 유지한다. YAML 호환성 복원만으로 A03 전체 완료를 선언하지 않는다.
- 원격 push, PR, 배포는 수행하지 않았다.
