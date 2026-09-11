# 소스 근거 및 재현 결과

분석 기준: 2026-09-10 KST. 제품 소스 변경·배포·유료 AI 요청 없음.

## 원본 식별

```json
{
  "archive": "blog--snapshot--source-repro--feat_organizing-intelligence-citations--3ece77621379--20260910T081051+0900--dirty.tar.gz",
  "bytes": 3271289,
  "sha256": "53ae34841df03c46b1a3cbcd91b08a7c748614d307cb6a9253ff3814582845a3",
  "regularFiles": 1834,
  "markdownFiles": 0,
  "sourceFilesChanged": [],
  "sourceFilesMissing": []
}
```

## 검증 범위

- 정적 검사와 외부 의존성을 대체한 원본 함수 실행을 구분한다. 원본 1,834개 일반 파일의 해시가 압축파일과 모두 일치한다.
- 전체 npm test / 브라우저 E2E / 운영 DB·Redis·AI-server 호출은 수행하지 않았다. 의존성 설치를 완료하지 못했으며 이를 테스트 통과로 간주하지 않는다.
- HTMLRewriter는 통과형 mock이므로 헤더·라우트·상태 코드 검증이며 실제 Cloudflare HTML 변환 엔진의 검증은 아니다.
- 압축파일에는 Markdown 원문이 없다. 이 사실만으로 운영 원문이나 이미지가 삭제됐다고 판정하지 않는다.
- 공개 사이트 read-only 점검은 이 환경의 DNS 실패로 확인하지 못했다. 운영 장애의 증거가 아니다.

## 재현 결과

```json
{
  "scope": "Source-code reproductions with isolated dependencies; not production or full-suite tests.",
  "source": "/mnt/data/blog-audit/source/blog",
  "checks": [
    {
      "id": "T01-published-slug-rejection",
      "observed": {
        "all": 282,
        "published": 140,
        "rejected": [
          {
            "year": "2026",
            "slug": "Container Network Interface"
          },
          {
            "year": "2025",
            "slug": "감동을_잃어버린_그대들에게"
          },
          {
            "year": "2024",
            "slug": "_index"
          }
        ]
      },
      "expectation": "Every published canonical post is reachable by translation; slash/traversal/control characters remain forbidden.",
      "note": ""
    },
    {
      "id": "P01-error-cached-as-empty",
      "observed": {
        "firstCount": 0,
        "secondCount": 0,
        "afterExplicitCacheClearCount": 1,
        "networkCalls": 2,
        "errorLogs": [
          "Error loading projects manifest: Error: Failed to load projects manifest: 503"
        ]
      },
      "expectation": "A failed load must not become a successful empty cache; retry must refetch.",
      "note": ""
    },
    {
      "id": "S01-crawler-resource-routing",
      "observed": [
        {
          "ua": "Googlebot",
          "route": "/robots.txt",
          "status": 200,
          "type": "text/html; charset=utf-8",
          "originRequests": [
            "https://origin.test/blog/index.html"
          ]
        },
        {
          "ua": "Googlebot",
          "route": "/sitemap.xml",
          "status": 200,
          "type": "text/html; charset=utf-8",
          "originRequests": [
            "https://origin.test/blog/index.html"
          ]
        },
        {
          "ua": "Googlebot",
          "route": "/images/cover.png",
          "status": 200,
          "type": "text/html; charset=utf-8",
          "originRequests": [
            "https://origin.test/blog/index.html"
          ]
        },
        {
          "ua": "Googlebot",
          "route": "/assets/app.js",
          "status": 200,
          "type": "text/html; charset=utf-8",
          "originRequests": [
            "https://origin.test/blog/index.html"
          ]
        },
        {
          "ua": "Googlebot",
          "route": "/blog/2026/definitely-missing-post",
          "status": 200,
          "type": "text/html; charset=utf-8",
          "originRequests": [
            "https://origin.test/blog/posts-manifest.json?v=5963320",
            "https://origin.test/blog/index.html"
          ]
        },
        {
          "ua": "Mozilla/5.0",
          "route": "/robots.txt",
          "status": 200,
          "type": "text/plain; charset=utf-8",
          "originRequests": [
            "https://origin.test/blog/robots.txt"
          ]
        },
        {
          "ua": "Mozilla/5.0",
          "route": "/sitemap.xml",
          "status": 200,
          "type": "application/xml",
          "originRequests": [
            "https://origin.test/blog/sitemap.xml"
          ]
        },
        {
          "ua": "Mozilla/5.0",
          "route": "/images/cover.png",
          "status": 200,
          "type": "image/png",
          "originRequests": [
            "https://origin.test/blog/images/cover.png"
          ]
        },
        {
          "ua": "Mozilla/5.0",
          "route": "/assets/app.js",
          "status": 200,
          "type": "application/javascript; charset=utf-8",
          "originRequests": [
            "https://origin.test/blog/assets/app.js"
          ]
        },
        {
          "ua": "Mozilla/5.0",
          "route": "/blog/2026/definitely-missing-post",
          "status": 200,
          "type": "text/html; charset=utf-8",
          "originRequests": [
            "https://origin.test/blog/index.html"
          ]
        }
      ],
      "expectation": "robots/sitemap/image/JS preserve actual content types regardless of UA; nonexistent pages return 404.",
      "note": "HTMLRewriter passthrough does not affect response routing/status. Upstream requests are mocked."
    },
    {
      "id": "S02-project-canonical-and-encoded-slug",
      "observed": {
        "projects": {
          "title": "Nodove Blog",
          "description": "Tech & Programming Blog",
          "ogImage": "https://api.test/api/v1/og?title=Nodove+Blog&format=png&subtitle=Tech+%26+Programming",
          "url": "https://blog.test",
          "type": "website"
        },
        "encodedPost": {
          "title": "%EA%B0%90%EB%8F%99%EC%9D%84_%EC%9E%83%EC%96%B4%EB%B2%84%EB%A6%B0_%EA%B7%B8%EB%8C%80%EB%93%A4%EC%97%90%EA%B2%8C | Nodove Blog",
          "description": "",
          "ogImage": "https://api.test/api/v1/og?title=%25EA%25B0%2590%25EB%258F%2599%25EC%259D%2584_%25EC%259E%2583%25EC%2596%25B4%25EB%25B2%2584%25EB%25A6%25B0_%25EA%25B7%25B8%25EB%258C%2580%25EB%2593%25A4%25EC%2597%2590%25EA%25B2%258C&format=png",
          "url": "https://blog.test/blog/2025/%EA%B0%90%EB%8F%99%EC%9D%84_%EC%9E%83%EC%96%B4%EB%B2%84%EB%A6%B0_%EA%B7%B8%EB%8C%80%EB%93%A4%EC%97%90%EA%B2%8C",
          "type": "article"
        },
        "expectedTitle": "감동을 잃어버린 그대들에게"
      },
      "expectation": "Projects canonical is /projects; decoded published slug resolves its actual title.",
      "note": ""
    },
    {
      "id": "T02-truncated-and-unvalidated-save",
      "observed": {
        "sourceChars": 50000,
        "bodySentChars": 30045,
        "truncationMarker": true,
        "generatedChars": 100,
        "suspicious": true,
        "dbWrites": 1,
        "returnedAsAiGenerated": true
      },
      "expectation": "Full source content represented; suspicious/incomplete output not promoted into valid translation cache.",
      "note": "AI outputs and D1 are mocks; application translation function is executed unchanged after import isolation."
    },
    {
      "id": "S03-metadata-only-static-html",
      "observed": {
        "articleBodyPresent": false,
        "emptyReactRoot": true,
        "rawScriptCloseInStructuredData": true
      },
      "expectation": "Published HTML contains semantic article body, with inline JSON safe against script termination.",
      "note": "Synthetic title is a serialization test, not a demonstrated external attack."
    },
    {
      "id": "P02-catalog-vs-display-manifest",
      "observed": {
        "catalog": {
          "public": 68,
          "original": 59,
          "forks": 9,
          "empty": 2
        },
        "catalogCheckedAt": "2026-09-07T19:45:06.055365+00:00",
        "manifestTotal": 0,
        "manifestItems": 0,
        "manifestGeneratedAt": "2026-09-09T23:04:19.700Z"
      },
      "expectation": "An intentional full public catalog must not be silently transformed into an empty display manifest.",
      "note": ""
    }
  ],
  "completed": true
}
```

## 공개 콘텐츠 필드 집계

```json
{
  "total": 282,
  "published": 140,
  "cover_present": 52,
  "no_cover": 88,
  "no_description": 1,
  "no_date": 0,
  "languages": {
    "missing": 140
  },
  "no_tags": 7,
  "no_author": 0,
  "md_files_in_archive": 0
}
```

## 파일별 근거

아래 줄 번호는 첨부 압축파일 기준이다. 진단 ID는 분석 문서 및 tasks.md와 연결된다.

### E01 · 번역 조회와 화면 대기시간

`frontend/src/pages/public/BlogPost.tsx:523–659`

```text
 523 |   // Auto-translate when language changes and no native translation exists
 524 |   useEffect(() => {
 525 |     if (!post || !year || !slug) return;
 526 | 
 527 |     const postMatchesUrl = post.year === year && post.slug === slug;
 528 |     if (!postMatchesUrl) {
 529 |       return;
 530 |     }
 531 | 
 532 |     if (hasNativeTranslation) {
 533 |       setAiTranslation(null);
 534 |       setTranslationError(null);
 535 |       setTranslationStatus('idle');
 536 |       return;
 537 |     }
 538 | 
 539 |     let cancelled = false;
 540 |     let pollTimer: number | null = null;
 541 |     let deadlineTimer: number | null = null;
 542 |     let pollAttempts = 0;
 543 |     let pollingFinished = false;
 544 |     let deadlineExpired = false;
 545 |     const requestController = new AbortController();
 546 |     const pollStartMs = Date.now();
 547 |     const MAX_POLL_ATTEMPTS = 5;
 548 |     const MAX_POLL_DURATION_MS = 20_000;
 549 | 
 550 |     const stopPolling = () => {
 551 |       pollingFinished = true;
 552 |       if (pollTimer !== null) {
 553 |         clearTimeout(pollTimer);
 554 |         pollTimer = null;
 555 |       }
 556 |       if (deadlineTimer !== null) {
 557 |         clearTimeout(deadlineTimer);
 558 |         deadlineTimer = null;
 559 |       }
 560 |     };
 561 | 
 562 |     const failPollingAsTimeout = () => {
 563 |       if (cancelled || pollingFinished) return;
 564 | 
 565 |       stopPolling();
 566 |       requestController.abort();
 567 |       setTranslationError({
 568 |         code: 'AI_TIMEOUT',
 569 |         retryable: true,
 570 |       });
 571 |       setTranslationStatus('error');
 572 |     };
 573 | 
 574 |     const scheduleRetry = (delaySeconds?: number) => {
 575 |       if (cancelled || pollingFinished) return;
 576 | 
 577 |       pollAttempts += 1;
 578 |       const elapsedMs = Date.now() - pollStartMs;
 579 |       if (
 580 |         pollAttempts >= MAX_POLL_ATTEMPTS ||
 581 |         elapsedMs >= MAX_POLL_DURATION_MS
 582 |       ) {
 583 |         failPollingAsTimeout();
 584 |         return;
 585 |       }
 586 |       const requestedDelayMs = Math.max(1, delaySeconds ?? 15) * 1000;
 587 |       const retryDelayMs = Math.min(
 588 |         requestedDelayMs,
 589 |         MAX_POLL_DURATION_MS - elapsedMs
 590 |       );
 591 |       pollTimer = window.setTimeout(() => {
 592 |         pollTimer = null;
 593 |         void loadTranslation();
 594 |       }, retryDelayMs);
 595 |     };
 596 | 
 597 |     const loadTranslation = async () => {
 598 |       try {
 599 |         const result = await getCachedTranslation(year, slug, language, {
 600 |           signal: requestController.signal,
 601 |         });
 602 |         if (cancelled || pollingFinished) return;
 603 | 
 604 |         if (result.translation) {
 605 |           setAiTranslation(result.translation);
 606 |         }
 607 | 
 608 |         if (result.pending) {
 609 |           setTranslationError(null);
 610 |           setTranslationStatus('warming');
 611 |           scheduleRetry(result.retryAfterSeconds);
 612 |           return;
 613 |         }
 614 | 
 615 |         stopPolling();
 616 |         setTranslationError(null);
 617 |         setTranslationStatus(result.translation ? 'ready' : 'idle');
 618 |       } catch (err) {
 619 |         if (cancelled) return;
 620 |         if (deadlineExpired && requestController.signal.aborted) {
 621 |           failPollingAsTimeout();
 622 |           return;
 623 |         }
 624 |         if (pollingFinished) return;
 625 | 
 626 |         stopPolling();
 627 |         console.error('Translation failed:', err);
 628 |         if (err instanceof TranslationApiError) {
 629 |           setTranslationError({
 630 |             code: err.code,
 631 |             retryable: err.retryable,
 632 |           });
 633 |         } else {
 634 |           setTranslationError({
 635 |             code: 'UNKNOWN',
 636 |             retryable: false,
 637 |           });
 638 |         }
 639 |         setTranslationStatus('error');
 640 |       }
 641 |     };
 642 | 
 643 |     deadlineTimer = window.setTimeout(() => {
 644 |       deadlineTimer = null;
 645 |       deadlineExpired = true;
 646 |       failPollingAsTimeout();
 647 |     }, MAX_POLL_DURATION_MS);
 648 | 
 649 |     setTranslationStatus('warming');
 650 |     setTranslationError(null);
 651 |     setAiTranslation(null);
 652 |     void loadTranslation();
 653 | 
 654 |     return () => {
 655 |       cancelled = true;
 656 |       stopPolling();
 657 |       requestController.abort();
 658 |     };
 659 |   }, [hasNativeTranslation, language, post, slug, translationRetryNonce, year]);
```

