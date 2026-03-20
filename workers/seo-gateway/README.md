# SEO Gateway

> 참고: 이 문서의 공개 호스트명과 운영 주소 예시는 모두 비식별 placeholder입니다.

## Service Overview

`workers/seo-gateway/`는 crawler 요청에만 HTML meta tag를 재작성하는 worker입니다.

- worker name: `seo-gateway`
- production worker name in Wrangler: `seo-gateway-prod`
- runtime: Cloudflare Workers
- entrypoint: `workers/seo-gateway/src/index.ts`
- compatibility flag: `nodejs_compat`
- production route: `noblog.nodove.com/*`

이 worker의 핵심 목적은 일반 사용자 SPA 흐름을 유지하면서, crawler에는 OG/Twitter/canonical metadata가 포함된 HTML을 반환하는 것입니다.

## Request Split

파일: `workers/seo-gateway/src/index.ts`

### Debug endpoint

- `GET /api/seo-debug`
- query param:
  - `path` optional, default `/`
- response JSON fields:
  - `meta`
  - `isCrawler`
  - `origins.raw`
  - `origins.cdn`

### Non-crawler flow

`isCrawler(user-agent)`가 `false`이면:

- path에 `.`이 포함된 경우 해당 asset/json path를 fetch
- 그 외 path는 `/index.html`을 반환
- 일반 사용자는 rewritten HTML이 아니라 upstream static HTML 흐름을 받음

### Crawler flow

`isCrawler(user-agent)`가 `true`이면:

1. 요청 URL 기준 `resolvePostMeta()` 실행
2. raw GitHub의 `frontend/index.html` fetch
3. `HTMLRewriter`로 title/description/OG/Twitter/canonical tags 재작성
4. `X-SEO-Gateway: active`와 `Cache-Control: public, max-age=300`을 붙여 반환

origin HTML fetch가 실패하면 `404 Not Found`를 반환합니다.

## Upstream Source Contract

파일: `workers/seo-gateway/src/index.ts`

확인된 upstream 상수:

- GitHub Pages CDN: `https://choisimo.github.io/blog`
- raw repo public dir: `https://raw.githubusercontent.com/choisimo/blog/main/frontend/public`
- raw repo index: `https://raw.githubusercontent.com/choisimo/blog/main/frontend/index.html`

path별 fetch 규칙:

- `.json` -> raw GitHub public dir
- `/`, `/index.html` -> GitHub Pages CDN `/index.html`
- 그 외 asset/static path -> GitHub Pages CDN

cache behavior:

- `/assets/*` 또는 `/images/` 포함 path -> `public, max-age=31536000, immutable`
- `.json` -> `public, no-cache, must-revalidate`
- 그 외 일반 upstream response -> `public, max-age=300`

이 구현은 함수 이름과 달리 모든 요청을 raw GitHub에서 가져오지 않습니다.

## Crawler Detection

파일: `workers/seo-gateway/src/crawler-detect.ts`

현재 문자열 매칭 대상 예시:

- `facebookexternalhit`
- `twitterbot`
- `linkedinbot`
- `slackbot`
- `discordbot`
- `googlebot`
- `bingbot`
- `naverbot`

검출 방식은 user-agent substring match입니다.

운영상 의미:

- false negative면 crawler가 rewritten meta 없이 일반 HTML을 받습니다.
- false positive면 실제 브라우저가 crawler path를 타고 rewritten HTML을 받을 수 있습니다.

## Metadata Resolution Contract

파일: `workers/seo-gateway/src/post-resolver.ts`

지원되는 path shape:

- `/blog/{year}/{slug}`
- `/posts/{year}/{slug}`
- `/blog`
- `/posts`
- `/about`
- `/stack`
- default home/other path

post path 처리 규칙:

- `posts-manifest.json`을 `env.GITHUB_PAGES_ORIGIN`에서 fetch
- in-memory manifest cache TTL: 5분
- post가 manifest에 있고 `published !== false`면 manifest metadata 사용
- cover image가 없으면 `${API_BASE_URL}/api/v1/og` 기반 OG image URL 생성
- post가 manifest에 없으면 slug를 title-case로 가공한 fallback article metadata 사용

기타 path 처리:

- `/blog` 및 `/posts` -> blog listing metadata
- `/about` -> about metadata
- `/stack` -> tech stack metadata
- 그 외 -> site-level default metadata

## HTML Rewrite Contract

파일: `workers/seo-gateway/src/meta-rewriter.ts`

rewriter 동작:

- 기존 `og:*`, `article:*`, `twitter:*` meta tag 제거
- 기존 `meta[name="description"]` content 교체
- `<title>` 교체
- `<head>` 끝에 다음 항목 주입
  - `og:type`
  - `og:url`
  - `og:title`
  - `og:description`
  - `og:image`
  - `og:image:width`
  - `og:image:height`
  - `og:site_name`
  - `og:locale`
  - article metadata (`published_time`, `author`, `section`, `tag`)
  - twitter card/title/description/image
  - canonical link

meta text는 HTML escaping 후 삽입됩니다.

## Config

파일: `workers/seo-gateway/wrangler.toml`

dev/prod vars:

- `GITHUB_PAGES_ORIGIN`
- `API_BASE_URL`
- `SITE_BASE_URL`
- `SITE_NAME`

production route:

- `noblog.nodove.com/*`

## Operations

### Quick checks

```bash
curl 'https://noblog.nodove.com/api/seo-debug?path=/blog/2025/example-post'
```

### Failure modes

- manifest fetch 실패 -> post-specific metadata가 fallback title/description로 내려갈 수 있음
- crawler detection 오판 -> rewrite 적용 누락 또는 과적용 가능
- raw/CDN upstream fetch 실패 -> asset or HTML 응답 실패
- stale in-memory manifest cache -> 최대 5분 동안 오래된 metadata 반환 가능
