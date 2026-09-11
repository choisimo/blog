# 제안 구현 작업 — PR 단위

기준: 첨부 blog snapshot `3ece77621379` / 2026-09-10 KST.

이 문서는 앞으로 구현할 작업안이다. PR을 만들거나 제품 코드를 수정한 결과가 아니다. `[ ]`는 미완료를 뜻한다. 상세 원인은 `analysis.md`, 파일·줄 번호는 `source-evidence.md` 참조.

## 공통으로 지킬 조건

- [ ] 이미 구현된 관리자 인증, 원문 읽기, 실제 채팅 SSE, 이미지 PNG/WebP 검증·저장, 에이전트 도구를 보존한다.
- [ ] 사용자 요청 ID, 원문 버전, 작업 ID, 산출물 버전을 끝까지 연결한다. 서버 키·원문 전체를 진단 로그에 남기지 않는다.
- [ ] 기존 정상 결과는 새 결과 검증·게시가 완료되기 전까지 유지한다. 실패·취소·늦은 결과가 현재 콘텐츠를 덮어쓰지 않는다.
- [ ] 동일 작업의 재연결과 새로 생성 요청을 구분한다. 취소 후에도 비용이 발생했는지 작업 장부로 추적한다.
- [ ] 전경 사용자 응답과 선택적인 SEO·이미지 선생성의 우선순위/한도를 분리한다.
- [ ] 운영 작업 전 현행 배포 commit, 실제 설정, 이미지 API 계약과 공개 가능 데이터 범위를 확인한다.

## 우선순위와 의존 관계

| PR | 우선순위 | 목적 | 선행 |
|---|---|---|---|
| A01 | P0 | SEO 자산/route 응답과 canonical 오류 수정 | 원본·배포 경계 확인 |
| A02 | P0 | 번역이 실제 실행되고 작업 상태를 표시하도록 연결 | 소비자·quota 계약 확인 |
| A03 | P0 | Projects 목록 복구 및 불완전 산출물 배포 차단 | 원문/검토 증거 확보 |
| A04 | P1 | 긴 글 번역·검증·버전·재생성 정합성 | A02 |
| A05 | P1 | 카드의 실제 점진 응답·대기/취소 UX·지연 측정 | 공통 request ID |
| A06 | P1 | 기존 AI-server 이미지 연동의 작업 내구성·승인 | 실제 AI-server 계약 확인 |
| A07 | P1 | 공개 본문 HTML·단일 SEO 데이터·언어별 URL | A01, A04의 번역 공개 계약 |
| A08 | P2 | Projects 사례 페이지·About 사실 기반 갱신 | A03, 공개 근거 확인 |
| A09 | P2 | 비용 제한형 배경 SEO/이미지 자동화 | A02/A04/A06/A07 |
| A10 | P2 | 접근성·작업 복원·보안 경계·배포 회귀 검증 | 앞선 PR 결과 통합 |

P0는 서비스 상태를 명확하게 만들기 위한 작업이다. 나머지를 기다렸다가 한 번에 배포하기보다, 각 수정의 회귀 검증을 통과하면 독립적으로 적용한다. 독립 작업은 병행할 수 있지만 완료되지 않은 결과의 API를 가정해 다음 작업을 확정하지 않는다.

## PR-A01 — 검색봇과 사용자가 올바른 콘텐츠를 받도록 수정

근거: E16–E20 / 진단 S01–S03.

주요 파일: `workers/seo-gateway/src/index.ts`, `post-resolver.ts`, `meta-rewriter.ts`, 해당 Worker 테스트.

- [ ] `/robots.txt`, `/sitemap.xml`, RSS, 정적 JS/CSS, 이미지, manifest는 UA와 무관하게 올바른 origin/Content-Type/상태 코드로 통과시킨다.
- [ ] `pathname.includes('.')`를 자산 판별 근거로 사용하지 않는다. 경로 prefix/정확한 route/알려진 자산 규칙을 사용한다.
- [ ] `/projects`를 실제 route로 해석하고 canonical을 자기 페이지로 설정한다.
- [ ] percent decoding/Unicode normalization을 한 번 적용해 공개 manifest의 slug와 비교한다. 경로 이동·제어문자 차단은 유지한다.
- [ ] 실제 없는 글은 404, origin 일시 장애는 적절한 5xx로 구분한다. 홈 HTML 200 또는 일괄 404로 숨기지 않는다.
- [ ] head가 중복 canonical을 만들지 않도록 소유 범위를 정의한다. 기존 canonical 존재 여부와 관계없이 정확히 하나만 남긴다.
- [ ] 운영 설정에 연결된 origin에서 path별 산출물을 실제로 제공하는지 확인한다.