### E01 · 번역 캐시 miss는 enqueue 후 202

`workers/api-gateway/src/routes/translate.ts:296–337`

```text
 296 | async function sendCachedTranslation(c: Context<HonoEnv>) {
 297 |   try {
 298 |     const { year, slug, targetLang } = c.req.param();
 299 |     const normalizedTargetLang = normalizeTranslationLang(targetLang);
 300 | 
 301 |     if (!normalizedTargetLang) {
 302 |       return error(c, `Unsupported target language: ${targetLang}`, 400, 'BAD_REQUEST');
 303 |     }
 304 | 
 305 |     const sourcePost = await fetchPublishedPost(c.env, year, slug);
 306 |     if (!sourcePost) {
 307 |       return error(c, 'Published post not found', 404, 'NOT_AVAILABLE');
 308 |     }
 309 | 
 310 |     const cached = await getValidCachedTranslation(c.env.DB, sourcePost, normalizedTargetLang);
 311 |     if (cached) {
 312 |       return success(c, buildTranslationResponse(cached));
 313 |     }
 314 | 
 315 |     await enqueueTranslationGeneration(c.env, {
 316 |       year,
 317 |       slug,
 318 |       targetLang: normalizedTargetLang,
 319 |       priority: 'interactive',
 320 |     });
 321 | 
 322 |     const stale = await getCachedTranslationRecord(c.env.DB, year, slug, normalizedTargetLang);
 323 |     if (stale && !isSuspiciousTranslation(sourcePost.content, stale.content)) {
 324 |       return success(c, {
 325 |         ...buildTranslationResponse(stale),
 326 |         stale: true,
 327 |         warming: true,
 328 |       });
 329 |     }
 330 | 
 331 |     c.header('Retry-After', '15');
 332 |     return c.json({ ok: true, data: null }, 202);
 333 |   } catch (err) {
 334 |     console.error('Failed to get translation:', err);
 335 |     return error(c, 'Failed to get translation', 500, 'INTERNAL_ERROR');
 336 |   }
 337 | }
```

### E02 · 기본 번역 처리 실행 주기

`workers/api-gateway/wrangler.toml:74–82`

```text
  74 | [[kv_namespaces]]
  75 | binding = "KV"
  76 | id = "8bb28b36c3cb42da8ed7aca89f8cf0fe"
  77 | 
  78 | # Cron triggers for scheduled tasks (daily at 6 AM UTC)
  79 | [triggers]
  80 | crons = ["0 6 * * *"]
  81 | 
  82 | # =============================================================================
```

### E02 · scheduled에서 outbox 소비

`workers/api-gateway/src/index.ts:439–468`

```text
 439 |     }
 440 | 
 441 |     // 3. Clean up old view records from D1 (older than 90 days).
 442 |     //    D1 post_views is now only used for editor-picks caching via cron.
 443 |     //    This retention cleanup keeps D1 storage bounded.
 444 |     const date90dCutoff = new Date();
 445 |     date90dCutoff.setDate(date90dCutoff.getDate() - 90);
 446 |     const date90dStr = date90dCutoff.toISOString().split('T')[0];
 447 |     const cleanupDb = env.DB;
 448 | 
 449 |     await cleanupDb.prepare(`DELETE FROM post_views WHERE view_date < ?`).bind(date90dStr).run();
 450 | 
 451 |     // 4. Flush durable artifact generation work when queue/provider health allows it.
 452 |     const artifactResult = await flushAiArtifactOutbox(env, {
 453 |       limit: 10,
 454 |     });
 455 |     console.log('Artifact scheduler result:', artifactResult);
 456 | 
 457 |     // 5. Flush durable notification deliveries that could not be sent inline.
 458 |     const notificationResult = await flushNotificationOutbox(env, {
 459 |       limit: 25,
 460 |     });
 461 |     console.log('Notification outbox scheduler result:', notificationResult);
 462 | 
 463 |     console.log('Cron job completed successfully');
 464 |   } catch (err) {
 465 |     console.error('Cron job failed:', err);
 466 |   }
 467 | }
 468 | 
```

### E02 · 리소스 게이트와 순차 처리

`workers/api-gateway/src/lib/ai-artifact-outbox.ts:586–651`

```text
 586 | export async function flushAiArtifactOutbox(env: Env, options: { limit?: number } = {}) {
 587 |   await ensureAiArtifactSchema(env.DB);
 588 | 
 589 |   const resource = await getWarmResourceSnapshot(env);
 590 |   await recordSchedulerDecision(env.DB, {
 591 |     schedulerId: 'artifact-scheduler',
 592 |     redisUp: resource.redisUp,
 593 |     queueEnabled: resource.queueEnabled,
 594 |     queueLength: resource.queueLength,
 595 |     dlqLength: resource.dlqLength,
 596 |     allowWarm: resource.allowWarm,
 597 |     decisionReason: resource.reason,
 598 |     snapshot: resource,
 599 |   });
 600 | 
 601 |   if (!resource.allowWarm) {
 602 |     return {
 603 |       processed: 0,
 604 |       deadLettered: 0,
 605 |       scanned: 0,
 606 |       skipped: true,
 607 |       reason: resource.reason,
 608 |     };
 609 |   }
 610 | 
 611 |   const events = await claimDomainOutboxEvents(env.DB, {
 612 |     stream: AI_ARTIFACT_STREAM,
 613 |     limit: options.limit ?? 8,
 614 |   });
 615 | 
 616 |   let processed = 0;
 617 |   let deadLettered = 0;
 618 | 
 619 |   for (const event of events) {
 620 |     try {
 621 |       if (event.eventType === 'translation.generate') {
 622 |         await processTranslationEvent(env, event.payload as TranslationGeneratePayload);
 623 |       } else if (
 624 |         event.eventType === 'feed.lens.generate' ||
 625 |         event.eventType === 'feed.thought.generate'
 626 |       ) {
 627 |         await processFeedEvent(env, event.payload as FeedGeneratePayload);
 628 |       }
 629 | 
 630 |       await markDomainOutboxProcessed(env.DB, event.id);
 631 |       processed += 1;
 632 |     } catch (error) {
 633 |       const message = error instanceof Error ? error.message : 'ai artifact generation failed';
 634 |       const result = await markDomainOutboxFailed(env.DB, {
 635 |         id: event.id,
 636 |         lastError: message,
 637 |         maxRetries: 5,
 638 |       });
 639 |       if (result.status === 'dead_letter') {
 640 |         deadLettered += 1;
 641 |       }
 642 |     }
 643 |   }
 644 | 
 645 |   return {
 646 |     processed,
 647 |     deadLettered,
 648 |     scanned: events.length,
 649 |     skipped: false,
 650 |     reason: resource.reason,
 651 |   };
```

### E03 · Redis/asyncMode 및 모든 공급자 상태에 의존

`workers/api-gateway/src/lib/ai-artifact-outbox.ts:107–155`

```text
 107 | 
 108 | function resourceReason(
 109 |   queue: QueueStatsSnapshot,
 110 |   providerHealth: Array<{ id: string; healthStatus: string }>
 111 | ) {
 112 |   if (!queue.redisUp || !queue.enabled || !queue.asyncMode) return 'queue-unavailable';
 113 |   if (queue.queueLength >= MAX_QUEUE_LENGTH) return 'queue-busy';
 114 |   if (queue.dlqLength >= MAX_DLQ_LENGTH) return 'dlq-busy';
 115 |   if (providerHealth.some((provider) => provider.healthStatus === 'down')) {
 116 |     return 'provider-down';
 117 |   }
 118 |   return 'ok';
 119 | }
 120 | 
 121 | async function appendOrReuseOutboxEvent<TPayload>(
 122 |   env: Env,
 123 |   input: {
 124 |     aggregateId: string;
 125 |     eventType: string;
 126 |     payload: TPayload;
 127 |     idempotencyKey: string;
 128 |   }
 129 | ) {
 130 |   try {
 131 |     return await appendDomainOutboxEvent(env.DB, {
 132 |       stream: AI_ARTIFACT_STREAM,
 133 |       aggregateId: input.aggregateId,
 134 |       eventType: input.eventType,
 135 |       payload: input.payload,
 136 |       idempotencyKey: input.idempotencyKey,
 137 |     });
 138 |   } catch (error) {
 139 |     const message = error instanceof Error ? error.message : 'domain outbox append failed';
 140 |     if (!message.includes('UNIQUE constraint')) {
 141 |       throw error;
 142 |     }
 143 |     const existing = await getDomainOutboxEventByIdempotencyKey(
 144 |       env.DB,
 145 |       AI_ARTIFACT_STREAM,
 146 |       input.idempotencyKey
 147 |     );
 148 |     if (!existing) {
 149 |       throw error;
 150 |     }
 151 |     if (existing.status === 'dead_letter') {
 152 |       await reviveDomainOutboxEvent(env.DB, existing.id);
 153 |       return { ...existing, status: 'pending' as const, retryCount: 0 };
 154 |     }
 155 |     return existing;
```

### E03 · enqueue 우선순위와 버전 생성

`workers/api-gateway/src/lib/ai-artifact-outbox.ts:314–375`

```text
 314 | export async function enqueueTranslationGeneration(
 315 |   env: Env,
 316 |   input: {
 317 |     year: string;
 318 |     slug: string;
 319 |     targetLang: SupportedTranslationLang;
 320 |     forceRefresh?: boolean;
 321 |     priority?: 'interactive' | 'publish' | 'revisit' | 'hot' | 'idle';
 322 |   }
 323 | ) {
 324 |   await ensureAiArtifactSchema(env.DB);
 325 |   const sourcePost = await fetchPublishedPost(env, input.year, input.slug);
 326 |   if (!sourcePost) {
 327 |     throw new Error('Published post not found');
 328 |   }
 329 | 
 330 |   const sourceHash = `sha256:${hashContent(sourcePost.content)}`;
 331 |   const scopeKey = `${input.year}:${input.slug}:${input.targetLang}`;
 332 |   const modelRoute = (await getAiDefaultModel(env)) || 'default';
 333 |   const generationVersionHash = await buildGenerationVersionHash({
 334 |     sourceHash,
 335 |     artifactType: 'translation',
 336 |     promptVersion: TRANSLATION_PROMPT_VERSION,
 337 |     schemaVersion: '1',
 338 |     modelRoute,
 339 |   });
 340 | 
 341 |   const payload: TranslationGeneratePayload = {
 342 |     artifactType: 'translation',
 343 |     year: input.year,
 344 |     slug: input.slug,
 345 |     targetLang: input.targetLang,
 346 |     sourceHash,
 347 |     promptVersion: TRANSLATION_PROMPT_VERSION,
 348 |     forceRefresh: input.forceRefresh,
 349 |     priority: input.priority ?? 'interactive',
 350 |   };
 351 | 
 352 |   const event = await appendOrReuseOutboxEvent(env, {
 353 |     aggregateId: scopeKey,
 354 |     eventType: 'translation.generate',
 355 |     payload,
 356 |     idempotencyKey: `translation|${scopeKey}|${generationVersionHash}|p:0`,
 357 |   });
 358 | 
 359 |   await upsertWarmCandidate(env.DB, {
 360 |     artifactType: 'translation',
 361 |     scopeKey,
 362 |     sourceRef: JSON.stringify({ year: input.year, slug: input.slug }),
 363 |     targetLang: input.targetLang,
 364 |     priority: payload.priority,
 365 |     targetPages: 1,
 366 |     meta: { forceRefresh: Boolean(input.forceRefresh) },
 367 |   });
 368 | 
 369 |   return {
 370 |     event,
 371 |     scopeKey,
 372 |     sourceHash,
 373 |     generationVersionHash,
 374 |   };
 375 | }
```

### E03 · 실제 claim 정렬 기준

`workers/api-gateway/src/lib/domain-outbox.ts:371–430`

```text
 371 | export async function claimDomainOutboxEvents(
 372 |   db: D1Database,
 373 |   input: ClaimDomainOutboxInput
 374 | ): Promise<DomainOutboxEvent[]> {
 375 |   await ensureDomainOutboxSchema(db);
 376 | 
 377 |   const now = input.now || new Date().toISOString();
 378 |   const rows = await queryAll<DomainOutboxRow>(
 379 |     db,
 380 |     `SELECT id, stream, aggregate_id, event_type, payload_json, idempotency_key,
 381 |             status, retry_count, created_at, next_attempt_at, locked_at,
 382 |             consumer_id, updated_at, last_attempt_at, processed_at, last_error
 383 |        FROM domain_outbox
 384 |       WHERE stream = ?
 385 |         AND status = 'pending'
 386 |         AND next_attempt_at <= ?
 387 |       ORDER BY created_at ASC
 388 |       LIMIT ?`,
 389 |     input.stream,
 390 |     now,
 391 |     normalizeLimit(input.limit)
 392 |   );
 393 | 
 394 |   const claimed: DomainOutboxEvent[] = [];
 395 |   for (const row of rows) {
 396 |     const result = await execute(
 397 |       db,
 398 |       `UPDATE domain_outbox
 399 |           SET status = 'processing',
 400 |               last_attempt_at = ?,
 401 |               locked_at = ?,
 402 |               consumer_id = ?,
 403 |               updated_at = ?
 404 |         WHERE id = ?
 405 |           AND status = 'pending'
 406 |           AND next_attempt_at <= ?`,
 407 |       now,
 408 |       now,
 409 |       input.stream,
 410 |       now,
 411 |       row.id,
 412 |       now
 413 |     );
 414 | 
 415 |     if ((result.meta?.changes || 0) > 0) {
 416 |       claimed.push(
 417 |         mapRow({
 418 |           ...row,
 419 |           status: 'processing',
 420 |           locked_at: now,
 421 |           consumer_id: input.stream,
 422 |           updated_at: now,
 423 |           last_attempt_at: now,
 424 |         })
 425 |       );
 426 |     }
 427 |   }
 428 | 
 429 |   return claimed;
 430 | }
```

