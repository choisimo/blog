# 디자인 변경의 보존 계약 검증 — 2026-09-08

## 변경 범위

원본 보존 기준은 수정하지 않고, 사용자 요청에 따라 달라진 동작만 기존 명시 amendment 경로로 기록했다.

- `docs/ui-refactor/lifecycle-amendments.json`: Index의 명시적 다시 시도·오류 상태·취소 가드가 포함된 effect 1개를 추가 기록했다. 새로운 `declarationAmendments`에는 Footer.handleSubscribe와 Index.handleSearchFocus 두 선언의 원래 해시, 현재 해시, 변경 이유, 관련 테스트를 기록했다.
- `docs/ui-refactor/remaining-page-contracts.json`: 실제 mismatch 36개를 대조했다. 홈·탐색 26개, Insight 선택 1개, ProjectCard 동작 이름 1개, AdminSubtabs 가시성/초점 2개, Footer 구독 요청 2개, About 연락 상태/소셜 링크 4개다. 기존 ProjectCard amendment는 원래 before를 유지하고 최종 동작과 after로 갱신했으며 나머지는 명시 항목을 추가했다.
- `frontend/scripts/ui-foundation-contracts.test.mjs`: 원본 선언은 계속 원본 해시와 비교한다. 명시된 선언만 amendment.after와 비교하며, amendment가 실존하는 원본 선언을 가리키고 before가 원본과 일치하는지, 이유가 비어 있지 않은지, test/spec 파일이 저장소 안에 실제 존재하는지, 중복 또는 알 수 없는 항목이 없는지 확인한다.
- `frontend/src/components/organisms/Footer.test.tsx`: invalid 입력의 요청 차단, 정상 요청/진행 중 잠금/성공, 실패 원문 보존/제공자 오류 숨김/입력 변경 후 피드백 초기화/재시도·기존 구독 상태를 검증한다. 모든 요청은 fetch mock으로 처리했다.

이 후속 작업에서 production TSX를 수정하지 않았다. 다른 담당자의 overlay/FAB 변경을 원인 분석 없이 amendment로 덮지 않았다. 작업 중 새로 나타난 AdminSubtabs의 두 mismatch는 실제 diff를 읽고 parent에게 먼저 보고한 뒤, 수직 페이지 점프 없이 선택한 탭만 가로로 드러내는 변경으로 기록했다.

## 원본 보존 확인

별도 Node assert 실행으로 다음을 확인했다.

1. `docs/ui-refactor/invariants.json`과 `baseline.json`의 현재 바이트가 각각 `git show HEAD:<file>`과 정확히 같다.
2. remaining-page-contracts의 `declarations` 전체 객체가 HEAD의 객체와 같다.
3. 기존 항목을 포함한 모든 remaining amendment의 `before`가 해당 원본 선언의 해시와 같다.
4. `/tmp/design-contract-diff.cjs`의 최종 출력은 빈 배열이다.

이는 변경 기록 없이 원본을 새 해시로 교체하거나, 불필요한 effect를 남겨 검사만 통과시키는 방식으로 처리하지 않았음을 검증한다.

## 실행 증거

```sh
cd frontend
node --test scripts/ui-foundation-contracts.test.mjs scripts/ui-remaining-pages.test.mjs
npm run test:run -- src/components/organisms/Footer.test.tsx
```

- 보존/실제 핸들러 검사: **148개 중 148개 통과**, 실패/skip/cancel 0. 이번 실행 로그는 `/tmp/blog-design-contracts-amended.log`에 있다.
- Footer 단위 테스트: **3개 중 3개 통과**. invalid 주소, pending/success, failure/retry/already subscribed를 검증한다.
- 추가 무변경 실험: 실제 신규 amendment 검증 블록을 VM에서 실행하여 유효한 기록을 받아들이고, 잘못된 before·알 수 없는 선언·빈 이유·빈 테스트 목록·없는 테스트·문서를 테스트로 지정·저장소 밖 경로·잘못된 after 형식·중복 기록의 **9가지 잘못된 기록을 모두 거부**함을 확인했다. 이 실험은 추적 파일을 바꾸지 않았다.
- `git diff --check`는 이 후속 작업의 JSON/checker/test 파일 범위에서 통과했다.

관련 동작 근거는 `discovery.md`, `secondary-pages.md`, `workspaces.md`와 각 amendment의 `tests`에 연결했다. Inspector focus와 구독 실패 상태는 `frontend/e2e/site-design.spec.ts`에 실제 브라우저 회귀 시나리오가 있다. 파일 존재 검사는 해당 브라우저 테스트 실행 성공을 뜻하지 않으며 브라우저 실행 결과는 root 통합 보고서를 따른다. 이 148개 guard는 정적 source 계약과 분리된 실제 핸들러 실행의 증거이며 전체 렌더링·외부 API 가용성 검증으로 확대하지 않는다.

최종 추가 검사: 전체 `npm run type-check` 통과, 신규 `Footer.test.tsx` 범위 ESLint 오류/경고 0개. 검사 직후 contract diff를 다시 실행해 새 mismatch가 없음을 확인했다.

## 실제 manifest 실패 경로의 후속 amendment

최종 브라우저 검수에서 실제 manifest 실패가 빈 성공 캐시로 변환되는 문제를 발견하여 root의 명시적 승인으로 service와 adapter의 실패 경계를 수정했다. 이 후속 변경은 위 초기 계약 정리와 별개이며 `discovery-failure.md`에 근거를 기록했다. Index·Blog에서 `throwOnError` 읽기 옵션을 전달한 11개 선언(기존 amendment 5개 갱신, 새 6개 추가)과 Index effect의 현재 after·이유·실제 서비스 회귀 테스트를 추가 기록했다. `before`와 원본 declarations는 그대로 유지했다. 후속 guard 148개 및 type-check가 다시 통과했으며 `/tmp/design-contract-diff.cjs` 결과는 빈 배열이었다.
