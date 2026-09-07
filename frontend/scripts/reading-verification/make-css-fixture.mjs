/**
 * Isolated CSS fixture, NOT the running React application.
 * Uses the repository's stylesheet cascade. Tailwind @apply/utility generation and Radix
 * runtime behavior are intentionally not simulated; run test:e2e:reading for those checks.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frontendRoot } from './loader.mjs';

function expand(path) {
  return readFileSync(path, 'utf8').replace(/@import\s+["']([^"']+)["'];/g, (_, target) =>
    target.startsWith('.') ? expand(resolve(dirname(path), target)) : '');
}
const css = expand(fileURLToPath(new URL('src/index.css', frontendRoot)));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600"><rect width="1200" height="600" fill="#eaf0f8"/><path d="M0 360 Q300 170 600 320 T1200 160" fill="none" stroke="#d0daea" stroke-width="2"/><g fill="#fff" stroke="#2456bc" stroke-width="2"><rect x="110" y="210" width="250" height="140" rx="16"/><rect x="475" y="210" width="250" height="140" rx="16"/><rect x="840" y="210" width="250" height="140" rx="16"/></g><g stroke="#2456bc" stroke-width="3"><path d="M360 280H475M725 280H840"/></g><g font-family="sans-serif" text-anchor="middle" fill="#2456bc"><text x="235" y="290" font-size="28">INPUT</text><text x="600" y="290" font-size="28">VERIFY</text><text x="965" y="290" font-size="28">PUBLISH</text><text x="600" y="450" font-size="18" letter-spacing="5">PRESERVE WHAT ALREADY WORKS</text></g></svg>`;
const wide = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const tall = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1200"><rect width="600" height="1200" fill="#edf3ff"/><g fill="#2456bc"><rect x="70" y="70" width="460" height="300" rx="16"/><rect x="70" y="450" width="460" height="300" rx="16"/><rect x="70" y="830" width="460" height="300" rx="16"/></g></svg>').toString('base64')}`;
const paragraph = '읽는 동안 문장의 시작점이 흔들리지 않도록 제목과 본문을 같은 축에 놓았습니다. 이미지와 표는 필요한 공간을 확보하되, 긴 코드 한 줄 때문에 페이지 전체가 옆으로 밀려나지 않도록 각 영역의 경계를 구분합니다.';
const buttons = '<button aria-label="축소">−</button><button aria-label="확대">＋</button><button aria-label="회전">↻</button><button aria-label="초기화">↔</button><button aria-label="닫기">×</button>';
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reading CSS fixture — isolated validation</title><style>
@layer base { *,*::before,*::after { box-sizing:border-box; } body { margin:0; } button,a,input { font:inherit; } button { color:inherit; cursor:pointer; } img { display:block; } }
${css}
/* Fixture-only scaffolding supplies DOM geometry normally provided by application utilities. */
.fixture-header { height:64px; display:flex; align-items:center; justify-content:space-between; padding:0 var(--ui-page-gutter); border-bottom:1px solid hsl(var(--ui-line)); color:hsl(var(--ui-text)); font:600 14px var(--ui-font); background:hsl(var(--ui-surface)); }
.fixture-note { color:hsl(var(--ui-muted)); font:400 12px var(--ui-font); }
.fixture-toc-viewport { overflow:auto; height:100%; }
.article-code-region { overflow-x:auto; }
.article-code-toolbar button { border:0; }
.article-table-toolbar { display:flex; align-items:center; justify-content:space-between; padding:8px 14px; border-bottom:1px solid hsl(var(--ui-line)); font-size:12px; }
.article-table-toolbar button { background:none; border:0; color:inherit; }
.fixture-hidden { display:none !important; }
.fixture-modal { position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:100; }
.fixture-overlay { position:fixed; inset:0; background:#000b; z-index:99; }
.fixture-portrait { display:none; }
</style></head><body>
<header class="fixture-header"><span>nodove <span class="fixture-note">/ Journal</span></span><span class="fixture-note">CSS 검증용 화면</span></header>
<main class="ui-page ui-article-page"><div class="ui-article-container"><div class="ui-article-layout"><article class="ui-article">
<header class="ui-article-header"><nav class="ui-article-header__navigation fixture-note">← 모든 글 <span>Engineering / Reading</span></nav>
<div class="ui-article-header__intro"><div class="ui-article-header__copy"><span class="ui-article-category">DESIGN & ENGINEERING</span><h1 class="ui-article-title">읽기의 흐름을 방해하지 않는<br>인터페이스를 만들기</h1><div class="ui-article-description"><p>본문, 이미지, 표와 코드가 각각 필요한 공간을 가지도록.<br>레이아웃과 스크롤의 경계를 다시 살펴봅니다.</p></div><div class="ui-article-meta"><span class="ui-article-meta__item">nodove</span><span class="ui-article-meta__item">2026.09.08</span><span class="ui-article-meta__item">8분 읽기</span></div></div></div></header>
<section class="ui-article-body" data-reading-content><div class="article-flow prose"><p>${paragraph}</p><h2 class="article-heading">내용을 먼저, 장식은 그다음에</h2><p>${paragraph}</p>
<figure class="article-media-frame" data-layout="wide"><div class="article-media-surface"><button class="article-image-trigger" data-state="ready" aria-label="확대 보기"><img class="article-image" width="1200" height="600" src="${wide}" alt="입력에서 검증을 거쳐 반영하는 구조"><span class="article-image-affordance">＋ 확대 보기</span></button></div><figcaption class="article-media-caption">이미지를 누르면 원본을 확인할 수 있습니다. 캡션은 이미지 영역과 분리해 읽기 흐름을 유지합니다.</figcaption></figure>
<h2 class="article-heading">페이지가 아니라, 필요한 영역만 스크롤</h2><p>${paragraph}</p>
<div class="article-table-shell"><div class="article-table-toolbar"><span>표 · 처리 상태 비교</span><button>복사</button></div><div class="article-table-scroll ui-scroll-region" tabindex="0"><table><thead><tr>${['처리 대상','이전 상태','변경 요청','검증 조건','확정 결과','남겨야 하는 기록'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody><tr>${['본문','불규칙한 폭','읽기 폭 통일','모바일 넘침 없음','일관된 시작점','기존 문서 구조'].map(x=>`<td>${x}</td>`).join('')}</tr><tr>${['이미지','고정 비율','원본 비율 유지','실패 시 재시도','자료 가독성','대체 텍스트와 캡션'].map(x=>`<td>${x}</td>`).join('')}</tr></tbody></table></div><div class="article-table-hint">좌우로 스크롤하면 표의 나머지 열을 볼 수 있습니다.</div></div>
<div class="article-code-card" data-wrapped="false"><div class="article-code-toolbar"><span class="article-code-toolbar__label">typescript</span><div class="article-code-toolbar__actions"><button>↵</button><button>⧉</button></div></div><div class="article-code-region ui-scroll-region" tabindex="0"><pre class="article-code-highlighter" style="padding:20px;margin:0;color:#e2e8f0;font-size:14px;line-height:1.75"><code>const source = 'https://example.invalid/content/reading-layout/keep-the-original-structure-and-preserve-every-existing-contract/without-moving-the-entire-page';\nconst result = await verify(source);\npublish(result);</code></pre></div></div>
<figure class="article-media-frame fixture-portrait"><div class="article-media-surface"><button class="article-image-trigger" data-state="ready"><img class="article-image" src="${tall}" alt="세로 검증 이미지"></button></div></figure>
<h2 class="article-heading">마지막까지 같은 읽기 경험</h2><p>${paragraph}</p></div></section></article>
<aside class="ui-article-toc"><div class="ui-toc-panel"><div class="ui-toc-body ui-toc-scroll-boundary"><h3 class="ui-toc-heading">목차 <span class="ui-toc-count">12</span></h3><div class="ui-toc-scroll"><div class="fixture-toc-viewport" data-radix-scroll-area-viewport tabindex="0"><nav class="ui-toc-list">${['내용을 먼저, 장식은 그다음에','이미지에 필요한 공간','필요한 영역만 스크롤','읽기 폭과 문장 간격','코드와 표의 역할','키보드로 이미지 보기','실패한 이미지 복구','모바일의 터치 영역','다크·터미널 테마','본문 진행률','변경 전 결과 보존','마지막까지 같은 읽기 경험'].map((x,i)=>`<button class="ui-toc-item" ${i===0?'aria-current="location"':''}>${x}</button>`).join('')}</nav></div></div></div></div></aside>
</div></div></main>
<div id="overlay" class="fixture-overlay fixture-hidden"></div><div id="viewer" class="ui-dialog-content ui-image-viewer fixture-modal fixture-hidden" role="dialog" aria-label="이미지 보기"><div class="ui-image-viewer__layout"><div class="ui-image-viewer__header"><div class="ui-image-viewer__heading"><h2 class="ui-image-viewer__title">검증 후 반영하는 구조</h2><p class="ui-image-viewer__description">스크롤·두 손가락으로 확대, 드래그로 이동 · Esc 닫기</p></div><div class="ui-image-viewer__tools">${buttons}</div></div><div class="ui-image-viewer__canvas" tabindex="0"><img class="ui-image-viewer__image" data-state="ready" src="${wide}" alt="구조 이미지"></div><div class="ui-image-viewer__footer"><p class="ui-image-viewer__caption">이미지, 도구, 캡션은 서로 겹치지 않습니다.</p><output class="ui-image-viewer__scale">100%</output><a class="ui-image-viewer__original" href="#">원본 ↗</a></div></div></div>
</body></html>`;
const output = resolve(process.argv[2] || 'reading-css-fixture.html');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html);
console.log(output);