### E03 · 기본 async false, 이미지 설정

`backend/src/config/schema.js:21–37`

```text
  21 | 
  22 |   AI_SERVER_URL: z.string().default('https://api.openai.com/v1'),
  23 |   AI_API_KEY: z.string().optional(),
  24 |   OPENAI_API_KEY: z.string().optional(),
  25 |   AI_DEFAULT_MODEL: z.string().default(AI_MODELS.DEFAULT),
  26 |   AI_VISION_MODEL: z.string().optional(),
  27 |   AI_ASYNC_MODE: z.enum(['true', 'false']).default('false'),
  28 |   AI_IMAGE_PROXY_BASE_URL: z.string().default('https://api.openai.com/v1'),
  29 |   AI_IMAGE_PROXY_API_KEY: z.string().optional(),
  30 |   AI_IMAGE_MODEL: z.string().default('gpt-5.6-sol'),
  31 |   AI_IMAGE_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
  32 |   AI_IMAGE_MAX_COUNT: z.coerce.number().int().positive().max(4).default(4),
  33 |   AI_IMAGE_MAX_PROMPT_LENGTH: z.coerce.number().int().positive().default(4_000),
  34 |   AI_IMAGE_MAX_OUTPUT_BYTES: z.coerce.number().int().positive().default(12_582_912),
  35 |   AI_IMAGE_STORAGE_SUBDIR: z.string().default('ai'),
  36 | 
  37 |   JWT_EXPIRES_IN: z.string().default('12h'),
```

### E04 · 현재 번역 slug 검증

`frontend/src/services/content/translate.ts:230–265`

```text
 230 | const TRANSLATION_YEAR_PATTERN = /^\d{4}$/;
 231 | const TRANSLATION_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
 232 | const TRANSLATION_LANGUAGE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/;
 233 | const TRANSLATION_JOB_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
 234 | const TRANSLATION_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
 235 | 
 236 | function decodeTranslationSelector(value: string): string | null {
 237 |   const trimmed = value.trim();
 238 |   if (!trimmed) return null;
 239 | 
 240 |   try {
 241 |     return decodeURIComponent(trimmed).trim();
 242 |   } catch {
 243 |     return trimmed;
 244 |   }
 245 | }
 246 | 
 247 | function normalizeTranslationSegment(
 248 |   value: string,
 249 |   label: string,
 250 |   pattern: RegExp,
 251 | ): string {
 252 |   const normalized = decodeTranslationSelector(value);
 253 |   if (!normalized || !pattern.test(normalized)) {
 254 |     throw new TranslationApiError(`Invalid translation ${label}`, {
 255 |       code: "UNKNOWN",
 256 |       status: 400,
 257 |     });
 258 |   }
 259 | 
 260 |   return encodeURIComponent(normalized);
 261 | }
 262 | 
 263 | function normalizeOptionalJobId(value?: string): string | null {
 264 |   if (value === undefined) return null;
 265 | 
```

### E05 · 단순 해시, 본문 절단, 의심 결과 검사

`workers/api-gateway/src/lib/translation-service.ts:119–153`

```text
 119 | export function hashContent(content: string): string {
 120 |   let hash = 0;
 121 |   for (let i = 0; i < content.length; i++) {
 122 |     const char = content.charCodeAt(i);
 123 |     hash = (hash << 5) - hash + char;
 124 |     hash &= hash;
 125 |   }
 126 |   return hash.toString(16);
 127 | }
 128 | 
 129 | function truncateForTranslation(
 130 |   content: string,
 131 |   maxChars: number = TEXT_LIMITS.TRANSLATE_CONTENT
 132 | ): string {
 133 |   if (content.length <= maxChars) return content;
 134 |   return `${content.slice(0, maxChars)}\n\n[... content truncated for translation ...]`;
 135 | }
 136 | 
 137 | export function normalizeComparableText(value: string): string {
 138 |   return value.replace(/\s+/g, ' ').trim();
 139 | }
 140 | 
 141 | export function isSuspiciousTranslation(source: string, translated: string): boolean {
 142 |   const src = normalizeComparableText(source);
 143 |   const dst = normalizeComparableText(translated);
 144 | 
 145 |   if (!src || !dst) return true;
 146 | 
 147 |   const ratio = dst.length / src.length;
 148 |   if (ratio < 0.35 || ratio > 2.8) return true;
 149 |   if (src.length > 2000 && dst.length < 300) return true;
 150 | 
 151 |   return false;
 152 | }
 153 | 
```

### E05 · 생성 결과를 검증 없이 저장하는 경로

`workers/api-gateway/src/lib/translation-service.ts:248–345`

```text
 248 | export async function translateAndCachePost(
 249 |   env: Env,
 250 |   db: D1Database,
 251 |   input: GenerateTranslationInput
 252 | ): Promise<TranslationResponseData> {
 253 |   const { year, slug, targetLang, sourceLang, title, description, content } = input;
 254 |   const contentHash = hashContent(content);
 255 | 
 256 |   if (!input.forceRefresh) {
 257 |     const cached = await getCachedTranslationRecord(db, year, slug, targetLang);
 258 |     if (
 259 |       cached &&
 260 |       cached.content_hash === contentHash &&
 261 |       !isSuspiciousTranslation(content, cached.content)
 262 |     ) {
 263 |       return buildTranslationResponse(cached);
 264 |     }
 265 |   }
 266 | 
 267 |   if (sourceLang === targetLang) {
 268 |     return {
 269 |       title,
 270 |       description,
 271 |       content,
 272 |       cached: false,
 273 |       isAiGenerated: false,
 274 |     };
 275 |   }
 276 | 
 277 |   const sourceLangName = LANG_NAMES[sourceLang] || sourceLang;
 278 |   const targetLangName = LANG_NAMES[targetLang] || targetLang;
 279 |   const aiService = createAIService(env);
 280 | 
 281 |   const titlePrompt = `Translate the following blog post title from ${sourceLangName} to ${targetLangName}.\nReturn ONLY the translated title, nothing else.\n\nTitle: ${title}`;
 282 | 
 283 |   const translatedTitle = await aiService.generate(titlePrompt, {
 284 |     temperature: AI_TEMPERATURES.TRANSLATE,
 285 |     maxTokens: MAX_TOKENS.TRANSLATE_TITLE,
 286 |   });
 287 | 
 288 |   let translatedDescription = '';
 289 |   if (description) {
 290 |     const descPrompt = `Translate the following blog post description from ${sourceLangName} to ${targetLangName}.\nReturn ONLY the translated description, nothing else.\n\nDescription: ${description}`;
 291 | 
 292 |     translatedDescription = await aiService.generate(descPrompt, {
 293 |       temperature: AI_TEMPERATURES.TRANSLATE,
 294 |       maxTokens: MAX_TOKENS.TRANSLATE_DESC,
 295 |     });
 296 |   }
 297 | 
 298 |   const truncatedContent = truncateForTranslation(content);
 299 |   const contentPrompt = `You are a professional translator. Translate the following blog post content from ${sourceLangName} to ${targetLangName}.\n\nIMPORTANT RULES:\n1. Preserve ALL markdown formatting exactly (headers, code blocks, lists, links, images, etc.)\n2. Do NOT translate code snippets inside fenced code blocks\n3. Do NOT translate URLs or file paths\n4. Preserve technical terms when appropriate (with translation in parentheses if needed)\n5. Maintain the same paragraph structure\n6. Return ONLY the translated content, no explanations\n\nContent:\n${truncatedContent}`;
 300 | 
 301 |   const translatedContent = await aiService.generate(contentPrompt, {
 302 |     temperature: AI_TEMPERATURES.TRANSLATE_CONTENT,
 303 |     maxTokens: MAX_TOKENS.TRANSLATE_CONTENT,
 304 |   });
 305 | 
 306 |   const cleanTitle = translatedTitle.trim().replace(/^["']|["']$/g, '');
 307 |   const cleanDescription = translatedDescription.trim().replace(/^["']|["']$/g, '');
 308 |   const cleanContent = translatedContent.trim();
 309 | 
 310 |   await execute(
 311 |     db,
 312 |     `INSERT INTO post_translations_cache
 313 |        (post_slug, year, source_lang, target_lang, title, description, content, content_hash, is_ai_generated)
 314 |      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
 315 |      ON CONFLICT(post_slug, year, target_lang)
 316 |      DO UPDATE SET
 317 |        source_lang = ?,
 318 |        title = ?,
 319 |        description = ?,
 320 |        content = ?,
 321 |        content_hash = ?,
 322 |        is_ai_generated = 1,
 323 |        updated_at = datetime('now')`,
 324 |     slug,
 325 |     year,
 326 |     sourceLang,
 327 |     targetLang,
 328 |     cleanTitle,
 329 |     cleanDescription,
 330 |     cleanContent,
 331 |     contentHash,
 332 |     sourceLang,
 333 |     cleanTitle,
 334 |     cleanDescription,
 335 |     cleanContent,
 336 |     contentHash
 337 |   );
 338 | 
 339 |   return {
 340 |     title: cleanTitle,
 341 |     description: cleanDescription,
 342 |     content: cleanContent,
 343 |     cached: false,
 344 |     isAiGenerated: true,
 345 |   };
```

### E05 · 번역 토큰·글자 한계

`workers/api-gateway/src/config/defaults.ts:28–60`

```text
  28 | export const MAX_TOKENS = {
  29 |   SKETCH: 1024,
  30 |   PRISM: 1536,
  31 |   CHAIN: 1024,
  32 |   SUMMARY: 2048,
  33 |   CUSTOM: 2048,
  34 |   TRANSLATE_TITLE: 256,
  35 |   TRANSLATE_DESC: 512,
  36 |   TRANSLATE_CONTENT: 16000,
  37 |   QUIZ: 3072,
  38 | } as const;
  39 | 
  40 | // =============================================================================
  41 | // Text Limits
  42 | // =============================================================================
  43 | export const TEXT_LIMITS = {
  44 |   PARAGRAPH: 2000,
  45 |   CONTENT: 4000,
  46 |   TITLE: 120,
  47 |   BULLET: 100,
  48 |   TRANSLATE_CONTENT: 30000,
  49 |   PRISM_TRUNCATE: 140,
  50 |   SUMMARY_TRUNCATE: 200,
  51 | } as const;
  52 | 
  53 | // =============================================================================
  54 | // Streaming
  55 | // =============================================================================
  56 | export const STREAMING = {
  57 |   CHUNK_SIZE: 80,
  58 |   CHUNK_DELAY: 25, // ms
  59 | } as const;
  60 | 
```

### E06 · 원문 재조회와 언어 결정

`workers/api-gateway/src/lib/translation-service.ts:154–201`

```text
 154 | export async function fetchPublishedPost(
 155 |   env: Env,
 156 |   year: string,
 157 |   slug: string
 158 | ): Promise<SourcePost | null> {
 159 |   const siteUrl = getPublicSiteUrl(env);
 160 |   const manifestResponse = await fetch(`${siteUrl}/posts-manifest.json`, {
 161 |     headers: { Accept: 'application/json' },
 162 |   });
 163 | 
 164 |   if (!manifestResponse.ok) {
 165 |     throw new Error(`Failed to load posts manifest: ${manifestResponse.status}`);
 166 |   }
 167 | 
 168 |   const manifest = (await manifestResponse.json()) as { items?: ManifestItem[] };
 169 |   const item = manifest.items?.find(
 170 |     (entry) => entry.year === year && entry.slug === slug && entry.published !== false
 171 |   );
 172 | 
 173 |   if (!item?.path) {
 174 |     return null;
 175 |   }
 176 | 
 177 |   const normalizedPath = item.path.startsWith('/') ? item.path : `/${item.path}`;
 178 |   const markdownResponse = await fetch(`${siteUrl}${normalizedPath}`, {
 179 |     headers: { Accept: 'text/markdown, text/plain, */*' },
 180 |   });
 181 | 
 182 |   if (!markdownResponse.ok) {
 183 |     return null;
 184 |   }
 185 | 
 186 |   const markdown = await markdownResponse.text();
 187 |   const { data, content } = parseFrontmatter(markdown);
 188 | 
 189 |   return {
 190 |     year,
 191 |     slug,
 192 |     title: data.title || item.title || slug,
 193 |     description: data.description || data.excerpt || item.description || item.excerpt || '',
 194 |     content,
 195 |     sourceLang:
 196 |       normalizeTranslationLang(data.defaultLanguage) ||
 197 |       normalizeTranslationLang(item.defaultLanguage) ||
 198 |       normalizeTranslationLang(item.language) ||
 199 |       'ko',
 200 |   };
 201 | }
```

### E06 · 캐시 유효성 검사 대상

`workers/api-gateway/src/lib/translation-service.ts:231–246`

```text
 231 | export async function getValidCachedTranslation(
 232 |   db: D1Database,
 233 |   sourcePost: SourcePost,
 234 |   targetLang: SupportedTranslationLang
 235 | ): Promise<TranslationCache | null> {
 236 |   const cached = await getCachedTranslationRecord(db, sourcePost.year, sourcePost.slug, targetLang);
 237 |   const contentHash = hashContent(sourcePost.content);
 238 |   if (
 239 |     cached &&
 240 |     cached.content_hash === contentHash &&
 241 |     !isSuspiciousTranslation(sourcePost.content, cached.content)
 242 |   ) {
 243 |     return cached;
 244 |   }
 245 |   return null;
 246 | }
```

