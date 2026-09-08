# 게시글 문체·도식 정리 — 진행 기록

요청 범위는 게시글 전체의 부자연스러운 AI식 문체 수정과 텍스트로 그린 시각 자료의 HTML/CSS/JS 대체다. 현재 **진행 중**이며, 일부 도식의 테스트 통과를 전체 게시글 완료로 취급하지 않는다.

## 현재 범위와 완료한 변경

- 연도 디렉터리의 Markdown 281개: 공개 139개, 초안 142개. 초안도 인벤토리에 포함했다. 루트의 `design-improvement-plan.md`는 게시글이 아닌 내부 문서다.
- 14개 게시글의 도식 27개를 명시적인 `diagram` 코드 펜스 데이터로 전환했다. 원래 블록과 위치는 `diagram-migrations.json`에 보관했다.
- `ArticleDiagram`은 React가 만드는 HTML, 범위가 제한된 CSS, 항목 탐색 상태로 구성된다. 처리 흐름·구성 관계·비교 유형을 지원한다. 원문에서 실행할 JS나 HTML을 허용하지 않는다. 잘못된 데이터는 기존 코드 블록으로 표시한다.
- 추천 시스템 글: 첨부 이미지의 5단계·15항목을 포함한 도식 6개 교체. 전체 문장을 설계 노트로 다듬고 검증 조건 없는 성과 주장을 측정 계획으로 변경했다. Surprise·RecBole 예제를 정리하고 공식 문서를 연결했다. 모델 학습 실험을 실행했다는 의미는 아니다.
- Nginx 설정 글: 전체 문장을 읽고 과한 의인화·감정 묘사와 추상적인 결론을 설정 범위·검증 방법 설명으로 바꿨다. 설정 검사 성공 시에만 reload하는 예제로 정리했다.
- `editorial-reviews.json`은 사람이 읽듯 본문 전체를 검토한 파일 2개만 기록한다. 해시가 달라지면 `inventory.mjs`는 다시 pending으로 표시한다. 문구 검색에 걸리지 않았다고 완료로 간주하지 않는다.

## 남은 작업

1. 279개 글의 본문 문체 검토. 공개 글부터 진행하되 초안도 범위에 남긴다. 기술 글의 과한 비유, 반복되는 도입·마무리, 근거 없는 성과 주장과 만들어낸 듯한 경험 서술을 구체적인 설명으로 수정한다. 원래 글의 사실·논지·개인적 의견은 보존한다.
2. 잔여 도식 후보 39블록 수동 판정. 후보에는 의사코드·쉘 명령·실행 로그도 섞여 있다. 기호만 보고 자동 치환하지 않는다. 특히 다음은 실제 도식이 남아 있다.
   - `2026/git-history-rewrite-reset-rebase-reflog.md`: 커밋 그래프 7개. 분기점과 참조 이동을 유지하는 전용 시각화가 적합하다.
   - `2026/teleport.md`: fork/exec, 페이지 교체, I/O 구조. 기존 설명에 기술적 과장이 있어 도식과 문장을 함께 대조해야 한다.
   - `2026/python-1.md`, `python-2.md`: 실행 파이프라인과 속성 탐색 우선순위.
   - `2025/java-static-polymorphism-masterclass.md`, `2026/java-object-dispatch.md`: 메모리·초기화·디스패치 흐름.
   - `2025/terraform-02-aws-ec2-example.md`: 네트워크 관계.
3. 검색에 잡히지 않는 번호 나열·공백 정렬 도식도 검토한다. `/tmp/blog-plain-fences.json`은 초기 146개 무언어·text 펜스의 참고 덤프다. 권위 있는 원본은 현재 게시글 파일이다.
4. `2024/docker-kubernetes-guide.md` 285줄 부근에 여분의 코드 펜스로 본문·코드 경계가 뒤집히는 부분이 관찰됐다. 해당 글 전체 편집 시 함께 고친다.
5. 도식 27개에 대한 데이터 구조 검증은 완료했지만, 나머지 12개 글의 본문 편집이 끝났다는 뜻은 아니다.
6. 모든 글의 검토 기록과 실제 렌더 결과를 대조한 다음에만 전체 목표를 완료 처리한다.

## 검증

- 관련 Vitest 19개 통과: 전체 도식 스키마, 원문 내용 보존, 피드백 연결, 항목 선택, 무효 데이터 fallback, HTML 주입 방지, 기존 코드 렌더링.
- Playwright 23개 통과: 14개 글의 320px 도식/터치 영역/내용 잘림, 추천 흐름의 light/dark/terminal × 320/768/1440px, 키보드 조작과 reduced-motion. `screenshots/`에 테마별 실제 화면 보관.
- 전역 prose 스타일 충돌을 실제 스크린샷에서 발견해 수정했다. 제목·문단 정렬과 터미널의 문자 장식을 명시적으로 차단했다.
- Vite production build 통과. 기존 번들 크기 및 gray-matter eval 경고가 있다.
- 변경 영역 ESLint 오류 없음. MarkdownRenderer의 기존 react-refresh 경고 1개가 있다.
- 한국어 일반 스캔 통과. CI 스캔은 기존 `2024/queue.md:11` 제목의 🚶‍♂️ 이모지 결합 문자(ZWJ)를 검출해 종료 코드 1이다. 이번 수정 파일에서 정규화 문제는 검출되지 않았다.
- 기존 reading-design fixture 320px 검사 3개는 테스트용 게시글 제목을 찾지 못해 실패했다. 실제 게시글 도식 검사와 구분한다.
- 전체 type-check는 기존 `src/test/CommentReactions.test.tsx:65,86`의 `getByRole`에 지원하지 않는 `exact` 옵션 2건으로 실패. 이번 변경으로 생긴 오류는 출력되지 않았다.
- manifests 및 SEO는 기존 생성 스크립트로 재생성했다. 수동으로 생성물을 편집하지 않았다.

## 재실행

`frontend/`에서:

```sh
node scripts/content-refinement/inventory.mjs
npm run test:run -- src/test/ArticleDiagram.test.tsx src/test/MarkdownRenderer.codeblocks.test.tsx src/test/MarkdownRenderer.test.tsx
./node_modules/.bin/vite --config config/vite.config.ts --host 127.0.0.1 --port 4186 --strictPort
# 별도 터미널, Chromium 실행 파일이 필요하면 CONTENT_CHROMIUM_PATH로 지정
./node_modules/.bin/playwright test --config config/playwright.content.config.ts
```

작업 시작부터 다른 UI/프로젝트 카탈로그 변경이 다수 있었다. 이 기록과 관계없는 변경을 되돌리거나 커밋·배포하지 않았다. `ui-reading.css`의 `.ui-reading-progress` top 변경은 이 작업에서 만든 것이 아니다.
