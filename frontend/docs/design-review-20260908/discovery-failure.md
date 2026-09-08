# 실제 글 목록 실패와 복구

최종 검수에서 페이지 컴포넌트의 mock rejection만으로는 검증되지 않은 실패 경로를 확인했다. `PostService.loadPostsManifest()`가 HTTP·네트워크·JSON 해석 실패를 `null`로 바꾸고, `getManifestItems()`가 이를 빈 배열로 바꾸면서 `getPostsPage()`와 `getAllPosts()`가 실패 결과를 정상적인 빈 캐시에 저장했다. 데이터 adapter도 오류를 빈 결과로 바꿨다. 따라서 새 홈·블로그의 재시도 화면에 실제 요청 실패가 도달하지 않았다.

수정 전 로컬 Chromium에서 `/posts-manifest.json`을 차단하고 `/blog?q=Runtime&page=2&sort=title`에 진입하면 “찾는 글이 없습니다”가 표시되고 “다시 시도” 버튼은 0개였다. 이 결과는 검색 조건에 맞는 글이 실제로 없다는 뜻과 구별되지 않았으며, 실패로 만들어진 캐시 때문에 이후 요청도 빈 결과가 될 수 있었다.

## 수정 계약

- 서비스의 HTTP 실패·네트워크 예외·JSON 해석 예외를 호출자에게 전달하고 성공 캐시에 저장하지 않는다.
- `getPosts`, `getPostsPage`, `getPostCategoryCounts`, `getTags`, `getAllCategories`, `getAllTags`는 선택적 `{ throwOnError: true }`를 지원한다. Index·Blog는 이를 사용하여 이미 구현된 실패·재시도 상태에 연결한다.
- 기존 adapter 호출자는 기본 빈 배열·빈 페이지·빈 count map fallback을 유지한다. 실제 기본 호출과 strict 호출을 같은 실패 서비스에 연결한 테스트로 확인했다.
- 정상적인 `{ items: [] }`는 여전히 성공적인 빈 목록이다. 기존 malformed top-level payload를 빈 목록으로 처리하는 정책과 개별 잘못된 행을 건너뛰는 정책은 바꾸지 않았다.
- 원래 manifest source는 `${BASE_URL}/posts-manifest.json` 한 곳이다. HTTP 404 때 다른 manifest 경로를 시도하는 구현은 없었다. 성공 응답의 구형 `{ posts: [...] }`를 Markdown으로 읽는 fallback은 유지하며 회귀 테스트를 추가했다.
- 필터·정렬·페이지·검색어와 URL 변경 로직은 그대로 두고 재시도 카운터만 다시 요청하게 한다. 서비스 cache 전체를 강제로 비우지 않아도 복구된다.

## 검증

`src/test/postDiscoveryFailure.test.ts`의 6개 테스트는 실제 adapter·PostService를 사용하며 `fetch` 경계에서만 응답을 대체한다. 503 후 같은 category/tag/query/sort/page=2가 15개 중 마지막 3개로 복구되는지, network·JSON·404 각각의 실패 후 회복, 정상 빈 목록, 구형 Markdown fallback을 확인했다. 기존 manifest parsing·안전한 post path·홈 검색/결과 정규화·블로그 URL 회귀를 합쳐 6개 파일 20개 테스트가 통과했다.

추가 실행 검증은 `scripts/design-verification/public-review-browser.mjs`의 `*-manifest-recovery-*` 사례와 `public-review-browser-results.json`에 기록한다. 실제 React 페이지와 서비스에 manifest 503을 응답한 뒤 같은 페이지에서 정상 manifest를 제공하며 재시도했다. light·terminal 각각에서 블로그 page=2와 검색·태그·카테고리·정렬 URL 보존, 홈 검색어 보존과 최신 글 회복의 4개 사례가 통과했다. 외부 요청·API 쓰기·WebSocket은 차단했다.

전체 type-check 통과. 수정 범위 lint는 오류 0개이며 기존 Blog Fast Refresh 경고 1개가 남는다. source-preservation guard 148개 통과. 원본 baseline과 원본 `before` hashes는 변경하지 않고, 읽기 옵션을 추가한 11개 선언과 기존 Index lifecycle amendment에 이유와 실제 서비스 회귀 테스트를 연결했다.

## 남은 범위

정상 HTTP/JSON이지만 최상위 schema가 잘못된 manifest를 빈 목록으로 처리하는 기존 계약은 이번 transport 실패 수정에 포함하지 않았다. 이 정책을 바꾸려면 별도의 콘텐츠 데이터 계약 검토가 필요하다. 실제 외부 서버의 가용성이나 전송 성공을 이 로컬 검증으로 주장하지 않는다.