### E06 · 번역 캐시 삭제는 작업 재실행과 별개

`workers/api-gateway/src/routes/translate.ts:339–361`

```text
 339 | async function deleteCachedTranslation(c: Context<HonoEnv>) {
 340 |   try {
 341 |     const { year, slug, targetLang } = c.req.param();
 342 |     const normalizedTargetLang = normalizeTranslationLang(targetLang);
 343 | 
 344 |     if (!normalizedTargetLang) {
 345 |       return error(c, `Unsupported target language: ${targetLang}`, 400, 'BAD_REQUEST');
 346 |     }
 347 | 
 348 |     await c.env.DB.prepare(
 349 |       `DELETE FROM post_translations_cache
 350 |        WHERE post_slug = ? AND year = ? AND target_lang = ?`
 351 |     )
 352 |       .bind(slug, year, normalizedTargetLang)
 353 |       .run();
 354 | 
 355 |     return success(c, { deleted: true });
 356 |   } catch (err) {
 357 |     console.error('Failed to delete translation:', err);
 358 |     return error(c, 'Failed to delete translation', 500, 'INTERNAL_ERROR');
 359 |   }
 360 | }
 361 | 
```

### E06 · 관리자 replay와 별도 AI flush

`workers/api-gateway/src/routes/admin-outbox.ts:81–136`

```text
  81 | /**
  82 |  * Replay one or more outbox events by id. This also supports targeted
  83 |  * translation recovery by passing a single translation outbox event id.
  84 |  */
  85 | adminOutbox.post('/:stream/replay', async (c) => {
  86 |   const stream = c.req.param('stream');
  87 |   if (!stream) {
  88 |     return badRequest(c, 'stream is required');
  89 |   }
  90 | 
  91 |   const body = await c.req.json().catch(() => ({}));
  92 |   const ids = Array.isArray((body as { ids?: string[] }).ids)
  93 |     ? (body as { ids: string[] }).ids
  94 |         .map((value) => String(value || '').trim())
  95 |         .filter(Boolean)
  96 |         .slice(0, 100)
  97 |     : [];
  98 | 
  99 |   if (ids.length === 0) {
 100 |     return badRequest(c, 'ids is required');
 101 |   }
 102 | 
 103 |   for (const id of ids) {
 104 |     await replayDomainOutboxEvent(c.env.DB, id);
 105 |   }
 106 | 
 107 |   let flushResult: Awaited<ReturnType<typeof flushMemoryEmbeddingOutbox>> | null =
 108 |     null;
 109 |   if (stream === MEMORY_EMBEDDING_STREAM) {
 110 |     flushResult = await flushMemoryEmbeddingOutbox(c.env, {
 111 |       limit: Math.max(ids.length, 25),
 112 |     });
 113 |   } else if (stream === NOTIFICATION_DELIVERY_STREAM) {
 114 |     flushResult = await flushNotificationOutbox(c.env, {
 115 |       limit: Math.max(ids.length, 25),
 116 |     });
 117 |   }
 118 | 
 119 |   return success(c, {
 120 |     replayed: ids.length,
 121 |     ids,
 122 |     flush: flushResult,
 123 |   });
 124 | });
 125 | 
 126 | adminOutbox.post('/:stream/ai-flush', async (c) => {
 127 |   const stream = c.req.param('stream');
 128 |   const limit = Math.min(parseLimit(c.req.query('limit'), 10), 50);
 129 | 
 130 |   if (stream !== AI_ARTIFACT_STREAM) {
 131 |     return badRequest(c, `Unsupported stream: ${stream}`);
 132 |   }
 133 | 
 134 |   const result = await flushAiArtifactOutbox(c.env, { limit });
 135 |   return success(c, result);
 136 | });
```

### E07 · 직접 task와 대기 한계

`frontend/src/services/discovery/ai.ts:62–80`

```text
  62 |   persona?: string;
  63 |   [key: string]: unknown;
  64 | };
  65 | 
  66 | const DIRECT_TASK_MODES = new Set<ChatTaskMode>(["sketch", "prism", "chain"]);
  67 | const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
  68 | const MULTILINE_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
  69 | const WHITESPACE_PATTERN = /\s+/g;
  70 | const MAX_AI_ERROR_MESSAGE_LENGTH = 1000;
  71 | export const AI_TASK_TIMEOUT_MS = 120_000;
  72 | 
  73 | // ============================================================================
  74 | // Utilities
  75 | // ============================================================================
  76 | 
  77 | /**
  78 |  * 객체인지 확인
  79 |  */
  80 | function isRecord(v: unknown): v is Record<string, unknown> {
```

### E07 · task 응답 전체 수신

`frontend/src/services/discovery/ai.ts:192–244`

```text
 192 |   }
 193 | }
 194 | 
 195 | async function invokeDirectTask<T>(
 196 |   mode: ChatTaskMode,
 197 |   payload: TaskPayload,
 198 |   signal: AbortSignal,
 199 | ): Promise<T> {
 200 |   return invokeDirectTaskWithToken<T>({
 201 |     mode,
 202 |     payload,
 203 |     signal,
 204 |     token: await getPrincipalToken(),
 205 |     retryAuth: true,
 206 |   });
 207 | }
 208 | 
 209 | async function invokeDirectTaskWithToken<T>(input: {
 210 |   mode: ChatTaskMode;
 211 |   payload: TaskPayload;
 212 |   signal: AbortSignal;
 213 |   token: string;
 214 |   retryAuth: boolean;
 215 | }): Promise<T> {
 216 |   const res = await fetch(`${getApiBaseUrl()}/api/v1/ai/${input.mode}`, {
 217 |     method: "POST",
 218 |     headers: {
 219 |       "Content-Type": "application/json",
 220 |       Accept: "application/json",
 221 |       ...bearerAuth(input.token),
 222 |     },
 223 |     body: JSON.stringify(input.payload),
 224 |     signal: input.signal,
 225 |   });
 226 | 
 227 |   const text = await res.text().catch(() => "");
 228 |   const parsed = text ? tryParseJson<unknown>(text) ?? text : null;
 229 |   if (!res.ok) {
 230 |     if (input.retryAuth && isInvalidAuthSignature(res.status, parsed)) {
 231 |       const token = await refreshPrincipalTokenAfterAuthFailure();
 232 |       return invokeDirectTaskWithToken<T>({
 233 |         ...input,
 234 |         token,
 235 |         retryAuth: false,
 236 |       });
 237 |     }
 238 |     throw new Error(getTaskErrorMessage(parsed, `AI task failed (${res.status})`));
 239 |   }
 240 |   if (isFallbackResponse(parsed)) {
 241 |     throw new Error("AI server returned fallback: backend unavailable");
 242 |   }
 243 | 
 244 |   const data = getEnvelopeData(parsed);
```

### E07 · 기존 실제 SSE와 heartbeat

`backend/src/routes/chat.js:612–650`

```text
 612 |     // Set up SSE
 613 |     writeSseHeaders(res);
 614 | 
 615 |     const send = (data) => {
 616 |       writeSseEvent(res, data);
 617 |     };
 618 | 
 619 |     send({ type: "session", sessionId: effectiveSessionId });
 620 | 
 621 |     let closed = false;
 622 |     res.on("close", () => {
 623 |       closed = true;
 624 |     });
 625 | 
 626 |     const heartbeatInterval = setInterval(() => {
 627 |       if (!closed) {
 628 |         send({ type: "heartbeat", ts: Date.now() });
 629 |       }
 630 |     }, 15000);
 631 | 
 632 |     let emittedText = "";
 633 |     let replaySources = [];
 634 |     let idempotencyStored = false;
 635 | 
 636 |     try {
 637 |       const userQuery = deriveUserQuery(parts, userMessage);
 638 |       const articleSlug = pageContext?.article?.slug || null;
 639 |       const articleYear = pageContext?.article?.year || null;
 640 |       const { notebookContext, ragContext, ragSources } =
 641 |         await resolveMessageContexts({
 642 |           userQuery,
 643 |           session,
 644 |           enableRag,
 645 |           articleSlug,
 646 |           articleYear,
 647 |         });
 648 | 
 649 |       if (ragSources.length > 0) {
 650 |         replaySources = ragSources;
```

### E07 · 이미 병렬화되고 제한된 RAG/notebook 조회

`backend/src/services/session.service.js:543–574`

```text
 543 | export async function resolveMessageContexts({
 544 |   userQuery,
 545 |   session,
 546 |   enableRag,
 547 |   articleSlug = null,
 548 |   articleYear = null,
 549 | }) {
 550 |   const notebookPromise = withSoftTimeout(
 551 |     buildNotebookContext(userQuery, session),
 552 |     CHAT_NOTEBOOK_CONTEXT_TIMEOUT_MS,
 553 |     null,
 554 |   ).catch(() => null);
 555 | 
 556 |   const ragPromise = enableRag
 557 |     ? withSoftTimeout(
 558 |         _performRAGSearch(userQuery, 5, articleSlug, articleYear),
 559 |         CHAT_RAG_CONTEXT_TIMEOUT_MS,
 560 |         { context: null, sources: [] },
 561 |       ).catch(() => ({ context: null, sources: [] }))
 562 |     : Promise.resolve({ context: null, sources: [] });
 563 | 
 564 |   const [notebookContext, ragResult] = await Promise.all([
 565 |     notebookPromise,
 566 |     ragPromise,
 567 |   ]);
 568 |   return {
 569 |     notebookContext: notebookContext || null,
 570 |     ragContext: ragResult?.context || null,
 571 |     ragSources: Array.isArray(ragResult?.sources) ? ragResult.sources : [],
 572 |   };
 573 | }
 574 | 
```

### E07 · stream fallback과 취소 경계

`backend/src/lib/chat-streaming.js:199–243`

```text
 199 | export async function streamWithFallback({
 200 |   aiService: ai,
 201 |   messages,
 202 |   model,
 203 |   timeout,
 204 |   chunkSize,
 205 |   chunkDelayMs,
 206 |   isClosed,
 207 |   sendChunk,
 208 | }) {
 209 |   let text = "";
 210 | 
 211 |   try {
 212 |     for await (const chunk of ai.streamChat(messages, { model, timeout })) {
 213 |       const emitted = await emitTextChunks({
 214 |         text: chunk,
 215 |         chunkSize,
 216 |         chunkDelayMs: 0,
 217 |         isClosed,
 218 |         sendChunk,
 219 |       });
 220 |       text += emitted;
 221 |     }
 222 |   } catch (streamErr) {
 223 |     if (!text) {
 224 |       // Streaming produced nothing — try non-streaming fallback
 225 |       const fallback = await ai.chat(messages, { model, timeout });
 226 |       const fallbackText = fallback.content || "";
 227 |       if (!isClosed() && fallbackText) {
 228 |         text += await emitTextChunks({
 229 |           text: fallbackText,
 230 |           chunkSize,
 231 |           chunkDelayMs,
 232 |           isClosed,
 233 |           sendChunk,
 234 |         });
 235 |       }
 236 |     } else {
 237 |       // Partial text was already emitted — don't silently swallow
 238 |       throw streamErr;
 239 |     }
 240 |   }
 241 | 
 242 |   return text;
 243 | }
```

### E08 · 완성 후 쪼개 보내는 별도 SSE 경로

`workers/api-gateway/src/routes/ai.ts:255–289`

```text
 255 |   const rateLimit = await enforceAiRateLimit(c, 'generate-stream');
 256 |   if (rateLimit) return rateLimit;
 257 | 
 258 |   const aiService = createAIService(c.env);
 259 | 
 260 |   const stream = new ReadableStream<Uint8Array>({
 261 |     async start(controller) {
 262 |       try {
 263 |         controller.enqueue(frame('open', { type: 'open' }));
 264 | 
 265 |         const text = await aiService.generate(String(q), {
 266 |           temperature,
 267 |           timeout: AI_DEFAULT_TIMEOUT_MS,
 268 |         });
 269 | 
 270 |         const chunkSize = STREAMING.CHUNK_SIZE;
 271 |         for (let i = 0; i < text.length; i += chunkSize) {
 272 |           const token = text.slice(i, Math.min(i + chunkSize, text.length));
 273 |           controller.enqueue(frame('token', { token }));
 274 |           await new Promise((r) => setTimeout(r, STREAMING.CHUNK_DELAY));
 275 |         }
 276 | 
 277 |         controller.enqueue(frame('done', { type: 'done' }));
 278 |       } catch (err) {
 279 |         const message = err instanceof Error ? err.message : 'generation failed';
 280 |         controller.enqueue(frame('error', { message }));
 281 |       } finally {
 282 |         try {
 283 |           controller.close();
 284 |         } catch {}
 285 |       }
 286 |     },
 287 |   });
 288 | 
 289 |   return new Response(stream, { headers, status: 200 });
```

### E08 · SDK timeout/retry 설정

`backend/src/services/ai/openai-client.service.js:120–137`

```text
 120 | 
 121 |     // Initialize OpenAI client
 122 |     this._openai = new OpenAI({
 123 |       baseURL: this.baseUrl,
 124 |       apiKey: this.apiKey,
 125 |       timeout: options.timeout || DEFAULT_TIMEOUT,
 126 |       maxRetries: OPENAI_CLIENT.MAX_RETRIES,
 127 |     });
 128 | 
 129 |     // Circuit breaker state
 130 |     this._circuitState = {
 131 |       failures: 0,
 132 |       lastFailure: 0,
 133 |       isOpen: false,
 134 |     };
 135 | 
 136 |     // Health check cache
 137 |     this._healthCache = {
```

