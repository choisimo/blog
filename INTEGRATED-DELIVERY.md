# 통합 소스 + 다음 PR 작업 목록

2026-09-10 · 입력: `blog-integrated-source-20260910.zip`

## 시작 문서

- [`tasks.md`](tasks.md): 다음 14개 계획 PR의 순서, 현재 상태, 변경 파일, 완료/회귀 검증, 원복 조건.
- [`docs/implementation-plan/CURRENT-STATUS.md`](docs/implementation-plan/CURRENT-STATUS.md): 최신 통합본 재점검과 남은 문제, 검증 범위.
- [`docs/reader-experience/DEPLOYMENT.md`](docs/reader-experience/DEPLOYMENT.md): 이전 Reader 기능의 배포 설정. 새 tasks의 보안/통합 검증 항목과 함께 확인한다.
- [`docs/ai-seo-audit/`](docs/ai-seo-audit/): 사용자가 제공한 이전 감사 묶음의 원문. 원본 08:10 snapshot 분석으로, 최신 통합본 검증 결과와 구별한다.

애플리케이션 소스는 이번 정리에서 추가 구현/수정하지 않았다. 입력 ZIP의 의존성 사본을 제외한 기존 파일 1,957개를 보존하고 문서·진단 기록만 추가한 전달본이다. ZIP 파일명 metadata는 UTF-8로 명시한다.

## 사용 전 경계

현재 ZIP은 운영 배포가 검증된 완성본이 아니라 현재까지 작업한 소스 snapshot이다. 메모/AI 설정/이미지/번역/Projects 변경이 들어 있지만, A01/A02/A03과 익명 소유 증명 등의 수정/검증이 남아 있다. 실제 원격 PR은 생성하지 않았다.

게시글 Markdown 원문이 포함되지 않았으므로 원문을 결합하고 누락 검증을 통과하기 전에 `generate-manifests`나 전체 prebuild를 실행해 정상 manifest를 덮어쓰지 않는다. 개인 이미지 기능은 기본 비활성화 상태를 유지한다. R07-1과 A06/A10 검증 후 staging에서 기능을 활성화한다.

`node_modules`/`.git`은 전달하지 않는다. workspace별 package manifest와 lockfile을 사용한다. 실제 AI-server 계약·인증·private R2 연결·운영 DB·사용량·배포 환경은 별도 확인 대상이다.

## 확인 자료

이번 실행의 기록은 `verification/pr-plan-20260910/`에 있다. Reader SQLite 계약 테스트 26개 및 변경 파일 41개 문법 검사는 통과했다. 새 diagnostics 8개 그룹은 남은 문제의 재현도 포함하므로 기능 테스트 통과 수가 아니다. 의존성 부재로 원래 Frontend/Worker suite와 전체 타입/빌드 검증은 완료하지 못했다.

루트에서 `sha256sum -c MANIFEST.sha256`으로 포장 시의 파일 내용을 검증할 수 있다. 이는 기능 테스트나 source/운영 상태 일치 확인을 대신하지 않는다. 아카이브 자체의 체크섬은 함께 전달한 SHA256SUMS 파일에 있다.
