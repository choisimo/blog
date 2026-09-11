# R07-1 — 익명 자격의 소유 증명과 안전한 갱신

기준: 2026-09-10. 입력은 `blog-integrated-a01-20260910.zip`이며 SHA-256은
`feca35831765fa2937abebb9203372fe1ad92e44cda207019cac1c2042aac713`이다.
원격 PR 생성·병합, 운영 DB 변경·배포·AI 호출은 수행하지 않았다.

## 이번 범위

A01의 남은 의존성 설치를 먼저 재시도했다. npm registry DNS 연결은 실패했고, offline 설치도 `youch-core` 캐시 부재로 중단됐다. A01을 완료로 바꾸지 않고 작업 목록에서 병행 가능하다고 정한 P0 R07-1을 구현했다. 기존 메모 UI, Chat·토론 이미지 연동, AI 설정, 5장 한도, A01 SEO 수정은 유지했다.

| 이전 상태 | 변경 후 |
|---|---|
| 익명 ID 문자열만 제출하면 같은 `sub`의 토큰을 발급할 수 있었다. | 새 ID는 서버가 생성한다. ID를 이어 쓰려면 유효한 기존 익명 access token이 필요하다. |
| 갱신 중 어떤 오류가 나도 새 ID를 발급하는 경로가 있었다. | 잘못됨·만료·철회는 401, 소유자 불일치는 403, 인증 저장소 장애는 503으로 구분한다. 오류를 새 ID 성공 응답으로 바꾸지 않는다. |
| JWT header의 알고리즘 확인이 없고 exp 누락/만료 시각 경계가 허용될 수 있었다. | HS256/JWT 및 지원하지 않는 critical header, issuer/audience, 정수형 exp/nbf를 확인한다. exp와 현재 시각이 같으면 만료다. |
| 익명 자격 철회를 조회할 저장소가 없었다. | `0040`에 주체 전체 철회 표식을 저장한다. 같은 주체의 이전·갱신 토큰 모두 Worker에서 거절한다. |
| React와 메모장이 각각 갱신 실패 때 토큰을 지우고 새로 발급했다. | 같은 lifecycle을 사용한다. 일시 장애에는 아직 유효한 같은 토큰을 유지하며, 확정 거절에는 명시적인 복구 선택이 필요하다. |
| 실패한 회원 요청이 익명 요청으로 바뀔 수 있었다. | 회원 자격 실패를 이유로 같은 작업을 guest 계정에서 다시 수행하지 않는다. |
| 오래 걸린 응답이 다른 탭/계정 변경 뒤 로컬 자격을 덮어쓸 수 있었다. | 저장 직전 자격과 생성 세대를 확인한다. 주체가 달라지면 이전 작업을 중단한다. |

## 구현 위치

- `workers/api-gateway/src/lib/anonymous-auth-service.ts`: 발급/갱신/철회 서비스. HTTP 의존성 없이 실제 JWT 검증과 저장소를 사용한다.
- `lib/anonymous-identity.ts`, `lib/jwt.ts`: Bearer 형식, 익명 claims, 서명·만료 검사, 철회 조회.
- `routes/auth.ts`: 기존 TOTP/OAuth/관리자 refresh 흐름을 유지하고 익명 세 경로를 서비스에 연결한다. 인증 응답은 no-store다.
- `middleware/auth.ts`, `lib/auth-helpers.ts`: 메모/이미지/설정의 인증에 같은 철회 검사를 사용한다. 후속 처리 오류를 잘못된 자격 401로 바꾸지 않는다.
- `lib/forwarded-access.ts`, `lib/backend-proxy.ts`, `index.ts`: 클라이언트 인증을 origin에 전달하기 전 검증한다. 서버가 별도로 넣는 공급자 키와는 구분한다. client Authorization을 명시적으로 버리는 경로의 기존 정책은 유지한다.
- `shared/src/runtime/anonymous-session.js`: React와 classic memo의 단일 갱신 로직. public 사본은 `sync-anonymous-session.mjs`로 생성하고 byte 일치를 검사한다.
- `AnonymousSessionRecoveryDialog.tsx`: 만료/분실된 자격에서 로컬 메모를 그대로 두고, 새 주체 시작의 차이를 확인한 후 진행한다. 실패한 저장/생성 요청을 자동 재실행하지 않는다.

## API 동작

| 요청 | 조건 | 결과 |
|---|---|---|
| `POST /api/v1/auth/anonymous` + `{}` | 기존 자격을 요구하지 않는 새 방문 | 서버가 새 UUID를 정하고 30일 익명 access token 발급 |
| 같은 경로 + `existingId` | 기존 유효 토큰과 주체가 일치 | 같은 `sub`, 새 `jti`로 발급 |
| 같은 경로 + `existingId` | 증명 없음/다른 주체 | 401/403, 새 토큰 없음 |
| `POST /api/v1/auth/anonymous/refresh` | 유효·미철회 익명 access token | 같은 주체로 갱신 |
| 같은 경로 | 만료·잘못된 용도·철회 | 401, 새 주체로 자동 전환하지 않음 |
| `POST /api/v1/auth/anonymous/revoke` | 자기 익명 access token | 해당 주체의 이후 인증을 차단. 개인 데이터 삭제 없음 |
| 발급/인증 검사 | `0040` 누락·DB 장애 | 503, 원래 자격과 데이터를 보존하고 새 발급 성공으로 숨기지 않음 |