### E09 · 기존 관리자 이미지 API

`backend/src/routes/adminAiImages.js:1–114`

```text
   1 | import { Router } from 'express';
   2 | import { z } from 'zod';
   3 | import { config } from '../config.js';
   4 | import requireAdmin from '../middleware/adminAuth.js';
   5 | import { ServiceUnavailableError } from '../middleware/errorHandler.js';
   6 | import { runIdempotent } from '../lib/idempotency.js';
   7 | import { createLogger } from '../lib/logger.js';
   8 | import { litellmImageGenerationService } from '../services/ai-image/litellm-image-generation.service.js';
   9 | import { generatedImageStorageService } from '../services/ai-image/generated-image-storage.service.js';
  10 | 
  11 | const logger = createLogger('admin-ai-images-route');
  12 | const router = Router();
  13 | 
  14 | const SIZE_OPTIONS = ['1024x1024', '1536x1024', '1024x1536'];
  15 | const QUALITY_OPTIONS = ['low', 'medium', 'high', 'auto'];
  16 | 
  17 | function buildGenerateSchema() {
  18 |   const imageConfig = config.ai?.image || {};
  19 |   const maxCount = Math.min(Math.max(Number(imageConfig.maxCount || 1), 1), 4);
  20 |   const maxPromptLength = Math.max(Number(imageConfig.maxPromptLength || 4_000), 1);
  21 | 
  22 |   return z.object({
  23 |     year: z.coerce.string().regex(/^\d{4}$/, 'year must be YYYY'),
  24 |     slug: z.string().trim().min(1).max(140),
  25 |     prompt: z.string().trim().min(8).max(maxPromptLength),
  26 |     n: z.coerce.number().int().min(1).max(maxCount).default(1),
  27 |     size: z.enum(SIZE_OPTIONS).default('1024x1024'),
  28 |     quality: z.enum(QUALITY_OPTIONS).default('medium'),
  29 |     outputFormat: z.enum(['png']).default('png'),
  30 |     alt: z.string().trim().max(180).optional(),
  31 |   });
  32 | }
  33 | 
  34 | function requireFeatureEnabled() {
  35 |   if (config.features?.adminAiImageEnabled !== true) {
  36 |     throw new ServiceUnavailableError('Admin AI image generation is disabled');
  37 |   }
  38 | }
  39 | 
  40 | function buildRequestId(req) {
  41 |   const forwarded = req.headers?.['x-request-id'];
  42 |   const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  43 |   return String(value || `admin-ai-image-${Date.now()}`).slice(0, 128);
  44 | }
  45 | 
  46 | router.get('/health', requireAdmin, async (_req, res, next) => {
  47 |   try {
  48 |     const data = await litellmImageGenerationService.health();
  49 |     return res.json({ ok: true, data });
  50 |   } catch (err) {
  51 |     return next(err);
  52 |   }
  53 | });
  54 | 
  55 | router.post('/generate', requireAdmin, async (req, res, next) => {
  56 |   try {
  57 |     requireFeatureEnabled();
  58 | 
  59 |     const input = buildGenerateSchema().parse(req.body || {});
  60 |     const requestId = buildRequestId(req);
  61 | 
  62 |     return await runIdempotent(
  63 |       req,
  64 |       res,
  65 |       'admin.ai-images.generate',
  66 |       input,
  67 |       async () => {
  68 |         const generation = await litellmImageGenerationService.generateImages(input, {
  69 |           requestId,
  70 |         });
  71 |         const stored = await generatedImageStorageService.saveImages({
  72 |           year: input.year,
  73 |           slug: input.slug,
  74 |           subdir: config.ai?.image?.storageSubdir,
  75 |           images: generation.items,
  76 |           alt: input.alt || `${input.slug} cover image`,
  77 |           requestId,
  78 |         });
  79 | 
  80 |         logger.info({ requestId }, 'Generated AI images saved', {
  81 |           year: input.year,
  82 |           slug: input.slug,
  83 |           imageCount: stored.items.length,
  84 |           dir: stored.dir,
  85 |           model: generation.model,
  86 |           durationMs: generation.durationMs,
  87 |         });
  88 | 
  89 |         return {
  90 |           statusCode: 201,
  91 |           response: {
  92 |             ok: true,
  93 |             data: {
  94 |               dir: stored.dir,
  95 |               model: generation.model,
  96 |               created: generation.created,
  97 |               durationMs: generation.durationMs,
  98 |               usage: generation.usage,
  99 |               metadata: generation.metadata,
 100 |               items: stored.items,
 101 |             },
 102 |           },
 103 |         };
 104 |       },
 105 |       {
 106 |         lockSeconds: Math.ceil((config.ai?.image?.timeoutMs || 300_000) / 1000) + 60,
 107 |       },
 108 |     );
 109 |   } catch (err) {
 110 |     return next(err);
 111 |   }
 112 | });
 113 | 
 114 | export default router;
```

### E09 · 이미지 모델 탐색과 생성 API

`backend/src/services/ai-image/litellm-image-generation.service.js:156–245`

```text
 156 | 
 157 |   async health() {
 158 |     const state = this.getConfigurationState();
 159 |     if (!state.enabled || !state.configured) {
 160 |       return {
 161 |         ...state,
 162 |         upstream: {
 163 |           ok: false,
 164 |           status: state.enabled ? 'not_configured' : 'disabled',
 165 |         },
 166 |       };
 167 |     }
 168 | 
 169 |     const imageConfig = config.ai?.image || {};
 170 |     const url = joinEndpoint(imageConfig.proxyBaseUrl, '/model-names');
 171 |     try {
 172 |       const response = await fetch(url, {
 173 |         method: 'GET',
 174 |         headers: {
 175 |           Authorization: `Bearer ${imageConfig.proxyApiKey}`,
 176 |           Accept: 'application/json',
 177 |         },
 178 |         signal: AbortSignal.timeout(Math.min(5_000, imageConfig.timeoutMs || 5_000)),
 179 |       });
 180 |       const body = await response.json().catch(() => null);
 181 |       const models = Array.isArray(body?.data)
 182 |         ? body.data
 183 |         : Array.isArray(body?.models)
 184 |           ? body.models
 185 |           : Array.isArray(body)
 186 |             ? body
 187 |             : null;
 188 |       const modelAvailable = models
 189 |         ? models.some((entry) => {
 190 |             const id =
 191 |               typeof entry === 'string' ? entry : entry?.id || entry?.name || entry?.model;
 192 |             return id === imageConfig.model;
 193 |           })
 194 |         : null;
 195 | 
 196 |       return {
 197 |         ...state,
 198 |         upstream: {
 199 |           ok: response.ok,
 200 |           status: response.ok ? 'ok' : `http_${response.status}`,
 201 |           modelAvailable,
 202 |         },
 203 |       };
 204 |     } catch (error) {
 205 |       return {
 206 |         ...state,
 207 |         upstream: {
 208 |           ok: false,
 209 |           status: error?.name === 'TimeoutError' ? 'timeout' : 'unreachable',
 210 |         },
 211 |       };
 212 |     }
 213 |   }
 214 | 
 215 |   async generateImages(input, options = {}) {
 216 |     const imageConfig = ensureConfigured();
 217 |     const requestId = options.requestId || `img-${Date.now()}`;
 218 |     const startedAt = Date.now();
 219 |     const url = joinEndpoint(imageConfig.proxyBaseUrl, '/images/generations');
 220 |     const payload = buildGenerationPayload(input, imageConfig);
 221 | 
 222 |     logger.info({ requestId }, 'Starting AI image generation', {
 223 |       model: imageConfig.model,
 224 |       count: payload.n,
 225 |       size: payload.size,
 226 |       quality: payload.quality,
 227 |     });
 228 | 
 229 |     let response;
 230 |     try {
 231 |       response = await fetch(url, {
 232 |         method: 'POST',
 233 |         headers: {
 234 |           Authorization: `Bearer ${imageConfig.proxyApiKey}`,
 235 |           'Content-Type': 'application/json',
 236 |           Accept: 'application/json',
 237 |           'X-Request-ID': requestId,
 238 |         },
 239 |         body: JSON.stringify(payload),
 240 |         signal: AbortSignal.timeout(imageConfig.timeoutMs),
 241 |       });
 242 |     } catch (error) {
 243 |       const durationMs = Date.now() - startedAt;
 244 |       const cause = classifyRequestFailure(error);
 245 |       logger.error({ requestId }, 'AI image generation request failed', {
```

### E10 · 기존 PNG/WebP 생성

`backend/src/services/ai-image/generated-image-storage.service.js:45–115`

```text
  45 |   if (resolved !== imagesRoot && !resolved.startsWith(`${imagesRoot}${path.sep}`)) {
  46 |     throw new BadRequestError('Invalid image storage path');
  47 |   }
  48 |   return resolved;
  49 | }
  50 | 
  51 | function rejectObviousNonRaster(buffer) {
  52 |   const prefix = buffer.subarray(0, 64).toString('utf8').trim().toLowerCase();
  53 |   if (BLOCKED_TEXT_PREFIXES.some((entry) => prefix.startsWith(entry))) {
  54 |     throw new BadGatewayError('AI image response was not a raster image');
  55 |   }
  56 | }
  57 | 
  58 | async function normalizePng(buffer, maxOutputBytes) {
  59 |   if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
  60 |     throw new BadGatewayError('AI image response was empty');
  61 |   }
  62 |   if (buffer.length > maxOutputBytes) {
  63 |     throw new BadGatewayError('AI image response exceeded the output byte limit', {
  64 |       maxOutputBytes,
  65 |     });
  66 |   }
  67 | 
  68 |   rejectObviousNonRaster(buffer);
  69 | 
  70 |   let image;
  71 |   try {
  72 |     image = sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 }).rotate();
  73 |     const metadata = await image.metadata();
  74 |     if (!metadata.width || !metadata.height || metadata.format === 'svg') {
  75 |       throw new Error('Unsupported image metadata');
  76 |     }
  77 |     const png = await image.png({ compressionLevel: 9 }).toBuffer();
  78 |     if (png.length > maxOutputBytes) {
  79 |       throw new Error('Normalized PNG exceeds byte limit');
  80 |     }
  81 |     return {
  82 |       buffer: png,
  83 |       width: metadata.width,
  84 |       height: metadata.height,
  85 |     };
  86 |   } catch (error) {
  87 |     throw new BadGatewayError('AI image response could not be decoded as a raster image', {
  88 |       message: error.message,
  89 |     });
  90 |   }
  91 | }
  92 | 
  93 | async function buildWebpVariant(pngBuffer, baseName) {
  94 |   const image = sharp(pngBuffer, { failOn: 'error' });
  95 |   const metadata = await image.metadata();
  96 |   const maxWidth = 1024;
  97 |   const sourceWidth = metadata.width || maxWidth;
  98 |   const width = Math.min(sourceWidth, maxWidth);
  99 |   const resized = sourceWidth > maxWidth ? image.resize({ width: maxWidth }) : image;
 100 |   const webpBuffer = await resized.webp({ quality: 82 }).toBuffer();
 101 |   const filename = `${baseName}-w${width}.webp`;
 102 | 
 103 |   return {
 104 |     buffer: webpBuffer,
 105 |     filename,
 106 |     width,
 107 |     sizeBytes: webpBuffer.length,
 108 |   };
 109 | }
 110 | 
 111 | function normalizeRemoteBaseUrl(value, name) {
 112 |   try {
 113 |     const url = new URL(String(value || ''));
 114 |     if (url.protocol !== 'https:') {
 115 |       throw new Error('HTTPS is required');
```

### E10 · 기존 원격 이미지 저장과 검증

`backend/src/services/ai-image/generated-image-storage.service.js:140–244`