완료 조건:
- [ ] Googlebot/Bingbot/일반 UA로 동일 robots/sitemap/js/css/png/manifest를 요청한 결과의 MIME·본문이 동일하다.
- [ ] 인코딩된 한글·공백 slug가 정확한 글 제목·설명·canonical을 반환한다.
- [ ] `/projects` canonical은 홈이 아니다. 존재하지 않는 글은 404이며 실제 글의 일시 origin 실패를 영구 삭제로 표현하지 않는다.
- [ ] Worker 실제 런타임 테스트도 통과한다. 이번 분석의 passthrough HTMLRewriter mock만으로 완료 처리하지 않는다.

되돌리기: routing 변경을 독립 feature flag/배포 revision으로 유지한다. 오류 시 마지막 정상 origin 응답을 복구하되 잘못된 crawler 전용 응답으로 돌아가지 않는 대안도 마련한다.

## PR-A02 — 번역 작업 실행과 관찰 계약 통합

근거: E01–E04, E06.

주요 파일: `workers/api-gateway/src/routes/translate.ts`, `lib/ai-artifact-outbox.ts`, `lib/domain-outbox.ts`, `routes/lib/translation-jobs.ts`, Worker scheduler/consumer 연결, `frontend/src/services/content/translate.ts`, `frontend/src/pages/public/BlogPost.tsx`.

- [ ] 현재 배포의 cron 외 flush 호출, queue.enabled/asyncMode, 소비자 상태를 확인하고 단일 실행 경로를 정한다.
- [ ] 기존 D1 outbox와 내부 translation job 중 중복된 상태 관리를 연결/정리한다. 별도 임시 제3 큐를 만들지 않는다.
- [ ] 공개 캐시 miss를 같은 `(postId, sourceVersion, locale)` 작업에 연결한다. 접수 후 소비자에게 즉시 실행 신호를 전달한다.
- [ ] 연결이 끊어져도 durable job은 남도록 하고, 스케줄러는 누락된 wake-up 복구 역할을 맡는다.
- [ ] interactive 우선순위를 실제 claim 순서에 반영하되 오래된 배경 작업의 영구 굶주림도 방지한다.
- [ ] foreground와 optional warm의 admission 조건을 구분한다. 무관한 provider down 때문에 모든 요청을 중단하지 않는다.
- [ ] `202`에 최소 job ID/관찰 가능한 status/재조회 지연을 제공한다. 공개 상태 API는 공개 글 산출물만 노출하고 강제 재생성 권한은 유지한다.
- [ ] API 간 slug 정책을 통일한다. 공개 글 3개가 UI에서 거부되는 문제를 수정한다.
- [ ] 20초 관찰 종료를 서버 실패로 표시하지 않는다. 원문 유지, 진행 상태, 재연결을 구현한다.

완료 조건:
- [ ] 캐시 없는 공개 글의 번역이 다음 daily cron을 기다리지 않고 허용된 처리 시간에 소비된다.
- [ ] 100회의 같은 요청은 한 번의 논리적 생성으로 합쳐진다. 이 수치는 테스트 입력 수이며 운영 트래픽 목표가 아니다.
- [ ] worker 재시작·탭 닫기·연결 단절 후 같은 작업을 다시 조회할 수 있다.
- [ ] queue가 중단되면 실패를 숨기거나 무한 warming하지 않고 중단 이유와 재시도 가능성을 표시한다.
- [ ] 내부 인증/비공개 글 보호/기존 native translation 우선순위가 유지된다.

