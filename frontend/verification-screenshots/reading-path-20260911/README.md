# 게시글 AI 읽기: 03 패널 + 07 질문 흐름

사용자가 선택한 3번의 패널 외형과 7번의 세로 질문 흐름을 실제 배포 컴포넌트에 적용했습니다. 질문 색인 제목·선택 목록·이전/다음 영역은 렌더링하지 않습니다. 기존 API, 생성 상태, 추가 질문, 확대 보기는 그대로 사용합니다.

## 변경 소스

- `src/components/features/sentio/SparkInline.tsx`: 제품 패널 스타일 연결
- `src/components/features/sentio/reading-panel.css`: 공통 패널 외형, 연속 질문 카드, 모바일·다크 모드
- `src/components/features/sentio/ThoughtFeed.tsx`: 전체 카드 흐름과 문단별 상태 경계
- `src/components/features/sentio/ThoughtCard.tsx`: 반복·내부 메타데이터 정리, 숨겨진 카드의 높이 측정 보호
- `src/components/features/sentio/ThoughtFeed.reading-path.test.tsx`: 초안·오류·확대 화면 및 제거한 UI 검증

## 실행한 검증

- 컴포넌트 테스트 15개 통과: ThoughtFeed, ThoughtCard, CardPaperView, SparkInline 및 신규 reading-path 테스트
- 피드 캐시·준비 상태 회귀 테스트 17개 통과
- `npm run type-check` 통과
- 변경 TS/TSX ESLint: 오류 없음; 기존 SparkInline fast-refresh 경고 1개
- 실제 `config/vite.config.ts`로 프로덕션 Vite 빌드 통과. 생성된 게시글/SEO 파일을 건드리지 않도록 출력은 `/tmp/blog-reading-path-build`, 정적 원본은 기존 `public/`에서 제공
- 실제 컴파일된 앱의 `/blog/2026/current-crowd`에서 1440/768/390/320px 가로 넘침 없음, 원문 30개 문단, 모든 질문 카드 표시, 확대 화면·모드 전환 시 초안 유지
- 실제 운영 API에서 질문 7개 및 후속 스트리밍 답변 833자 수신. `live-api-evidence.json` 참조
- CSS 보정 후 재검증 및 다크 모드 확인: `results.json`. 후속 질문을 중복 전송하지 않아 이 파일의 `realResponseCharacters`는 null
- 별도 코드 리뷰에서 발견한 기존 CSS의 패널 외형 덮어쓰기 수정 후 12px 모서리 적용을 실제 브라우저에서 확인

브라우저 검증은 로컬 HTTP 서버가 공개 API로 요청을 전달하는 환경에서 수행했습니다. 운영 설정/인증 코드, 배포 파이프라인은 변경하지 않았습니다. 실서버 배포는 이 패치에 포함되지 않습니다.