```text
 140 | 
 141 |   return {
 142 |     workerApiUrl: normalizeRemoteBaseUrl(config.services.workerApiUrl, 'WORKER_API_URL'),
 143 |     backendKey: config.backendKey,
 144 |     assetsBaseUrl: normalizeRemoteBaseUrl(config.assetsBaseUrl, 'ASSETS_BASE_URL'),
 145 |   };
 146 | }
 147 | 
 148 | function buildAssetUrl(assetsBaseUrl, key) {
 149 |   return new URL(key, `${assetsBaseUrl}/`).toString();
 150 | }
 151 | 
 152 | async function uploadRemoteAsset({ remoteConfig, key, buffer, contentType, requestId }) {
 153 |   const uploadUrl = new URL(REMOTE_UPLOAD_PATH, `${remoteConfig.workerApiUrl}/`);
 154 |   const headers = {
 155 |     'Content-Type': 'application/json',
 156 |     'X-Backend-Key': remoteConfig.backendKey,
 157 |   };
 158 |   const safeRequestId = String(requestId || '')
 159 |     .replace(/[^a-zA-Z0-9._:-]/g, '-')
 160 |     .slice(0, 128);
 161 |   if (safeRequestId) {
 162 |     headers['X-Request-ID'] = safeRequestId;
 163 |   }
 164 | 
 165 |   let response;
 166 |   try {
 167 |     response = await fetch(uploadUrl, {
 168 |       method: 'POST',
 169 |       headers,
 170 |       body: JSON.stringify({
 171 |         key,
 172 |         contentType,
 173 |         data: buffer.toString('base64'),
 174 |       }),
 175 |       signal: AbortSignal.timeout(REMOTE_UPLOAD_TIMEOUT_MS),
 176 |     });
 177 |   } catch (error) {
 178 |     throw new BadGatewayError('Generated image storage request failed', {
 179 |       requestId: safeRequestId || undefined,
 180 |       cause: error?.name === 'TimeoutError' ? 'timeout' : 'network_error',
 181 |     });
 182 |   }
 183 | 
 184 |   const payload = await response.json().catch(() => null);
 185 |   const stored = payload?.ok === true ? payload.data : null;
 186 |   const expectedUrl = buildAssetUrl(remoteConfig.assetsBaseUrl, key);
 187 |   if (
 188 |     !response.ok ||
 189 |     stored?.key !== key ||
 190 |     stored?.url !== expectedUrl ||
 191 |     stored?.contentType !== contentType ||
 192 |     stored?.size !== buffer.length
 193 |   ) {
 194 |     throw new BadGatewayError('Generated image storage rejected the upload', {
 195 |       requestId: safeRequestId || undefined,
 196 |       upstreamStatus: response.status,
 197 |     });
 198 |   }
 199 | 
 200 |   return stored.url;
 201 | }
 202 | 
 203 | async function persistAsset({
 204 |   remoteConfig,
 205 |   key,
 206 |   absolutePath,
 207 |   buffer,
 208 |   contentType,
 209 |   requestId,
 210 | }) {
 211 |   if (remoteConfig) {
 212 |     return uploadRemoteAsset({ remoteConfig, key, buffer, contentType, requestId });
 213 |   }
 214 | 
 215 |   await fse.writeFile(absolutePath, buffer);
 216 |   return `/${key}`;
 217 | }
 218 | 
 219 | function uniqueFilename(destDirAbs, desiredName) {
 220 |   let filename = desiredName;
 221 |   const ext = path.extname(desiredName);
 222 |   const base = desiredName.slice(0, -ext.length);
 223 |   let counter = 1;
 224 |   while (fs.existsSync(path.join(destDirAbs, filename))) {
 225 |     filename = `${base}-${counter}${ext}`;
 226 |     counter += 1;
 227 |   }
 228 |   return filename;
 229 | }
 230 | 
 231 | export class GeneratedImageStorageService {
 232 |   buildDirectory({ year, slug, subdir }) {
 233 |     const normalizedYear = sanitizeSegment(year);
 234 |     const normalizedSlug = sanitizeSegment(slug);
 235 |     if (!/^\d{4}$/.test(normalizedYear)) {
 236 |       throw new BadRequestError('year must be YYYY');
 237 |     }
 238 |     if (!normalizedSlug) {
 239 |       throw new BadRequestError('slug is required for AI image storage');
 240 |     }
 241 | 
 242 |     const normalizedSubdir = sanitizeSubdir(subdir || config.ai?.image?.storageSubdir);
 243 |     const rel = path.posix.join(normalizedYear, normalizedSlug, normalizedSubdir);
 244 |     const abs = ensureInsideImagesDir(path.join(config.content.imagesDir, rel));
```

### E10 · 클라이언트의 매번 다른 idempotency key

`frontend/src/services/session/adminImages.ts:319–351`

```text
 319 | 
 320 | export async function generatePostImages(
 321 |   payload: GeneratePostImagesPayload,
 322 |   _token?: string,
 323 | ): Promise<GeneratePostImagesResponse> {
 324 |   const normalizedPayload = normalizeGeneratePostImagesPayload(payload);
 325 |   const base = getApiBaseUrl();
 326 |   const response = await adminFetchRaw(`${base}/api/v1/admin/ai-images/generate`, {
 327 |     method: 'POST',
 328 |     headers: {
 329 |       'Content-Type': 'application/json',
 330 |       'Idempotency-Key': createIdempotencyKey(),
 331 |     },
 332 |     body: JSON.stringify({
 333 |       ...normalizedPayload,
 334 |     }),
 335 |   }).catch((error: unknown) => {
 336 |     throw new Error(
 337 |       getErrorMessage(
 338 |         error instanceof Error ? { message: error.message } : null,
 339 |         'Failed to generate image',
 340 |       ),
 341 |     );
 342 |   });
 343 |   const json = await response.json().catch(() => ({}));
 344 |   if (!response.ok || !json?.ok) {
 345 |     throw new Error(getErrorMessage(json, 'Failed to generate image'));
 346 |   }
 347 |   if (!isGeneratePostImagesResponse(json.data)) {
 348 |     throw new Error('AI image generation returned an invalid response');
 349 |   }
 350 |   return json.data;
 351 | }
```

### E11 · 기존 에이전트 이미지 도구

`backend/src/services/agent/tools/image-generation.tool.js:1–34`

```text
   1 | /**
   2 |  * Agent Image Generation Tool
   3 |  *
   4 |  * Lets the blog agent turn article context into stored raster image assets.
   5 |  * The actual generation and storage invariants are delegated to the existing
   6 |  * ai-image services used by the admin image route.
   7 |  */
   8 | 
   9 | import { z } from "zod";
  10 | import { config } from "../../../config.js";
  11 | import { createLogger } from "../../../lib/logger.js";
  12 | import { litellmImageGenerationService } from "../../ai-image/litellm-image-generation.service.js";
  13 | import { generatedImageStorageService } from "../../ai-image/generated-image-storage.service.js";
  14 | 
  15 | const logger = createLogger("agent-image-generation");
  16 | 
  17 | const OPERATIONS = [
  18 |   "suggest_prompt",
  19 |   "generate_cover",
  20 |   "generate_inline",
  21 |   "generate_variants",
  22 |   "set_cover_candidate",
  23 | ];
  24 | const SIZE_OPTIONS = [
  25 |   "1024x1024",
  26 |   "1536x1024",
  27 |   "1024x1536",
  28 | ];
  29 | const QUALITY_OPTIONS = ["low", "medium", "high", "auto"];
  30 | 
  31 | function clamp(value, min, max) {
  32 |   const parsed = Number(value);
  33 |   if (!Number.isFinite(parsed)) return min;
  34 |   return Math.max(min, Math.min(max, Math.floor(parsed)));
```

### E11 · 이미지 프롬프트와 alt 기본값

`backend/src/services/agent/tools/image-generation.tool.js:84–128`

```text
  84 | 
  85 | function buildPrompt(input) {
  86 |   if (input.prompt?.trim()) return input.prompt.trim().slice(0, getMaxPromptLength());
  87 | 
  88 |   const title = text(input.title || input.slug || "Untitled blog post", 180);
  89 |   const category = text(input.category || "General", 80);
  90 |   const tags = normalizeTags(input.tags);
  91 |   const excerpt = text(input.content, 900);
  92 |   const visualBrief = text(input.visualBrief, 900);
  93 |   const style = text(input.style, 400);
  94 | 
  95 |   const intent =
  96 |     input.operation === "generate_inline"
  97 |       ? "Create a clear inline editorial illustration or conceptual diagram for a technical blog section."
  98 |       : "Create a polished editorial cover image for a technical blog post.";
  99 | 
 100 |   return [
 101 |     intent,
 102 |     "Use crisp raster details, a modern tech-blog visual language, balanced composition, no visible text, no logos, and no watermark.",
 103 |     style ? `Preferred style: ${style}` : "",
 104 |     `Title: ${title}`,
 105 |     `Category: ${category}`,
 106 |     tags.length ? `Tags: ${tags.join(", ")}` : "",
 107 |     visualBrief ? `Visual brief: ${visualBrief}` : "",
 108 |     excerpt ? `Article excerpt: ${excerpt}` : "",
 109 |   ]
 110 |     .filter(Boolean)
 111 |     .join("\n")
 112 |     .slice(0, getMaxPromptLength());
 113 | }
 114 | 
 115 | function buildAlt(input) {
 116 |   return (
 117 |     text(input.alt, 180) ||
 118 |     text(input.title, 160) ||
 119 |     text(input.slug, 120) ||
 120 |     "AI generated blog image"
 121 |   );
 122 | }
 123 | 
 124 | function buildActions(operation, items) {
 125 |   if (!Array.isArray(items) || items.length === 0) return [];
 126 | 
 127 |   if (operation === "generate_cover" || operation === "set_cover_candidate") {
 128 |     const first = items[0];
```

### E12 · 화면용 Projects manifest

`frontend/public/projects-manifest.json:1–6`

```text
   1 | {
   2 |   "total": 0,
   3 |   "items": [],
   4 |   "generatedAt": "2026-09-09T23:04:19.700Z",
   5 |   "format": 1
   6 | }
```

### E12 · 검토된 공개 저장소 목록

`frontend/public/project-catalog.json:1–14`

```text
   1 | {
   2 |   "account": "choisimo",
   3 |   "checkedAt": "2026-09-07T19:45:06.055365+00:00",
   4 |   "source": "gh repo list choisimo --limit 1000 --json ...; gh api pinned default-branch README and root contents",
   5 |   "scope": "All public repositories, including forks and empty repositories. Private repositories and other accounts are excluded.",
   6 |   "counts": {
   7 |     "public": 68,
   8 |     "original": 59,
   9 |     "forks": 9,
  10 |     "empty": 2
  11 |   },
  12 |   "repositories": [
  13 |     {
  14 |       "repository": "choisimo/AgentVerse",
```

### E13 · project source 부재도 빈 manifest를 저장

`frontend/scripts/generate-projects-manifest.js:175–203`

```text
 175 | function main() {
 176 |   console.log('🚀 Generating projects manifest...');
 177 | 
 178 |   if (!fs.existsSync(projectDataDir)) {
 179 |     fs.mkdirSync(projectDataDir, { recursive: true });
 180 |     console.log('ℹ️  Created missing directory: public/project-data');
 181 |   }
 182 | 
 183 |   const markdownFiles = walkMarkdownFiles(projectDataDir);
 184 | 
 185 |   const parsed = markdownFiles
 186 |     .map(parseProjectFile)
 187 |     .filter(item => item !== null && item.published !== false)
 188 |     .map(({ published, slug, ...rest }) => rest);
 189 | 
 190 |   const sortedItems = sortProjects(parsed);
 191 |   writeManifest(sortedItems);
 192 | 
 193 |   console.log(`✅ Wrote projects manifest: ${path.relative(process.cwd(), manifestPath)}`);
 194 |   console.log(`   - Source markdown files: ${markdownFiles.length}`);
 195 |   console.log(`   - Published projects: ${sortedItems.length}`);
 196 | }
 197 | 
 198 | try {
 199 |   main();
 200 | } catch (error) {
 201 |   console.error('❌ Failed to generate projects manifest:', error);
 202 |   process.exit(1);
 203 | }
```

### E13 · 이미 존재하는 프로젝트 검증기

`frontend/scripts/rebuild-github-project-data.mjs:78–106`

```text
  78 | if (checkOnly) {
  79 |   if (currentFiles.length !== entries.length) throw new Error('Project Markdown count differs from the public inventory.');
  80 |   for (const entry of entries) {
  81 |     const target = path.join(projectDataDir, entry.filename);
  82 |     if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== entry.markdown) {
  83 |       throw new Error(`Project source differs from reviewed evidence: ${entry.filename}`);
  84 |     }
  85 |     const parsed = matter(fs.readFileSync(target, 'utf8')).data;
  86 |     if (JSON.stringify(parsed) !== JSON.stringify(entry.project)) throw new Error(`Frontmatter changed meaning: ${entry.filename}`);
  87 |   }
  88 |   if (JSON.stringify(readJSON(catalogPath)) !== JSON.stringify(catalog)) throw new Error('Public provenance catalog is stale.');
  89 |   const manifest = readJSON(path.join(frontendDir, 'public/projects-manifest.json'));
  90 |   if (manifest.total !== entries.length || manifest.items.length !== entries.length
  91 |     || new Set(manifest.items.map(item => item.id)).size !== entries.length) throw new Error('Manifest has missing or duplicate entries.');
  92 |   for (const entry of entries) {
  93 |     const item = manifest.items.find(item => item.id === entry.project.id);
  94 |     const { published, ...expected } = entry.project;
  95 |     if (!item || Object.entries(expected).some(([key, value]) => JSON.stringify(item[key]) !== JSON.stringify(value))) {
  96 |       throw new Error(`Manifest differs from verified source: ${entry.filename}`);
  97 |     }
  98 |   }
  99 |   console.log(`Verified all ${entries.length} public repositories: ${catalog.counts.original} originals, ${catalog.counts.forks} forks, ${catalog.counts.empty} empty. No missing, extra or duplicate project entries.`);
 100 | } else {
 101 |   // The user requested a full catalog replacement. Validate every entry before removing old Markdown.
 102 |   fs.mkdirSync(projectDataDir, { recursive: true });
 103 |   for (const file of currentFiles) fs.unlinkSync(file);
 104 |   for (const entry of entries) fs.writeFileSync(path.join(projectDataDir, entry.filename), entry.markdown);
 105 |   fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
 106 |   console.log(`Replaced ${currentFiles.length} project sources with ${entries.length} reviewed public repository entries. Run npm run generate-projects-manifest next.`);
```

### E13 · 기본 build 경로

`frontend/package.json:5–15`

```text
   5 |   "type": "module",
   6 |   "scripts": {
   7 |     "predev": "npm run generate-manifests && npm run generate-projects-manifest && npm run generate-runtime-config",
   8 |     "dev": "vite --config config/vite.config.ts",
   9 |     "prebuild": "npm run generate-manifests && npm run generate-projects-manifest && npm run generate-seo && npm run optimize-images && npm run generate-runtime-config",
  10 |     "build": "vite build --config config/vite.config.ts",
  11 |     "postbuild": "node scripts/generate-static-html.js",
  12 |     "build:dev": "vite build --mode development --config config/vite.config.ts",
  13 |     "build:analyze": "vite build --mode production --config config/vite.config.ts && open dist/stats.html",
  14 |     "lint": "eslint src --config config/eslint.config.js --report-unused-disable-directives --max-warnings 74",
  15 |     "lint:fix": "eslint src --config config/eslint.config.js --fix",
```