되돌리기: 기존 캐시 읽기는 항상 유지한다. 새 소비자가 문제를 일으키면 접수를 제한하고 상태를 deferred로 표현하며 이미 공개된 번역을 삭제하지 않는다.

## PR-A03 — Projects 데이터 복구와 release 입력 검증

근거: E12–E14 / 진단 P01·P02.

주요 파일: `frontend/scripts/generate-projects-manifest.js`, `rebuild-github-project-data.mjs`, `project-catalog-summaries.json`, `frontend/package.json`, CI, `frontend/src/services/content/projectService.ts`, `frontend/src/pages/public/Projects.tsx`.

- [ ] Markdown 원문이 source archive에서만 제외된 것인지 실제 repository에도 없는지 확인한다. 불완전 snapshot으로 정상 콘텐츠를 덮어쓰지 않는다.
- [ ] 기존 검토된 공개 repository evidence에서 프로젝트 source를 복원하고 manifest를 재생성한다.
- [ ] 기존 `--check`를 실제 build/deploy gate에 연결한다. missing/extra/duplicate ID 및 공개 범위 drift를 검증한다.
- [ ] 0개가 의도된 변경인지, 입력 누락인지 분리한다. 의도된 전체 삭제에는 명시적 확인 가능한 변경 증거를 요구한다.
- [ ] fetch 실패와 합법적인 빈 결과를 구분한다. 오류를 성공 cache로 저장하지 않는다.
- [ ] 재시도는 실제 재조회하고, 가능하면 마지막 정상 목록을 유지한다.
- [ ] 매번 Date.now cache-bust 대신 release version 또는 HTTP validator를 사용한다.

완료 조건:
- [ ] 검토된 공개 목록의 모든 ID가 manifest에 정확히 한 번 들어간다. source 기준 수는 68이지만 최신 공개 목록 변화는 별도로 확인한다.
- [ ] 503 후 정상 응답에서 사용자 재시도로 목록이 복구된다.
- [ ] markdown source 누락, 중복 ID, 불명확한 public/private 전환은 배포를 중단한다.
- [ ] fork와 empty가 운영 완료 제품으로 표시되지 않는다.

## PR-A04 — 전체 글 번역과 버전 검증

근거: E05–E06 / 진단 T02.

주요 파일: `workers/api-gateway/src/lib/translation-service.ts`, outbox translation payload, cache schema/migration, Markdown parsing 공통 모듈, 관련 tests.

- [ ] 제목·설명·본문·언어 및 prompt/model/schema 버전을 포함한 새 해시 계약을 만든다. 잘못된 sha256 접두사를 함께 정리한다.
- [ ] 이전 cache를 즉시 삭제하지 않고 새 버전으로 천천히 대체한다. 알 수 없는 버전은 확정 결과로 취급하지 않는다.
- [ ] 본문 30,000자 절단을 블록별 번역으로 교체한다. 코드·URL·표·이미지·footnote·문단 anchor를 보존한다.
- [ ] 짧은 제목/설명을 묶고 제한된 병렬 처리를 적용한다. 공급자 한도를 넘는 무제한 병렬 처리는 금지한다.
- [ ] 각 블록 성공 여부, 누락/중복, fenced code 보존, 링크 목록, source version을 검증한다. 문자 길이 비율은 경고 신호이지 유일한 품질 판정으로 쓰지 않는다.
- [ ] 불완전 후보는 별도 결과로 남기며 ready cache에 승격하지 않는다.
- [ ] 원문이 바뀐 뒤 끝난 이전 작업은 현재 번역을 덮어쓰지 못한다.
- [ ] cache 삭제/복구가 처리 완료 outbox 재사용에 막히지 않도록 revision/replay 정책을 구현한다.

완료 조건:
- [ ] 긴 원문·코드/표·링크·이미지·footnote가 있는 fixture에서 누락 없는 구조가 유지된다.
- [ ] 모의 100자 부실 번역은 50,000자 원문의 완성 번역으로 저장되지 않는다.
- [ ] 제목만 변경, 설명만 변경, locale 변경, prompt version 변경마다 의도한 cache가 갱신된다.
- [ ] N 버전 작업이 늦게 끝나도 N+1의 결과는 바뀌지 않는다.
- [ ] cache 삭제 후 재생성이 가능하고, 반복 재시도는 중복 과금 생성으로 늘어나지 않는다.

