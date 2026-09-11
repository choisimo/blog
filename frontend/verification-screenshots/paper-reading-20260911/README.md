# 종이 팝업·분석 전환·핵심 요약 개선

## 적용 범위

- `CardPaperView.tsx` / `card-paper.css`: 보이는 문서 제목, 문서 유형, 보조 설명과 메타 영역; 고정 도구 모음과 하나의 본문 스크롤; 모바일·다크 모드; Escape 및 포커스 복귀
- `LensCard.tsx` / `LensViewToggle.tsx` / `lens-reading.css`: 페르소나 오른쪽의 단일 타원형 버튼으로 요점↔근거 전환, 다음 동작 툴팁과 호버 색상, 카드와 확대 화면의 상태 공유
- `ReadingSummary.tsx`: 기존 Markdown 정책을 재사용하는 요약 본문과 번호가 있는 핵심 포인트
- `ArticleReadingTools.tsx`: 핵심 요약을 공통 종이 팝업으로 표시, 빈 응답 재시도, 다른 글의 늦은 응답 무시
- `SparkInline.tsx` / `ThoughtCard.tsx`: 문단 핵심 파악과 질문 팝업에 공통 제목 체계를 연결하고 중복 제목 제거

## 검증

- 관련 Vitest 22개 통과 (8개 파일): CardPaperView, LensViewToggle, LensCard, LensEvidence, PrismDeck, SparkInline, ThoughtFeed.reading-path, ArticleReadingTools
- 전체 TypeScript 검사 통과
- 변경 TS/TSX ESLint 오류 없음; 기존 LensCard/SparkInline의 fast-refresh 경고 각 1개
- 실제 Vite 프로덕션 설정으로 빌드 통과. 생성된 원본/SEO 파일을 건드리지 않도록 산출물을 `/tmp/blog-reading-path-build`에 저장
- 실제 컴파일된 게시글과 운영 API를 사용해 전체 글 요약 및 근거 분석 수신
- 전체 글 요약·문단 요약·다각도 분석 근거·다각도 분석 요점의 1440/390/320px 12개 조합 검사, 가로 넘침 없음
- 단일 토글, 호버 색상 변경, 툴팁 문구, 팝업/카드 상태 공유, Escape 포커스 복귀 확인
- 다크 모드 확인. 터미널 카드 높이와 긴 식별자/URL 줄바꿈 리뷰 지적 수정 후 재검증

`results.json`과 화면은 실제 응답 기준입니다. `stress-results.json` 및 `long-token-*` 이미지는 긴 토큰을 DOM에 넣은 합성 스트레스 검사이며, 실제 API 응답으로 표시하지 않습니다. API 응답을 mock으로 대체하지 않았습니다. 운영 배포는 수행하지 않았습니다.
