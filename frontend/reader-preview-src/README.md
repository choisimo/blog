# 실제 게시글 읽기 페이지: 원본 + 10개 디자인

`src/main.tsx`와 `App.tsx`를 그대로 빌드하는 별도 HTML 진입점입니다. 실제 글은 `public/posts/2026/current-crowd.md`의 **무속, 사이비 : 자유의 환상과 개인화의 비극**입니다. 30개 문단, 6개 절, 원본 대표 이미지, 목차, 글 도구, 이미지 확대, 메모 컴포넌트와 AI 상태·서비스를 재사용합니다.

가짜 답변이나 API 스텁을 포함하지 않습니다. 글·이미지의 실제 파일만 HTML에 패키징합니다. AI 질문 피드와 후속 대화는 기존 `invokeThoughtFeed` / `useCardExploration` / `streamCardExploration` / 인증·세션 클라이언트를 사용합니다.

## 실행

프로젝트 루트에서:

```sh
node frontend/reader-preview-src/build.mjs
node design-previews/reading-page/serve.mjs
```

<http://localhost:4320>에서 열립니다. `READER_PORT`로 포트를 바꿀 수 있습니다. 하단에서 디자인을 고른 뒤 **문단 AI 살펴보기**를 누르거나, 원래처럼 본문의 반짝이 버튼을 누릅니다. **원본 비교**는 같은 글과 열린 패널의 기존 레이아웃으로 돌아갑니다. 선택한 질문, 입력 초안, 스트리밍·대화 상태는 디자인 전환으로 초기화하지 않습니다.

`public-config.json`은 확인한 운영 API의 공개 설정입니다. 다시 빌드할 때 다른 공개 설정 파일은 `READER_PUBLIC_CONFIG_FILE`로 지정합니다. 비밀 키, 인증 토큰, 사용자 세션을 빌드 산출물에 넣지 않습니다.

## 산출물

- `design-previews/reading-page/index.html`: 전체 실제 글 + 디자인 선택
- `original.html`: 기본 선택이 원본인 실제 페이지
- `01-focus.html` ~ `10-evidence.html`: 각 안으로 바로 열리는 실제 페이지
- `reader-original.html`: CSS·앱 코드·원문·대표 이미지가 포함된 원본 단일 HTML
- `reader-all-designs.html`: 디자인 선택을 포함한 단일 HTML
- `assets/`, `reader-layouts.css`, `ai-memo/`: 일반 HTML 진입점의 공유 파일

단일 HTML은 파일로 직접 열어 오프라인에서 본문·목차·이미지·디자인을 확인할 수 있습니다. AI·댓글·서버 저장 등 네트워크 기능은 HTTP 서버와 운영 서비스가 필요합니다. CORS를 맞추기 위해 제공 서버가 같은 출처의 `/api/` 요청을 공개 API로 전달하며, 인증을 우회하지 않습니다. 로컬 서버는 `127.0.0.1`에만 바인딩합니다.

## 빌드 경계

기존 제품 파일을 수정하지 않고, 프리뷰 빌드에서만 세 가지 어댑터를 적용합니다.

1. `App`의 `BrowserRouter`를 `HashRouter`로 바꿔 각 HTML 파일에서 기존 게시글 경로를 유지합니다. 댓글·본문 바로가기 같은 문서 내부 링크는 게시글 경로를 유지하며 실제 대상까지 스크롤합니다.
2. `SparkInline`의 결과 영역 앞에 `ReaderPanelTools`를 삽입합니다. 질문 색인, 단계 이동, 원문 대조, 로컬 노트만 소유합니다. 실제 질문 카드와 폼은 재부모화하거나 복제하지 않습니다.
3. 메모의 스타일과 익명 세션 모듈 URL을 실제 파일의 data URL로 패키징합니다. 본문·이미지 패키지도 정적 파일만 해석하며 API 응답은 대체하지 않습니다.

원본 모드(00)에는 프리뷰 패널 도구와 변경 CSS를 적용하지 않습니다. 하단 선택 막대는 제품 앱과 별도의 React 루트에 있으며 접을 수 있습니다.

## 검증

```sh
frontend/node_modules/.bin/tsc -p frontend/reader-preview-src/tsconfig.json --pretty false
node frontend/reader-preview-src/verify.mjs
```

검증은 실제 API에 질문 피드와 후속 질문을 요청합니다. `READER_VERIFY_LAYOUT_ONLY=1`이면 후속 질문 전송을 생략합니다. UI fixture로 응답을 바꾸지 않습니다.

`design-previews/reading-page/verification/`에 화면과 결과를 저장합니다. `live-api-evidence.json`은 실제 질문 피드와 스트리밍 응답 확인 기록이며, `results.json`은 최종 화면 검증 결과입니다. 원본 + 10개 안의 1440/390/320px 조합, 원문 보존, 초안·카드 상태 유지, 질문 이동, 확대 화면, 메모, 디자인 저장, 파일 직접 열기를 확인합니다.

게시글 외의 화면과 제품 전체의 운영 회귀는 이 작업의 검증 범위에 포함하지 않습니다.
