# Reader experience delivery · 2026-09-10

첨부 소스 전체에 메모장 작업 공간, AI 응답 설정, Chat/토론 이미지 카드, 서버 이미지 한도 및 비공개 보관 경로를 적용한 결과다. 새 파일만 따로 모은 패치 설명이 아니라 기존 프로젝트 전체 소스다.

## 먼저 읽을 문서

- `docs/reader-experience/PLAN.ko.md`: 변경 내용, 비회원/회원 정책, 구현 범위와 남은 작업
- `docs/reader-experience/DEPLOYMENT.md`: migration·비공개 R2·provider 연결과 활성화 순서
- `docs/reader-experience/tasks.md`: PR 단위 완료/미완료 항목
- `verification/reader-experience/`: 검증 로그, 실제 메모장 컴포넌트의 브라우저 스크린샷

## 적용 상태

메모장 개선과 설정 UI는 소스에 반영했다. 새 이미지 생성은 Backend/Gateway의 `FEATURE_READER_IMAGES=false`가 기본값이다. migration 0039, 전용 비공개 `READER_IMAGES_R2`, 기존 AI-server 연결·서명 설정을 staging에서 확인한 뒤 활성화한다. 기존 공개 이미지 bucket을 새 생성물 저장소로 대신 쓰지 않는다.

비회원 5장/일은 서버 정책으로 고정했다. 회원 20장/일 및 전체 서비스 500장/일은 설정 가능한 초기 제안값이다. 갱신은 한국 시간 00:00이다. 일반 회원가입은 이번 변경에 포함하지 않았으며, 현재 관리자 인증과 분리해서 구현할 계획을 제공한다.

## 확인한 결과

- 실제 정책 함수/SQL/migration을 사용한 Node 계약 테스트 26개 통과. 8개 독립 SQLite 연결의 동시 예약 검증 포함.
- 실제 메모장 JS/CSS를 Chromium에 넣은 9개 테마/화면 폭 조합 통과. 저장소는 오류 주입 가능한 메모리 어댑터이며 실제 localStorage 지속성이나 로그인 E2E가 아니다.
- 변경된 소스의 TS 구문 변환, JS 구문, CSS parse 통과. 전체 타입 검사나 번들 성공을 의미하지 않는다.
- API 계약·라우트 스냅샷 일치 확인. 원본에 스냅샷이 없어 현재 계약으로 초기 생성했다.
- 전체 dependency 설치는 완료되지 않았다. offline cache의 `zwitch` 누락으로 전체 build/Vitest/Hono 통합 테스트를 실행하지 못했다.
- 운영 배포, 유료 이미지 생성 호출, 실제 D1/R2/인증/provider E2E는 실행하지 않았다.

## 기준 파일

원본: `blog--snapshot--source-repro--feat_organizing-intelligence-citations--3ece77621379--20260910T083732+0900--dirty.tar.gz`

원본 SHA-256: `f3ba44ce1b823c5905a12e32957344b52e142b1b0c1093b954cc7bf17a9fd1c0`

압축본에서 `.git`, `node_modules`, 도구 캐시를 제외했다. 글꼴 파일은 포함하지 않았다. 기존 소스와 변경 파일, 계획 문서, 검증 스크립트/증거를 포함한다. 검증 스크립트는 필요한 Node/Python 의존성을 설치한 환경에서 실행한다. syntax 검증은 `.git`이 없으면 동봉한 `changed-files.json`을 사용한다.
