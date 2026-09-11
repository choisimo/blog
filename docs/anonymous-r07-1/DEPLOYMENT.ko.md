# R07-1 검증과 적용 순서

이 통합본은 소스 반영본이다. 운영 인증·실제 D1/R2·전체 frontend bundle은 미검증이며 이미지 기능은 계속 꺼져 있다.

## 선결 조건

1. 원본 저장소에서 누락된 `workers/api-gateway/src/routes/secrets` 구현을 결합한다. placeholder로 채우지 않는다.
2. workspace lockfile대로 의존성을 설치한다. frontend 게시글 원문을 결합하기 전 `prebuild`나 `generate-manifests`를 실행하지 않는다.
3. 현재 운영의 migrations와 `0040_anonymous_identity_revocations.sql` 번호 충돌 여부를 확인한다. 기존 `0039`를 덮어쓰지 않는다.
4. origin 백엔드가 공개 요청에서 Worker 검증을 우회하지 못하도록 기존 서명 검증/접근 제한을 실제 운영 설정으로 확인한다.

## 로컬 재검사

저장소 루트에서 실행한다. 분리 SQLite 검사는 Node.js 22 이상과 TypeScript가 필요하다. 컴파일러는 각 workspace 설치 경로 또는 전역 npm 경로에서 찾는다.

```bash
npm run verify:anonymous
node scripts/verification/r07-1/syntax.cjs
node scripts/verification/seo-a01-offline.cjs
# reader-image-contracts는 TypeScript 모듈 경로를 명시할 수 있다.
TYPESCRIPT_PATH="$(npm root -g)/typescript" node scripts/verification/reader-image-contracts.cjs
python scripts/verification/anonymous_r07_fixture_browser.py
```

실제 Workers/Hono/D1 및 브라우저 origin을 사용할 수 있는 환경에서 이어 실행한다.

```bash
npm --prefix workers/api-gateway ci
npm --prefix workers/api-gateway run typecheck
npm --prefix workers/api-gateway test -- --run test/auth-contract.test.ts test/anonymous-ownership.test.ts test/memos-route.test.ts test/images-route.test.ts
npm --prefix workers/seo-gateway ci
npm --prefix workers/seo-gateway run verify
python scripts/verification/anonymous_r07_browser.py
```

`anonymous_r07_browser.py`는 실제 localStorage/Web Locks를 시험하지만 HTTP 응답은 여전히 fixture다. 실제 API 서버와 연결한 브라우저 시험은 별도로 수행한다. 현재 환경에서는 위 browser navigation 자체가 차단되어 있다.

## staging 적용

새 클라이언트는 기존 서버가 갱신 실패를 새 주체 성공으로 응답해도 주체 불일치를 거절한다. 따라서 먼저 해당 클라이언트 자산을 준비하고, `0040` 적용 후 전체 API Worker를 같은 revision으로 배포하는 순서를 사용한다.

```text
원본 누락 보완 / 의존성 / 테스트
  → 공유 runtime·메모 자산 동기화
  → staging D1에 0040 적용
  → API Worker 인증 경계 전체 배포
  → frontend와 memo JS·runtime asset 배포
  → staging 소유 증명·읽기·변경·철회·복구 확인
```

memo script version은 `20260910-r07-1`이다. `frontend/public/ai-memo/anonymous-session.js`를 함께 배포하고 CDN의 이전 JS가 남아 있지 않은지 확인한다. root package export와 public runtime 사본의 byte 일치 검사를 통과시켜야 한다.

확인할 결과는 ID-only 401, 다른 주체 증명 403, 정상 갱신 후 메모/이미지 owner 동일, 철회 후 읽기/쓰기 401, DB 장애 503, 회원 요청이 guest로 자동 재시도되지 않음, 실패/취소 후 로컬 메모 유지다. guest image quota는 여전히 KST 일별 5장이다. 일반 회원가입·사용량 이관은 이 PR에서 추가하지 않았다.

`FEATURE_READER_IMAGES`와 기존 backend 이미지 활성화 flag는 바꾸지 않는다. 이미지 운영 활성화에는 기존 A06/R07-2 검증도 필요하다.

## 실패·원복

`0040`이 없으면 익명 인증은 의도적으로 503으로 멈춘다. migration을 확인하지 않은 채 앱만 배포하지 않는다. 사용자에게 이를 자격 만료로 표시하거나 자동 새 계정을 발급하면 안 된다.

소유 증명 없는 발급이 가능한 이전 서버 revision으로 되돌리지 않는다. 문제가 생기면 신규 발급/갱신 노출을 제한하고 수정된 인증 경계를 유지한 채 복구한다. 철회 표식은 단순 rollback으로 삭제하지 않는다. 메모·이미지·설정·당일 quota 데이터의 삭제나 이동은 필요하지 않다.

인증이 끝난 진행 중 요청은 철회 이후에도 완료될 수 있다. 이미 발급된 의심 토큰은 별도 사고 대응 대상이며 이 패치만으로 소급 정당성을 증명할 수 없다. 로그에 토큰/원문을 출력하지 않고, 확인된 주체 단위로 대응한다.

## 다음 재개 위치

A01 actual runtime/staging과 R07-1 actual Worker·React dialog·다중 탭/지속성 확인은 미완료다. API Worker의 기존 `secrets` 소스 누락도 먼저 보완해야 한다. 코드상 다음 주요 기능 작업은 A02(번역 실행·상태·복구 통합)이며 현재 tasks.md에 상세 범위가 남아 있다. 미검증된 R07-1을 전체 운영 완료로 표시하지 않는다.