## PR-A05 — 첫 유용한 응답을 앞당기고 대기·취소를 명확하게 제공

근거: E07–E08.

주요 파일: `frontend/src/services/discovery/ai.ts`, AI 카드 상태 hook/component, 기존 chat SSE service, `backend/src/routes/chat.js`, `backend/src/lib/chat-streaming.js`, 공통 AI provider adapter, telemetry.

- [ ] request ID와 단계별 timing을 연결한다. first connection/heartbeat/first useful content/completion을 별개로 기록한다.
- [ ] 기존 실제 chat SSE와 notebook/RAG 병렬 제한을 유지한다.
- [ ] 구조화 카드 출력에 schema-validated item/delta event를 도입한다. 불완전 JSON을 완성 답변처럼 파싱하지 않는다.
- [ ] `/ai/generate/stream`의 post-hoc typing을 실제 provider stream으로 대체하거나 소비자 없는 경로라면 안전하게 정리한다.
- [ ] 전체 deadline을 SDK retry와 fallback에 전달한다. 각 단계가 독립적으로 전체 timeout을 다시 쓰지 않게 한다.
- [ ] 취소 AbortSignal이 provider까지 전달되도록 하고 취소 후 실패 fallback을 새로 시작하지 않는다.
- [ ] 카드 접기/페이지 이동/탭 복원 시 같은 작업을 재연결한다.
- [ ] 작은 상태 표시, 현재 내용 보존, 자동 스크롤 중단, 키보드 취소/재시도를 구현한다.

완료 조건:
- [ ] 모의 provider 첫 delta가 전체 완료를 기다리지 않고 카드에 나타난다.
- [ ] UI를 숨긴 것과 실제 취소가 구분되며 취소 후 새 provider 요청이 시작되지 않는다.
- [ ] partial failure 재연결에서 기존 텍스트가 중복되지 않는다.
- [ ] 느린 RAG/무응답 provider/fallback 시각이 trace에서 분리된다.
- [ ] 기존 기능 대비 p50/p95를 같은 입력·모델·캐시 조건으로 비교한다. 측정 없이 성능 개선 완료를 선언하지 않는다.

## PR-A06 — AI-server 이미지 작업·저장·승인 완결

근거: E09–E11.

주요 파일: 기존 `adminAiImages.js`, `ai-image/*`, `image-generation.tool.js`, `adminImages.ts`, `AiImageGeneratorPanel.tsx`, 공통 durable job/repository, image schema.

- [ ] feature flag, AI-server base URL/credential/model alias, 실제 지원 크기·quality·n·응답 형식을 확인한다.
- [ ] 목록 탐색과 실제 image capability/마지막 성공/저장 가능 여부를 분리한다. probe의 비용/빈도를 제한한다.
- [ ] 202 job 접수→생성→검증→저장→후보 완료로 전환한다. 기존 동기 계약 소비자가 있으면 호환 경로를 명시한다.
- [ ] 논리적 생성 의도에 고정 idempotency key를 사용한다. 네트워크 재시도와 새 이미지 요청을 구분한다.
- [ ] 생성 완료/저장 실패를 분리하여 업로드만 재시도한다. provider 결과 유실 가능 시 불명확한 성공을 자동 재과금하지 않는다.
- [ ] 기존 raster 검증, sharp decode·픽셀/바이트 상한, remote storage 응답 검증을 유지한다.
- [ ] 실제 post ID 기반 이미지 경로, 원본·WebP/선택적 AVIF 변형, 실제 치수 metadata를 저장한다.
- [ ] 사용 중/후보/실패/미사용 자산을 구분하고 수동 이미지 잠금·원문 버전 검사를 적용한다.
- [ ] 관리자/agent가 같은 서비스와 동일 게시 승인 규칙을 사용한다. 도구 반환 action이 무조건 공개 변경으로 실행되지 않도록 한다.

