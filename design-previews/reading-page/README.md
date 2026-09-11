# 실제 게시글에서 비교하는 10개 읽기 디자인

**실행:** 이 폴더에서 `node serve.mjs` → <http://localhost:4320>

- `index.html`: 실제 게시글 전체 + 10개 디자인 선택
- `original.html`: 기존 레이아웃부터 보기
- `reader-original.html`: 원본 단일 HTML 파일
- `reader-all-designs.html`: 원본과 10개 디자인을 선택하는 단일 HTML 파일

하단 **문단 AI 살펴보기**를 누르거나 본문의 반짝이 버튼을 눌러 실제 AI 패널을 엽니다. 디자인을 바꿔도 열린 질문과 입력 초안은 유지됩니다. **원본 비교**로 즉시 기존 배치로 돌아갈 수 있습니다.

| 파일 | 디자인 |
| --- | --- |
| `01-focus.html` | 문단 속 집중 |
| `02-inspector.html` | 나란히 탐구 |
| `03-index.html` | 질문 색인 |
| `04-steps.html` | 생각의 단계 |
| `05-conversation.html` | 이어지는 대화 |
| `06-board.html` | 관점 보드 |
| `07-path.html` | 사고의 경로 |
| `08-notebook.html` | 읽고 기록하기 |
| `09-sheet.html` | 본문 위 시트 |
| `10-evidence.html` | 원문과 근거 |

실제 글: **무속, 사이비 : 자유의 환상과 개인화의 비극**. 원문·이미지·목차·읽기 도구·메모·AI 컴포넌트는 기존 프로젝트 소스입니다. 고정된 데모 답변은 없습니다.

단일 HTML은 파일로 직접 열어 읽을 수 있습니다. 실제 AI 요청과 서버 기능은 제공 HTTP 서버에서 사용하세요. 파일 모드에서는 브라우저의 교차 출처 정책으로 연결이 제한됩니다.

구현·재빌드 설명: `frontend/reader-preview-src/README.md` (프로젝트 루트 기준).