새 `jti`가 없어도 이전의 **유효한 정규 익명 tokenClass/access/UUID 토큰**은 그대로 갱신할 수 있다. 기존 정상 사용자를 일괄 로그아웃하거나 이미지 소유 키를 재계산하지 않았다. 비회원 일별 5장과 같은 네트워크의 일별 제한도 유지한다.

## 실패·동시 처리 경계

동일 탭의 React와 메모 호출은 같은 pending promise에 합류한다. Web Locks를 제공하는 브라우저에서는 동일 origin의 탭 사이도 발급 전에 잠금을 얻고 저장값을 다시 읽는다. 미지원 환경에서는 동일 탭 직렬화와 저장 직전 비교만 제공하며, 다중 탭의 완전한 원자성을 보장한다고 하지 않는다.

명시적 새 세션 시작은 현재 저장 토큰과 확인 당시 토큰이 같아야 한다. 취소·컴포넌트 해제·회원 로그인 때문에 상황이 바뀌면 새 자격을 로컬에 반영하지 않는다. 새 주체로 바뀌기 전부터 기다리던 요청도 다른 소유자로 이어 실행하지 않는다. 새 세션 시작은 이전 데이터의 삭제·이관·회원가입이 아니다.

철회 표식은 `anonymous-revocation:v1:<sub>`의 SHA-256과 철회 시각만 저장한다. 원문 토큰·IP·메모는 저장하지 않는다. 표식을 일상 TTL 정리로 삭제하면 안 된다. 이미 인증을 마친 진행 중 요청을 소급 취소하는 기능은 아니다.

이전 취약 경로에서 이미 발급됐을 수 있는 토큰이 정당한 소유자의 것인지 서명만으로 소급 구별할 수는 없다. 의심되는 주체에는 운영자가 확인 후 철회를 적용해야 한다. 이 작업에서 실제 침해를 발견하거나 운영 토큰을 철회한 것은 아니다. 원본 백엔드에 직접 접근하는 경계는 별도 운영 서명·네트워크 차단 검증이 필요하다.

## 실행한 검증

| 검증 | 결과 / 범위 |
|---|---|
| R07-1 분리 검사 | **84개 통과**. 실제 WebCrypto 서명/검증, 생산 코드의 SQL을 SQLite에서 실행, 브라우저 lifecycle과 실제 React 서비스 함수 검사. 네트워크/Storage/Zustand는 fixture다. |
| 동시 요청 | 새 방문 100개 주체의 유일성, 갱신 100개의 동일 주체 유지, 동일 탭 초기 호출 100개의 1회 요청 합류를 각각 시험했다. 실제 운영 부하 시험은 아니다. |
| 메모장 DOM fixture | **6개 통과**, 페이지 오류 0. 생산 메모 컴포넌트를 실행했으나 memory Storage, fixture fetch, 모듈 로더/스타일 인라인을 사용했다. |
| 기존 SEO | **112개 통과**, 기존 A01 isolated Node suite 재실행. 실제 HTMLRewriter가 아니다. |
| 기존 이미지 | **26개 통과**, 기존 정책·예약·보관 계약을 실제 SQLite에서 재검사. |
| 변경 JS/TS 문법 | `syntax.json`에 파일별 결과. parse/transpile이지 전체 의미적 타입 검사가 아니다. |
| 실제 Workers integration | 테스트 6개를 추가했으나 Vitest 미설치로 시작하지 못했다. |
| 실제 다중 탭/지속성 | Chromium navigation이 `ERR_BLOCKED_BY_ADMINISTRATOR`로 차단돼 미검증. memory adapter 검사로 대체 완료 처리하지 않았다. |
| 전체 Worker typecheck | Workers/Vitest/Node 타입 의존성 부재로 시작 실패. |
| 실제 API·운영 배포 | 수행하지 않음. |

각 결과는 `verification/anonymous-r07-1/`에 있다. 역사적 A01/Reader 검증 파일을 이번 결과로 덮어쓰지 않았다.

## 입력 소스의 별도 누락

`workers/api-gateway/src/routes/registry.ts`가 import하는 `./secrets`의 구현 파일이 입력 ZIP에 없다. 제공된 이전 소스 ZIP/tar에도 같은 파일을 찾지 못했다. 이 작업에서 제거한 파일이 아니며, 관리자 권한 동작을 임의 stub으로 채우지 않았다. 원본 저장소의 실제 `secrets` 모듈을 결합해야 전체 API Worker를 빌드할 수 있다.

게시글 Markdown 역시 입력에 없다. 현재 Projects Markdown 68개와는 다르다. 원문을 확보하기 전 frontend prebuild / generate-manifests를 실행하지 않는다.

## 참고한 토큰 검증 규격

구현의 알고리즘 제한과 exp 검사는 RFC 8725의 JWT 검증 권고와 RFC 7519 §4.1.4를 참고했다. 규격을 참고했다는 사실이 전체 보안 감사를 완료했다는 의미는 아니다.

```text
https://www.rfc-editor.org/rfc/rfc8725.html
https://www.rfc-editor.org/rfc/rfc7519.html
```
