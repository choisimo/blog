# Blog AI / SEO audit — 2026-09-10

## 포함 문서

| 파일 | 내용 |
|---|---|
| analysis.md | 요청한 6개 영역의 분석, 현재 동작, 변경안, 위험과 완료 기준 |
| tasks.md | 제안 PR-A01~A10의 파일 범위·작업·완료 조건 |
| source-evidence.md | 첨부 원본 파일/줄 번호별 근거, 분리 재현 결과 |
| diagnostics/reproduce.mjs | 네트워크·D1·AI 의존성을 대체해 원본 함수 경로를 실행하는 진단 코드 |
| diagnostics/results.json | 실행한 7개 진단 묶음의 관찰 결과. 제품 테스트 통과 보고서가 아님 |
| diagnostics/content-inventory.json | 첨부 공개 manifest 필드 집계 |
| diagnostics/source-integrity.json | 원본 archive 식별 및 1,834개 파일 무변경 확인 |
| diagnostics/live-readonly-attempts.json | 이 환경에서 DNS 실패로 끝난 공개 사이트 읽기 시도. 운영 장애 증거 아님 |

제품 소스는 변경하지 않았고 이 묶음에 전체 제품 소스를 재포장하지 않았다. 진단을 실행하려면 사용자가 제공한 원본 소스 디렉터리가 필요하다. 전체 suite/E2E/실제 AI-server 호출은 미수행이다.

## 재현 실행

Node.js 20 이상 및 TypeScript compiler module이 필요하다. TypeScript가 일반 Node 모듈 경로에서 보이지 않으면 모듈 파일의 절대 경로를 지정한다.

```bash
BLOG_SOURCE=/absolute/path/to/blog \
TYPESCRIPT_MODULE=/absolute/path/to/node_modules/typescript/lib/typescript.js \
node diagnostics/reproduce.mjs
```

원본 코드의 import된 외부 의존성을 mock으로 교체하고 임시 폴더에서 실행한다. HTMLRewriter는 passthrough mock이므로 헤더·route·status의 재현이지 Cloudflare의 실제 HTML 변환 기능 테스트가 아니다. `results.json`은 실행 후 갱신된다.

## 해석

문서에서 “확인”은 첨부 소스 또는 분리 재현에서 확인했다는 뜻이다. 배포 코드·실제 provider 성능·비용·현재 학력/운영 이력까지 확인했다는 뜻이 아니다. 제안 PR 번호는 새 계획 번호이며 실제 PR 생성/구현 완료를 뜻하지 않는다.