### E14 · Projects 로딩 실패를 빈 성공 캐시로 저장

`frontend/src/services/content/projectService.ts:134–181`

```text
 134 | 
 135 | export class ProjectService {
 136 |   private static cache: ProjectsManifest | null = null;
 137 | 
 138 |   private static getBasePath(): string {
 139 |     const base = import.meta.env.BASE_URL ?? '/';
 140 |     return base.replace(/\/$/, '');
 141 |   }
 142 | 
 143 |   private static async loadManifest(): Promise<RawProjectsManifest | null> {
 144 |     try {
 145 |       const base = this.getBasePath();
 146 |       const url = `${base}/projects-manifest.json${import.meta.env.PROD ? `?v=${Date.now()}` : ''}`;
 147 |       const response = await fetch(url, { cache: 'no-cache' });
 148 |       if (!response.ok) {
 149 |         throw new Error(`Failed to load projects manifest: ${response.status}`);
 150 |       }
 151 |       return parseProjectsManifest(await response.json());
 152 |     } catch (error) {
 153 |       console.error('Error loading projects manifest:', error);
 154 |       return null;
 155 |     }
 156 |   }
 157 | 
 158 |   static async getAllProjects(): Promise<ProjectItem[]> {
 159 |     if (this.cache) return this.cache.items;
 160 | 
 161 |     const manifest = await this.loadManifest();
 162 |     const rawItems = Array.isArray(manifest?.items) ? manifest?.items : [];
 163 | 
 164 |     const normalizedItems = rawItems
 165 |       .map((item, index) => normalizeProject(item, index))
 166 |       .filter((item): item is ProjectItem => item !== null)
 167 |       .sort((a, b) => {
 168 |         if (a.featured && !b.featured) return -1;
 169 |         if (!a.featured && b.featured) return 1;
 170 |         return new Date(b.date).getTime() - new Date(a.date).getTime();
 171 |       });
 172 | 
 173 |     this.cache = {
 174 |       total: normalizedItems.length,
 175 |       items: normalizedItems,
 176 |       generatedAt: manifest?.generatedAt || new Date().toISOString(),
 177 |       format: manifest?.format ?? 1,
 178 |     };
 179 | 
 180 |     return this.cache.items;
 181 |   }
```

### E15 · About의 현재 이력과 기술 설명

`frontend/src/pages/public/About.tsx:46–113`

```text
  46 | 
  47 | const historyTimeline = [
  48 |   {
  49 |     period: '2024',
  50 |     title: 'CS 전공 심화',
  51 |     description: '알고리즘, 운영체제, 네트워크 중심으로 기반을 강화했습니다.',
  52 |   },
  53 |   {
  54 |     period: '2025',
  55 |     title: 'AI + 시스템 아키텍처 프로젝트',
  56 |     description: 'RAG 기반 도구와 홈랩 인프라 자동화 프로젝트를 병행했습니다.',
  57 |   },
  58 |   {
  59 |     period: '2026 (예정)',
  60 |     title: '졸업 및 엔지니어링 확장',
  61 |     description:
  62 |       '생산성 도구와 AI 서비스 아키텍처를 결합하는 개발을 진행 중입니다.',
  63 |   },
  64 | ] as const;
  65 | 
  66 | const stackSections = [
  67 |   {
  68 |     title: 'AI & LLM Engineering',
  69 |     icon: BrainCircuit,
  70 |     badges: ['LangChain', 'LangGraph', 'LiteLLM', 'RAG', 'n8n'],
  71 |     details: [
  72 |       'LLM Orchestration: LangChain/LangGraph 기반 Multi-Agent 및 Stateful Workflow 설계',
  73 |       'Model Serving: LiteLLM 기반 모델 추상화 + Custom OpenAI-compatible Server 구축',
  74 |       'RAG: 벡터 데이터베이스 연동 및 문서 기반 질의응답 시스템 구현',
  75 |       'Automation: n8n 기반 AI 워크플로우 자동화 및 데이터 파이프라인 구성',
  76 |     ],
  77 |   },
  78 |   {
  79 |     title: 'DevOps & Infrastructure',
  80 |     icon: Cloud,
  81 |     badges: ['Proxmox', 'Docker', 'Docker Compose', 'Kubernetes', 'Ansible', 'Arch Linux'],
  82 |     details: [
  83 |       'Proxmox VE: LXC/VM 클러스터 운영, 자원 최적화 및 홈랩 인프라 관리',
  84 |       'Container: Docker/Compose 기반 복잡한 스택 구성 및 ComposeAI 프로젝트 개발',
  85 |       'Kubernetes: 기초 운영 및 배포 워크플로우 실습',
  86 |       'IaC/Config: Ansible 기반 서버 프로비저닝 및 설정 자동화',
  87 |       'OS: Arch Linux 메인 사용, 커널/시스템 레벨 트러블슈팅 경험',
  88 |     ],
  89 |   },
  90 |   {
  91 |     title: 'Network & Security',
  92 |     icon: Shield,
  93 |     badges: ['OPNsense', 'VLAN', 'Tailscale', 'WireGuard', 'Consul', 'Nginx'],
  94 |     details: [
  95 |       'Network Security: OPNsense 방화벽 정책 관리 및 VLAN 구성',
  96 |       'VPN & Mesh: Tailscale/WireGuard 기반 사설망 원격 접속 및 Site-to-Site 구성',
  97 |       'Service Discovery: Consul KV Store 활용 및 서비스 헬스 체크',
  98 |       'Traffic Management: Nginx Reverse Proxy 및 SSL/TLS Termination',
  99 |     ],
 100 |   },
 101 |   {
 102 |     title: 'Languages & Backend',
 103 |     icon: Code2,
 104 |     badges: ['Java', 'Spring Boot', 'Python', 'Go', 'Dart', 'Flutter'],
 105 |     details: [
 106 |       'Java (Spring Boot): 핵심 메인 서비스 개발에 사용',
 107 |       'Python: 보조 언어로 Asyncio/AI-ML 라이브러리 활용',
 108 |       'Go: 고성능 툴링 및 네트워크 프록시 컨트롤 중심으로 학습/적용',
 109 |       'Dart & Flutter: 크로스 플랫폼 모바일 UI/UX 구현 학습 중',
 110 |     ],
 111 |   },
 112 | ] as const;
 113 | 
```

### E15 · About 소개 문장

`frontend/src/pages/public/About.tsx:204–220`

```text
 204 |                 <h2
 205 |                   id='about-profile-title'
 206 |                   className='ui-panel-title text-2xl'
 207 |                 >
 208 |                   Nodove
 209 |                 </h2>
 210 |                 <CardDescription className='ui-description mt-1'>
 211 |                   CS 전공 · AI와 시스템 아키텍처에 관심 있는 개발자
 212 |                 </CardDescription>
 213 |               </div>
 214 |             </div>
 215 |             <p className='text-sm leading-relaxed text-muted-foreground'>
 216 |               2026년 졸업 예정이며, 백엔드/인프라/AI 경계를 넘나드는 제품 지향
 217 |               개발을 선호합니다. 문제를 구조화하고, 자동화 가능한 시스템으로
 218 |               바꾸는 과정을 즐깁니다.
 219 |             </p>
 220 |           </CardHeader>
```

### E16 · SEO 봇과 일반 사용자 분기

`workers/seo-gateway/src/index.ts:136–190`

```text
 136 | export default {
 137 |   async fetch(request: Request, env: Env): Promise<Response> {
 138 |     const url = new URL(request.url);
 139 |     const userAgent = request.headers.get('user-agent');
 140 | 
 141 |     if (url.pathname === '/api/seo-debug') {
 142 |       const testPath = url.searchParams.get('path') || '/';
 143 |       const testUrl = new URL(testPath, env.SITE_BASE_URL);
 144 |       const meta = await resolvePostMeta(testUrl, env);
 145 |       return new Response(JSON.stringify({ 
 146 |         meta, 
 147 |         isCrawler: isCrawler(userAgent),
 148 |         origins: {
 149 |           pages: env.GITHUB_PAGES_ORIGIN,
 150 |           raw: env.RAW_CONTENT_ORIGIN ?? env.GITHUB_PAGES_ORIGIN
 151 |         }
 152 |       }, null, 2), {
 153 |         headers: { 'Content-Type': 'application/json' },
 154 |       });
 155 |     }
 156 | 
 157 |     if (!isCrawler(userAgent)) {
 158 |       let requestPath = url.pathname;
 159 |       
 160 |       if (requestPath.includes('.')) {
 161 |         return fetchFromConfiguredOrigins(env, requestPath + url.search);
 162 |       }
 163 |       
 164 |       const htmlResponse = await fetchBuiltIndexHtml(env);
 165 |       return htmlResponse;
 166 |     }
 167 | 
 168 |     const meta = await resolvePostMeta(url, env);
 169 | 
 170 |     const originResponse = await fetchBuiltIndexHtml(env);
 171 | 
 172 |     if (!originResponse.ok) {
 173 |       return new Response('Not Found', { status: 404 });
 174 |     }
 175 | 
 176 |     const rewriter = createRewriter(meta, env);
 177 |     const transformedResponse = rewriter.transform(originResponse);
 178 | 
 179 |     const newHeaders = new Headers(transformedResponse.headers);
 180 |     newHeaders.set('Content-Type', 'text/html; charset=utf-8');
 181 |     newHeaders.set('X-SEO-Gateway', 'active');
 182 |     newHeaders.set('Cache-Control', 'public, max-age=300');
 183 |     applyHtmlSecurityHeaders(newHeaders);
 184 | 
 185 |     return new Response(transformedResponse.body, {
 186 |       status: 200,
 187 |       headers: newHeaders,
 188 |     });
 189 |   },
 190 | };
```

### E16 · SEO 게이트웨이 운영 라우트 설정

`workers/seo-gateway/wrangler.toml:1–18`

```text
   1 | name = "seo-gateway"
   2 | main = "src/index.ts"
   3 | compatibility_date = "2025-01-01"
   4 | compatibility_flags = ["nodejs_compat"]
   5 | 
   6 | [vars]
   7 | GITHUB_PAGES_ORIGIN = "https://choisimo.github.io/blog"
   8 | RAW_CONTENT_ORIGIN = "https://raw.githubusercontent.com/choisimo/blog/main/frontend/public"
   9 | API_BASE_URL = "https://api.nodove.com"
  10 | SITE_BASE_URL = "https://noblog.nodove.com"
  11 | SITE_NAME = "Nodove Blog"
  12 | 
  13 | [env.production]
  14 | name = "seo-gateway-prod"
  15 | vars = { GITHUB_PAGES_ORIGIN = "https://choisimo.github.io/blog", RAW_CONTENT_ORIGIN = "https://raw.githubusercontent.com/choisimo/blog/main/frontend/public", API_BASE_URL = "https://api.nodove.com", SITE_BASE_URL = "https://noblog.nodove.com", SITE_NAME = "Nodove Blog" }
  16 | routes = [
  17 |   { pattern = "noblog.nodove.com/*", zone_name = "nodove.com" }
  18 | ]
```

### E17 · 원문 slug 조회와 누락된 Projects 처리

`workers/seo-gateway/src/post-resolver.ts:31–124`

```text
  31 | 
  32 | function findPostInManifest(manifest: Manifest, year: string, slug: string): ManifestItem | null {
  33 |   if (!manifest.items) return null;
  34 |   return manifest.items.find(
  35 |     item => item.year === year && item.slug === slug && item.published !== false
  36 |   ) || null;
  37 | }
  38 | 
  39 | function buildOgImageUrl(env: Env, title: string, subtitle?: string): string {
  40 |   const params = new URLSearchParams({ title, format: 'png' });
  41 |   if (subtitle) params.set('subtitle', subtitle);
  42 |   return `${env.API_BASE_URL}/api/v1/og?${params.toString()}`;
  43 | }
  44 | 
  45 | export async function resolvePostMeta(url: URL, env: Env): Promise<PostMeta> {
  46 |   const pathname = url.pathname;
  47 | 
  48 |   // Support both /blog/ and /posts/ URL patterns
  49 |   const blogPostMatch = pathname.match(/^\/(?:blog|posts)\/(\d{4})\/([^/]+)\/?$/);
  50 |   if (blogPostMatch) {
  51 |     const [, year, slug] = blogPostMatch;
  52 |     const manifest = await fetchManifest(env);
  53 | 
  54 |     if (manifest) {
  55 |       const post = findPostInManifest(manifest, year, slug);
  56 |       if (post) {
  57 |         const ogImage = post.coverImage
  58 |           ? (post.coverImage.startsWith('http')
  59 |               ? post.coverImage
  60 |               : `${env.SITE_BASE_URL}${post.coverImage.startsWith('/') ? '' : '/'}${post.coverImage}`)
  61 |           : buildOgImageUrl(env, post.title, post.category);
  62 | 
  63 |         return {
  64 |           title: `${post.title} | ${env.SITE_NAME}`,
  65 |           description: post.description || post.snippet || '',
  66 |           ogImage,
  67 |           url: `${env.SITE_BASE_URL}/blog/${year}/${slug}`,
  68 |           type: 'article',
  69 |           publishedTime: post.date,
  70 |           author: post.author,
  71 |           category: post.category,
  72 |           tags: post.tags,
  73 |         };
  74 |       }
  75 |     }
  76 | 
  77 |     const formattedSlug = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  78 |     return {
  79 |       title: `${formattedSlug} | ${env.SITE_NAME}`,
  80 |       description: '',
  81 |       ogImage: buildOgImageUrl(env, formattedSlug),
  82 |       url: `${env.SITE_BASE_URL}/blog/${year}/${slug}`,
  83 |       type: 'article',
  84 |     };
  85 |   }
  86 | 
  87 |   if (pathname === '/blog' || pathname === '/blog/' || pathname === '/posts' || pathname === '/posts/') {
  88 |     return {
  89 |       title: `Blog | ${env.SITE_NAME}`,
  90 |       description: '기술, 개발, 생각에 대한 글들',
  91 |       ogImage: buildOgImageUrl(env, 'Blog', env.SITE_NAME),
  92 |       url: `${env.SITE_BASE_URL}/blog`,
  93 |       type: 'website',
  94 |     };
  95 |   }
  96 | 
  97 |   if (pathname === '/about' || pathname === '/about/') {
  98 |     return {
  99 |       title: `About | ${env.SITE_NAME}`,
 100 |       description: 'Nodove 소개',
 101 |       ogImage: buildOgImageUrl(env, 'About', env.SITE_NAME),
 102 |       url: `${env.SITE_BASE_URL}/about`,
 103 |       type: 'website',
 104 |     };
 105 |   }
 106 | 
 107 |   if (pathname === '/stack' || pathname === '/stack/') {
 108 |     return {
 109 |       title: `Tech Stack | ${env.SITE_NAME}`,
 110 |       description: '사용하는 기술 스택',
 111 |       ogImage: buildOgImageUrl(env, 'Tech Stack', env.SITE_NAME),
 112 |       url: `${env.SITE_BASE_URL}/stack`,
 113 |       type: 'website',
 114 |     };
 115 |   }
 116 | 
 117 |   return {
 118 |     title: env.SITE_NAME,
 119 |     description: 'Tech & Programming Blog',
 120 |     ogImage: buildOgImageUrl(env, env.SITE_NAME, 'Tech & Programming'),
 121 |     url: env.SITE_BASE_URL,
 122 |     type: 'website',
 123 |   };
 124 | }
```