완료 조건:
- [ ] 응답 유실 후 같은 요청을 다시 보내도 생성 의도 하나로 복구된다.
- [ ] 업로드 재시도는 provider를 다시 호출하지 않는다.
- [ ] 잘못된 MIME/초대형/잘못된 remote URL/한글 slug/late completion fixture를 통과한다.
- [ ] 실제 AI-server 및 CDN 계약 테스트와 예산 승인된 샘플 생성이 성공해야 운영 완료 처리한다.
- [ ] 수동 cover는 자동 작업으로 바뀌지 않는다. 원복할 이전 자산을 유지한다.

## PR-A07 — 하나의 공개 SEO 데이터와 전체 HTML

근거: E17–E20, 외부 G2–G7.

주요 파일: `generate-static-html.js`, `generate-seo.js`, `useSEO.ts`, `utils/seo/seo.ts`, sitemap/route manifest, SEO gateway, frontend route definition.

- [ ] 원문/프로젝트/언어별 PageArtifact를 만들고 HTML/JSON-LD/OG/canonical/sitemap이 동일 버전에서 생성되게 한다.
- [ ] 공개 본문과 의미 있는 링크/이미지가 포함된 prerender/SSG를 도입한다. 모든 framework를 교체하는 작업부터 시작하지 않는다.
- [ ] gateway가 실제 path artifact를 제공하도록 하고, 브라우저 hydration 후에도 의미가 바뀌지 않게 한다.
- [ ] canonical/기사 태그/JSON-LD를 중복 없이 교체하고 `<` 등 inline JSON 직렬화 안전성을 보장한다.
- [ ] 실제 작성일/수정일/이미지 폭·높이/author URL을 사용한다.
- [ ] 검증된 언어별 URL만 self-canonical 및 reciprocal hreflang으로 연결한다.
- [ ] sitemap에는 실제 공개 canonical과 선택한 이미지 URL만 포함한다. XML/URL escaping을 검증한다.

완료 조건:
- [ ] JS를 실행하지 않은 HTML에도 실제 공개 글 내용·주요 내부 링크·img src가 있다.
- [ ] canonical은 하나, article metadata는 현재 페이지 데이터만 존재한다.
- [ ] 표/코드/출처/이미지를 포함한 fixture가 client render와 의미적으로 일치한다.
- [ ] 비공개/미검증 번역/누락 문서는 sitemap 및 공개 artifact에서 제외된다.
- [ ] Rich Results Test/URL Inspection 등 외부 확인은 해당 접근이 가능할 때 수행하고 결과를 별도 기록한다. 구조화 데이터 생성만으로 순위/노출 완료를 선언하지 않는다.

## PR-A08 — 사례 중심 Projects와 사실 기반 About

근거: E12–E15.

- [ ] 공개 repository catalogue 68개 기준은 보존하되 최신 공개 범위 변화를 확인한다.
- [ ] 대표 사례 4~6개와 전체 목록을 분리한다. fork/empty/운영 상태를 별도 필드로 둔다.
- [ ] 프로젝트별 stable slug와 상세 페이지를 추가한다. 기존 URL은 필요 시 redirect한다.
- [ ] 각 사례에 문제, 본인 역할, 구조 선택, 실패/복구, 결과 근거, 실제 화면, 마지막 검증일을 작성한다.
- [ ] AI-server/WLatch/파일 앱처럼 별도 프로젝트는 최신 자료와 공개 허용 범위 확보 후 반영한다.
- [ ] About의 2026 졸업 예정·기술 경험을 사실 확인해 갱신한다. 학력·경력·성과를 commit 로그로 추론해 자동 확정하지 않는다.
- [ ] ko/en 소개와 저자 정보/author URL을 맞춘다. AI 사용·수정/인용 원칙을 필요한 범위로 제공한다.

완료 조건:
- [ ] 모든 공개 사실/수치에는 확인 가능한 출처와 측정 범위가 있다.
- [ ] GitHub public 또는 PR merged가 서비스 live로 잘못 표시되지 않는다.
- [ ] 소개를 읽지 않아도 대표 작업·코드·연락에 쉽게 도달한다.

## PR-A09 — 변경 기반·비용 제한형 배경 SEO

근거: 분석 5장, G1–G7.