### E18 · 본문을 출력하지 않는 static HTML 생성

`frontend/scripts/generate-static-html.js:134–192`

```text
 134 | }
 135 | 
 136 | function generatePostHtml(template, post) {
 137 |   const title = escapeHtml(post.title);
 138 |   const description = escapeHtml(post.description || post.snippet || '');
 139 |   const url = `${BASE_URL}/blog/${post.year}/${post.slug}`;
 140 |   const category = escapeHtml(post.category || 'Blog');
 141 |   const image = resolveImageUrl(post.coverImage, post.title, post.category);
 142 |   const date = post.date || new Date().toISOString();
 143 |   const author = escapeHtml(post.author || 'Admin');
 144 |   const tags = Array.isArray(post.tags) ? post.tags.map(t => escapeHtml(t)).join(', ') : '';
 145 | 
 146 |   let html = template;
 147 | 
 148 |   html = html.replace(/<title>[^<]*<\/title>/, `<title>${title} | ${SITE_NAME}</title>`);
 149 | 
 150 |   const existingDescMeta = /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i;
 151 |   if (existingDescMeta.test(html)) {
 152 |     html = html.replace(existingDescMeta, `<meta name="description" content="${description}" />`);
 153 |   }
 154 | 
 155 |   const ogTags = `
 156 |     <!-- Open Graph / Facebook / KakaoTalk -->
 157 |     <meta property="og:type" content="article" />
 158 |     <meta property="og:url" content="${url}" />
 159 |     <meta property="og:title" content="${title}" />
 160 |     <meta property="og:description" content="${description}" />
 161 |     <meta property="og:image" content="${image}" />
 162 |     <meta property="og:image:width" content="1200" />
 163 |     <meta property="og:image:height" content="630" />
 164 |     <meta property="og:site_name" content="${SITE_NAME}" />
 165 |     <meta property="og:locale" content="ko_KR" />
 166 |     <meta property="article:published_time" content="${date}" />
 167 |     <meta property="article:author" content="${author}" />
 168 |     <meta property="article:section" content="${category}" />
 169 |     ${tags ? `<meta property="article:tag" content="${tags}" />` : ''}
 170 |     
 171 |     <!-- Twitter -->
 172 |     <meta name="twitter:card" content="summary_large_image" />
 173 |     <meta name="twitter:url" content="${url}" />
 174 |     <meta name="twitter:title" content="${title}" />
 175 |     <meta name="twitter:description" content="${description}" />
 176 |     <meta name="twitter:image" content="${image}" />
 177 |     
 178 |     <!-- Additional SEO -->
 179 |     <link rel="canonical" href="${url}" />
 180 |     ${generateStructuredDataStr('post', post)}
 181 | `;
 182 | 
 183 |   const existingOgPattern = /<meta\s+property="og:[^"]+"\s+content="[^"]*"\s*\/?>/gi;
 184 |   const existingTwitterPattern = /<meta\s+name="twitter:[^"]+"\s+content="[^"]*"\s*\/?>/gi;
 185 |   html = html.replace(existingOgPattern, '');
 186 |   html = html.replace(existingTwitterPattern, '');
 187 | 
 188 |   html = html.replace('</head>', `${ogTags}\n</head>`);
 189 | 
 190 |   return html;
 191 | }
 192 | 
```

### E18 · JSON-LD 직렬화와 수정일

`frontend/scripts/generate-static-html.js:73–105`

```text
  73 | function generateStructuredDataStr(pageType, data = {}) {
  74 |   const authorName = process.env.VITE_AUTHOR_NAME || 'nodove';
  75 | 
  76 |   if (pageType === 'post' && data) {
  77 |     const sd = {
  78 |       '@context': 'https://schema.org',
  79 |       '@type': 'BlogPosting',
  80 |       headline: data.title,
  81 |       description: data.description,
  82 |       image: resolveImageUrl(data.coverImage, data.title, data.category),
  83 |       author: {
  84 |         '@type': 'Person',
  85 |         name: authorName,
  86 |       },
  87 |       publisher: {
  88 |         '@type': 'Organization',
  89 |         name: SITE_NAME,
  90 |         logo: {
  91 |           '@type': 'ImageObject',
  92 |           url: `${BASE_URL}/nodove.ico`,
  93 |         },
  94 |       },
  95 |       datePublished: data.date,
  96 |       dateModified: data.date,
  97 |       mainEntityOfPage: {
  98 |         '@type': 'WebPage',
  99 |         '@id': `${BASE_URL}/blog/${data.year}/${data.slug}`,
 100 |       },
 101 |       keywords: Array.isArray(data.tags) ? data.tags.join(', ') : '',
 102 |       articleSection: data.category,
 103 |     };
 104 |     return `<script type="application/ld+json">${JSON.stringify(sd)}</script>`;
 105 |   }
```

### E19 · 중복 article:tag 누적

`frontend/src/hooks/seo/useSEO.ts:80–122`

```text
  80 | 
  81 |     // Update article-specific tags
  82 |     if (seoData.publishedTime) {
  83 |       updateMetaTag("article:published_time", seoData.publishedTime, true);
  84 |     }
  85 | 
  86 |     if (seoData.modifiedTime) {
  87 |       updateMetaTag("article:modified_time", seoData.modifiedTime, true);
  88 |     }
  89 | 
  90 |     if (seoData.author) {
  91 |       updateMetaTag("article:author", seoData.author, true);
  92 |     }
  93 | 
  94 |     if (seoData.section) {
  95 |       updateMetaTag("article:section", seoData.section, true);
  96 |     }
  97 | 
  98 |     if (seoData.tags) {
  99 |       seoData.tags.forEach((tag) => {
 100 |         const tagElement = document.createElement("meta");
 101 |         tagElement.setAttribute("property", "article:tag");
 102 |         tagElement.content = tag;
 103 |         document.head.appendChild(tagElement);
 104 |       });
 105 |     }
 106 | 
 107 |     // Update Structured Data (JSON-LD)
 108 |     if (structuredData) {
 109 |       let script = document.querySelector(
 110 |         'script[type="application/ld+json"]',
 111 |       ) as HTMLScriptElement;
 112 |       if (script) {
 113 |         script.textContent = JSON.stringify(structuredData);
 114 |       } else {
 115 |         script = document.createElement("script");
 116 |         script.type = "application/ld+json";
 117 |         script.textContent = JSON.stringify(structuredData);
 118 |         document.head.appendChild(script);
 119 |       }
 120 |     }
 121 |   }, [seoData, structuredData]);
 122 | };
```

### E20 · sitemap 마지막 변경일 생성 방식

`frontend/scripts/generate-seo.js:132–176`

```text
 132 | 
 133 | function generateSitemap(posts) {
 134 |   const entries = [
 135 |     {
 136 |       url: BASE_URL,
 137 |       changefreq: 'weekly',
 138 |       priority: 1.0,
 139 |       lastmod: new Date().toISOString(),
 140 |     },
 141 |     {
 142 |       url: `${BASE_URL}/blog`,
 143 |       changefreq: 'daily',
 144 |       priority: 0.9,
 145 |       lastmod: new Date().toISOString(),
 146 |     },
 147 |     {
 148 |       url: `${BASE_URL}/projects`,
 149 |       changefreq: 'weekly',
 150 |       priority: 0.85,
 151 |       lastmod: new Date().toISOString(),
 152 |     },
 153 |     {
 154 |       url: `${BASE_URL}/about`,
 155 |       changefreq: 'monthly',
 156 |       priority: 0.7,
 157 |       lastmod: new Date().toISOString(),
 158 |     },
 159 |     ...posts.map(p => ({
 160 |       url: `${BASE_URL}/blog/${p.year}/${p.slug}`,
 161 |       changefreq: 'monthly',
 162 |       priority: 0.8,
 163 |       lastmod: new Date(p.date).toISOString(),
 164 |     })),
 165 |   ];
 166 | 
 167 |   const xml =
 168 |     `<?xml version="1.0" encoding="UTF-8"?>\n` +
 169 |     `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
 170 |       .map(
 171 |         e =>
 172 |           `  <url>\n    <loc>${e.url}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
 173 |       )
 174 |       .join('\n')}\n</urlset>\n`;
 175 |   return xml;
 176 | }
```

### E10 · 이미지 저장 경로 ASCII 치환

`backend/src/services/ai-image/generated-image-storage.service.js:1–24`

```text
   1 | import crypto from 'node:crypto';
   2 | import fs from 'node:fs';
   3 | import path from 'node:path';
   4 | import fse from 'fs-extra';
   5 | import sharp from 'sharp';
   6 | import { config } from '../../config.js';
   7 | import { BadGatewayError, BadRequestError } from '../../middleware/errorHandler.js';
   8 | 
   9 | const BLOCKED_TEXT_PREFIXES = ['<svg', '<?xml', '<!doctype', '<html'];
  10 | const REMOTE_UPLOAD_PATH = '/api/v1/internal/images/generated';
  11 | const REMOTE_UPLOAD_TIMEOUT_MS = 60_000;
  12 | 
  13 | function sanitizeSegment(value) {
  14 |   return String(value || '')
  15 |     .replace(/[^a-zA-Z0-9_-]/g, '-')
  16 |     .replace(/-+/g, '-')
  17 |     .replace(/^-|-$/g, '')
  18 |     .trim();
  19 | }
  20 | 
  21 | function sanitizeSubdir(value) {
  22 |   const segment = sanitizeSegment(value || 'ai');
  23 |   return segment || 'ai';
  24 | }
```

### E08 · 큐 사용 후 동일 요청에서 결과 대기

`backend/src/services/ai/ai.service.js:192–226`

```text
 192 |   async _generateAsync(prompt, options, requestId, startTime) {
 193 |     logger.info(
 194 |       { operation: "generate", requestId, mode: "async" },
 195 |       "Enqueueing async generation",
 196 |     );
 197 | 
 198 |     let taskId;
 199 |     try {
 200 |       taskId = await this._enqueueAITask({
 201 |         type: "generate",
 202 |         payload: { prompt, options },
 203 |         priority: options.priority || "normal",
 204 |       });
 205 |     } catch (error) {
 206 |       logger.warn(
 207 |         { operation: "generate", requestId, mode: "async" },
 208 |         "Async generation enqueue failed, falling back to sync",
 209 |         { error: error.message },
 210 |       );
 211 |       return this._generateSync(prompt, options, requestId, startTime);
 212 |     }
 213 | 
 214 |     if (!taskId) {
 215 |       logger.warn(
 216 |         { operation: "generate", requestId, mode: "async" },
 217 |         "Async generation queue unavailable, falling back to sync",
 218 |       );
 219 |       return this._generateSync(prompt, options, requestId, startTime);
 220 |     }
 221 | 
 222 |     const result = await this._waitForAIResult(
 223 |       taskId,
 224 |       options.timeout || TIMEOUTS.DEFAULT,
 225 |     );
 226 | 
```

### E08 · SDK 기본 재시도 수

`backend/src/config/constants.js:736–748`

```text
 736 | /**
 737 |  * OpenAI client settings
 738 |  * @constant
 739 |  */
 740 | export const OPENAI_CLIENT = {
 741 |   /** Maximum retries for OpenAI API calls */
 742 |   MAX_RETRIES: parseIntEnv(process.env.OPENAI_MAX_RETRIES, 2),
 743 | 
 744 |   /** Query expander model */
 745 |   QUERY_EXPANDER_MODEL: process.env.QUERY_EXPANDER_MODEL || 'gpt-4.1-mini',
 746 | };
 747 | 
 748 | // ============================================================================
```