- [ ] PostPublished/PostUpdated/ProjectUpdated 이벤트에서 원문 버전을 확정한 뒤 산출물 변경 필요성을 계산한다.
- [ ] 초기 140개 공개 글을 검사하되 88개 image 미지정 글을 일괄 생성 승인으로 취급하지 않는다.
- [ ] deterministic metadata/링크 검사와 AI 편집 후보/이미지 생성을 구분한다. 기존 정상 결과·수동 잠금·텍스트 전용 정책을 존중한다.
- [ ] 작업 ledger에 sourceVersion, policyVersion, artifactType, locale, idempotency key, status, cost, retry/lease 정보를 저장한다.
- [ ] 전경 요청에 불리하면 background를 pause/defer하고 그 이유를 관리자에 표시한다.
- [ ] 생성/변환/업로드/검증/게시를 분리해 단계별로 재개한다. 늦은 결과는 현재 버전에 적용하지 않는다.
- [ ] 일별/월별 비용·토큰·이미지 수·스토리지·최대 재시도 상한을 설정하고 실제 usage와 맞춘다.
- [ ] Search Console 접근이 연결되면 페이지·쿼리별 노출/CTR/색인 오류를 수집하되 자동 편집의 인과 효과를 단정하지 않는다.
- [ ] 변경 없는 콘텐츠의 lastmod 조작, 얇은 중복 페이지·키워드 alt 양산, 비공개 데이터 전송을 금지한다.

완료 조건:
- [ ] 같은 입력 두 번 처리 시 추가 이미지 생성 비용이 없다.
- [ ] 예산 소진·provider 실패·foreground 지연 시 새 background 생성이 중단된다.
- [ ] 정책 변경이 모든 수동 cover를 덮어쓰지 않는다.
- [ ] 새 artifact 게시 실패 시 이전 정상 글·이미지·SEO가 유지된다.
- [ ] 후보 생성, 검증 성공, 실제 공개, 검색 측정을 각각 별도 지표로 보고한다.

## PR-A10 — 통합 회귀·작은 UX·운영 경계

- [ ] 공개/비공개 글, 개인 메모/대화, SEO artifact와 프롬프트 입력의 경계를 통합 테스트한다.
- [ ] 언어 변경 후 focus·reading anchor, 화면 확대, 모바일 키보드, reduced motion, 긴 코드/표를 검증한다.
- [ ] 로그인 만료/페이지 이동/탭 복원/중복 클릭/연결 단절/작업 중 원문 변경을 조합 검증한다.
- [ ] 실제 답변을 지연시키는 타자 효과, 반복적인 큰 설명 블록, 의미 없는 진행률을 제거한다.
- [ ] 관리자에 실패 작업·재시도·비용·사용 중 자산을 중심으로 한 최소 운영 화면을 제공한다.
- [ ] 오래된 translation API Sunset(2026-06-30)을 실제 호출 통계·호환성 계약과 맞춰 정리한다.
- [ ] 배포 전 source/manifest/assets/route/SEO의 교차 버전 조합과 rollback을 검증한다.
- [ ] 의존성·CSP·로그 민감정보·외부 이미지 fetch 경계를 별도 보안 점검한다. 이번 정적 분석을 전체 침투 테스트로 취급하지 않는다.

## 운영 관측 지표

| 영역 | 기본 지표 |
|---|---|
| 번역 | cache hit, queue wait p50/p95, 처리 시간, 검증 탈락, stale 결과 차단, 공개 완료율 |
| 대화/카드 | 첫 유용한 텍스트 p50/p95, total latency, context 시간, retry/fallback 비율, 취소 후 upstream 지속 |
| 이미지 | 논리적 요청당 provider 생성 수, 생성/저장 실패 구분, 승인률, 재사용률, 비용/공개 자산 |
| SEO | MIME/404/canonical 오류, 공개 HTML 완성률, sitemap drift, 색인/클릭·CTR 변화 |
| 배포 | source 수·hash, manifest count drift, 공개 범위 변경, 자산 참조 검증, rollback 성공 |

실패한 작업도 관측돼야 한다. `202` 접수 수나 이미지 파일 수만으로 성공률을 높게 보고하지 않는다.
