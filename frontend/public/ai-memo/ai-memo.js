'use strict';
(() => {
  if (customElements.get('ai-memo-pad')) return;

  const LS = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch (_) {
        return fallback;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch (_) {}
    },
  };

  const KEYS = {
    isOpen: 'aiMemo.isOpen',
    position: 'aiMemo.position',
    mode: 'aiMemo.mode',
    memo: 'aiMemo.content',
    apiKey: 'aiMemo.apiKey',
    adminToken: 'aiMemo.adminToken',
    inlineEnabled: 'aiMemo.inline.enabled',
    devHtml: 'aiMemo.dev.html',
    devCss: 'aiMemo.dev.css',
    devJs: 'aiMemo.dev.js',
    proposalMd: 'aiMemo.proposalMd',
  };

  // 기본값 설정
  const DEFAULT_API_URL = 'https://blog-api.immuddelo.workers.dev';
  const DEFAULT_REPO_URL = 'https://github.com/choisimo/blog';

  class AIMemoPad extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.state = {
        isOpen: !!LS.get(KEYS.isOpen, false),
        position: LS.get(KEYS.position, { x: null, y: null }),
        mode: LS.get(KEYS.mode, 'memo'),
        memo: LS.get(KEYS.memo, ''),
        inlineEnabled: !!LS.get(KEYS.inlineEnabled, false),
        devHtml: LS.get(KEYS.devHtml, '<div>Hello AI Memo 👋</div>'),
        devCss: LS.get(
          KEYS.devCss,
          'body { font-family: system-ui, sans-serif; padding: 12px; }'
        ),
        devJs: LS.get(KEYS.devJs, 'console.log("Hello from user JS");'),
        proposalMd: LS.get(KEYS.proposalMd, ''),
      };
      this._drag = { active: false, startX: 0, startY: 0, origX: 0, origY: 0 };
      this.root = null; // shadow root container
      this._originalLoaded = false;
    }

    connectedCallback() {
      this.render();
      this.applyThemeFromPage();
      this.restore();
      this.bind();
      // If first mount and isOpen, ensure visibility
      this.updateOpen();
      this.updateMode();
    }

    applyThemeFromPage() {
      const update = () => {
        const isDark = document.documentElement.classList.contains('dark');
        this.classList.toggle('dark', isDark);
      };
      update();
      const mo = new MutationObserver(update);
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    clamp(x, y) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rect = this.$panel.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const nx = Math.max(12, Math.min(vw - w - 12, x));
      const ny = Math.max(12, Math.min(vh - h - 12, y));
      return { x: nx, y: ny };
    }

    toast(msg) {
      const t = this.$toast;
      if (!t) return;
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
    }

    getArticleText() {
      // Try common containers, fall back to body text
      const trySel = sel => document.querySelector(sel)?.innerText?.trim();
      const candidates = [
        'article',
        'main',
        'article.prose',
        '.prose',
        '#content',
      ];
      for (const sel of candidates) {
        const v = trySel(sel);
        if (v && v.length > 40) return v;
      }
      return (document.body?.innerText || '').trim();
    }

    async summarizeWithGemini() {
      const article = this.getArticleText();
      const memo = this.$memo.value || '';
      const limit = (s, max = 8000) =>
        s && s.length > max ? `${s.slice(0, max)}\n…(truncated)` : s;
      const instructions = [
        '다음 페이지 본문과 나의 메모를 바탕으로 핵심 요약을 작성해 주세요.',
        '- 한국어로 간결한 불릿 포인트 5~10개로 정리',
        '- 중요 개념/용어는 강조',
        '- 필요한 경우 간단한 예시 코드 포함',
      ].join('\n');

      const btn = this.$aiSummary;
      const prevStatus = this.$status.textContent;
      try {
        btn.disabled = true;
        this.$status.textContent = 'AI 요약 중…';
        const backend = window.__APP_CONFIG?.apiBaseUrl || window.APP_CONFIG?.apiBaseUrl || DEFAULT_API_URL;
        const endpoint = `${backend.replace(/\/$/, '')}/api/v1/ai/summarize`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: [
              '[페이지 본문]',
              limit(article, 6000),
              '',
              '[나의 메모]',
              limit(memo, 2000),
            ].join('\n'),
            instructions,
          }),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(`요약 실패(${res.status}) ${t.slice(0, 200)}`);
        }
        const data = await res.json();
        const out = (data?.data?.summary || data?.summary || '').toString();
        if (!out) throw new Error('응답 파싱 실패');

        const stamp = new Date().toLocaleString();
        const block = `\n\n[AI 요약 @ ${stamp}]\n${out.trim()}\n`;
        this.$memo.value = (this.$memo.value || '') + block;
        this.$memo.dispatchEvent(new Event('input', { bubbles: true }));
        this.toast('AI 요약이 메모에 추가되었습니다.');
        this.$status.textContent = '완료';
      } catch (err) {
        console.error('Gemini summarize error:', err);
        this.$status.textContent = '오류';
        this.toast(err?.message || '요약 중 오류가 발생했습니다.');
      } finally {
        btn.disabled = false;
        setTimeout(() => {
          this.$status.textContent = prevStatus || 'Ready';
        }, 1400);
      }
    }

    getArticleHtml() {
      const el =
        document.querySelector('article') || document.querySelector('main');
      return el ? el.outerHTML : '';
    }

    getContext() {
      return {
        article: {
          title: document.title,
          url: location.href,
          text: this.getArticleText(),
          html: this.getArticleHtml(),
        },
        memo: { content: this.$memo?.value || '' },
      };
    }

    buildSrcdoc(html, css, js, inlineRunner = false) {
      const escapeScript = s => (s || '').replace(/<\/(script)/gi, '<\\/$1');
      const runnerInline = `\n<script>\n'use strict';\n(()=>{\n  window.context = {};\n  window.addEventListener('message', (e)=>{\n    const d=e?.data; if(!d) return;\n    if(d.type==='init'&&d.context){ window.context = d.context; if(typeof window.onContextReady==='function'){ try{ window.onContextReady(); }catch(_){} } }\n  });\n})();\n<\/script>`;
      const runnerTag = inlineRunner
        ? runnerInline
        : `\n<script src="/ai-memo/runner.js"><\/script>`;
      return `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8"/>\n<style>\n${css || ''}\n</style>\n</head>\n<body>\n${html || ''}\n${runnerTag}\n<script>\ntry{\n${escapeScript(js || '')}\n}catch(e){ console.error(e); }\n<\/script>\n</body>\n</html>`;
    }

    runPreview() {
      const html = this.$devHtml.value;
      const css = this.$devCss.value;
      const js = this.$devJs.value;
      const srcdoc = this.buildSrcdoc(html, css, js, false);
      this.$preview.srcdoc = srcdoc;
      this.$status.textContent = '미리보기 갱신';
      // send context after iframe loads
      const send = () => {
        try {
          this.$preview.contentWindow.postMessage(
            { type: 'init', context: this.getContext() },
            '*'
          );
        } catch (_) {}
      };
      this.$preview.addEventListener('load', () => setTimeout(send, 30), {
        once: true,
      });
    }

    downloadFeature() {
      const html = this.$devHtml.value;
      const css = this.$devCss.value;
      const js = this.$devJs.value;
      const file = this.buildSrcdoc(html, css, js, true);
      const blob = new Blob([file], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'feature.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      this.toast('feature.html 다운로드');
    }

    openIssue() {
      const repo = DEFAULT_REPO_URL;
      const title = encodeURIComponent('Feature Proposal: AI Memo Extension');
      const bodyContent = [
        '### 설명',
        'AI 메모 개발 모드에서 제작한 기능 제안입니다. 아래 코드를 참고해 주세요.',
        '',
        '#### HTML',
        '```html',
        (this.$devHtml.value || '').slice(0, 5000),
        '```',
        '',
        '#### CSS',
        '```css',
        (this.$devCss.value || '').slice(0, 5000),
        '```',
        '',
        '#### JS',
        '```js',
        (this.$devJs.value || '').slice(0, 5000),
        '```',
        '',
        `페이지: ${location.href}`,
      ].join('\n');
      const body = encodeURIComponent(bodyContent);
      const issuesUrl = `${repo.replace(/\/?$/, '')}/issues/new?title=${title}&body=${body}`;
      window.open(issuesUrl, '_blank', 'noopener');
    }

    render() {
      const doc = document.createElement('div');
      doc.innerHTML = `
        <link rel="stylesheet" href="/ai-memo/ai-memo.css" />
        <div id="launcher" class="launcher button" title="AI Memo">📝</div>
        <div id="panel" class="panel">
          <div id="drag" class="header">
            <div class="title">떠다니는 AI 메모</div>
            <div class="spacer"></div>
            <div id="close" class="close" aria-label="닫기">✕</div>
          </div>
          <div class="tabs">
            <div class="tab" data-tab="memo">메모</div>
            <div class="tab" data-tab="dev">새 버전 제안</div>
          </div>
          <div id="memoBody" class="body">
            <div class="section">
              <label class="label" for="memo">메모</label>
              <div class="row" style="justify-content: space-between; align-items:center; margin-bottom:6px;">
                <div class="small" style="opacity:0.8">Markdown 지원 • 단축키: Alt+M 토글</div>
                <div class="row" style="gap:6px;">
                  <button id="memoBold" class="btn secondary" title="Bold"><strong>B</strong></button>
                  <button id="memoItalic" class="btn secondary" title="Italic"><em>I</em></button>
                  <button id="memoCode" class="btn secondary" title="Inline code">{}</button>
                  <button id="memoH1" class="btn secondary" title="# H1">H1</button>
                  <button id="memoH2" class="btn secondary" title="## H2">H2</button>
                  <button id="memoUl" class="btn secondary" title="• bullet list">•</button>
                  <button id="memoOl" class="btn secondary" title="1. numbered list">1.</button>
                </div>
              </div>
              <textarea id="memo" class="textarea" placeholder="여기에 메모를 작성하세요"></textarea>
              <div class="row" style="margin-top:6px; gap:6px;">
                <button id="memoFull" class="btn">전체화면</button>
                <button id="memoExportMd" class="btn secondary">Markdown 내보내기</button>
                <button id="memoExportHtml" class="btn secondary">HTML 내보내기</button>
                <button id="memoClear" class="btn secondary">지우기</button>
              </div>
            </div>

            <div class="section">
              <label class="label" for="inlineEnabled">문단 끝 ✨ 인라인 확장</label>
              <div class="row">
                <input id="inlineEnabled" type="checkbox" />
                <div class="small" style="opacity:0.8">글 본문 단락 끝에 ✨ 아이콘을 표시하고 아래로 결과를 펼칩니다.</div>
              </div>
            </div>
          </div>
          <div id="devBody" class="body">
            <div class="section">
              <div class="label">원본 글</div>
              <div id="originalPath" class="small" style="opacity:0.8"></div>
            </div>
            <div class="section">
              <label class="label" for="proposalMd">새 버전 마크다운</label>
              <textarea id="proposalMd" class="textarea" spellcheck="false" placeholder="원문을 불러오거나 이곳에 수정된 마크다운을 붙여넣으세요"></textarea>
              <div class="row" style="margin-top:8px; gap:8px;">
                <button id="loadOriginalMd" class="btn secondary">원문 불러오기</button>
                <button id="proposeNewVersion" class="btn">PR 생성 제안</button>
              </div>
              <div class="small muted" style="margin-top:6px;">
                - 원문을 불러온 후 필요한 수정을 하고 PR을 생성하세요. PR에는 원본과의 관계가 frontmatter의 derivedFrom으로 표시됩니다.
              </div>
            </div>
            <div class="section">
              <a id="prLink" class="small" target="_blank" rel="noopener" style="display:none;">PR 열기 →</a>
            </div>
          </div>
          <div class="footer">
            <div id="status" class="small">Ready</div>
            <div class="row">
              <button id="addSelection" class="btn secondary">선택 추가</button>
              <button id="aiSummary" class="btn">AI 요약</button>
              <button id="download" class="btn">메모 다운로드</button>
            </div>
          </div>
          <div id="toast" class="toast"></div>
        </div>
      `;
      this.shadowRoot.appendChild(doc);

      // cache
      this.$launcher = this.shadowRoot.getElementById('launcher');
      this.$panel = this.shadowRoot.getElementById('panel');
      this.$drag = this.shadowRoot.getElementById('drag');
      this.$close = this.shadowRoot.getElementById('close');
      this.$tabs = Array.from(this.shadowRoot.querySelectorAll('.tab'));
      this.$memoBody = this.shadowRoot.getElementById('memoBody');
      this.$devBody = this.shadowRoot.getElementById('devBody');
       this.$memo = this.shadowRoot.getElementById('memo');
       this.$inlineEnabled = this.shadowRoot.getElementById('inlineEnabled');
       this.$memoBold = this.shadowRoot.getElementById('memoBold');
       this.$memoItalic = this.shadowRoot.getElementById('memoItalic');
       this.$memoCode = this.shadowRoot.getElementById('memoCode');
       this.$memoH1 = this.shadowRoot.getElementById('memoH1');
       this.$memoH2 = this.shadowRoot.getElementById('memoH2');
       this.$memoUl = this.shadowRoot.getElementById('memoUl');
       this.$memoOl = this.shadowRoot.getElementById('memoOl');
       this.$memoFull = this.shadowRoot.getElementById('memoFull');
       this.$memoExportMd = this.shadowRoot.getElementById('memoExportMd');
       this.$memoExportHtml = this.shadowRoot.getElementById('memoExportHtml');
       this.$memoClear = this.shadowRoot.getElementById('memoClear');

      this.$originalPath = this.shadowRoot.getElementById('originalPath');
      this.$proposalMd = this.shadowRoot.getElementById('proposalMd');
      this.$loadOriginalMd = this.shadowRoot.getElementById('loadOriginalMd');
      this.$proposeNewVersion =
        this.shadowRoot.getElementById('proposeNewVersion');
      this.$prLink = this.shadowRoot.getElementById('prLink');
      this.$status = this.shadowRoot.getElementById('status');
      this.$addSel = this.shadowRoot.getElementById('addSelection');
      this.$aiSummary = this.shadowRoot.getElementById('aiSummary');
      this.$download = this.shadowRoot.getElementById('download');
      this.$toast = this.shadowRoot.getElementById('toast');
    }

    restore() {
      // content
      this.$memo.value = this.state.memo || '';
      if (this.$inlineEnabled)
        this.$inlineEnabled.checked = !!this.state.inlineEnabled;

      // panel open
      this.$panel.classList.toggle('open', !!this.state.isOpen);

      // position
      if (this.state.position.x != null && this.state.position.y != null) {
        const { x, y } = this.clamp(
          this.state.position.x,
          this.state.position.y
        );
        Object.assign(this.$panel.style, {
          left: `${x}px`,
          top: `${y}px`,
          right: 'auto',
          bottom: 'auto',
        });
      }

      // dev content
      if (this.$proposalMd)
        this.$proposalMd.value = this.state.proposalMd || '';

      // mode
      this.$tabs.forEach(t =>
        t.classList.toggle('active', t.dataset.tab === this.state.mode)
      );
      this.$memoBody.classList.toggle('active', this.state.mode === 'memo');
      this.$devBody.classList.toggle('active', this.state.mode === 'dev');
    }

    updateOpen() {
      const isOpen = this.$panel.classList.contains('open');
      LS.set(KEYS.isOpen, isOpen);
    }

    updateMode() {
      const active = this.shadowRoot.querySelector('.tab.active');
      const mode = active ? active.dataset.tab : 'memo';
      LS.set(KEYS.mode, mode);
      this.state.mode = mode;
      if (mode === 'dev') {
        this.maybeLoadOriginalMarkdown();
      }
    }

    bind() {
      // launcher
      this.$launcher.addEventListener('click', () => {
        this.$panel.classList.toggle('open');
        this.updateOpen();
      });

      // close
      this.$close.addEventListener('click', () => {
        this.$panel.classList.remove('open');
        this.updateOpen();
      });

      // tabs
      this.$tabs.forEach(tab =>
        tab.addEventListener('click', () => {
          this.$tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const mode = tab.dataset.tab;
          this.$memoBody.classList.toggle('active', mode === 'memo');
          this.$devBody.classList.toggle('active', mode === 'dev');
          this.updateMode();
        })
      );

      // input persistence
       const saveMemo = () => {
         this.state.memo = this.$memo.value;
         LS.set(KEYS.memo, this.state.memo);
         this.$status.textContent = '저장됨';
         clearTimeout(this._saveTimer);
         this._saveTimer = setTimeout(() => (this.$status.textContent = 'Ready'), 900);
       };

      this.$memo.addEventListener('input', saveMemo);
      this.$memo.addEventListener('change', saveMemo);
      if (this.$inlineEnabled) {
        const onToggleInline = () => {
          const val = !!this.$inlineEnabled.checked;
          this.state.inlineEnabled = val;
          LS.set(KEYS.inlineEnabled, val);
          this.toast(`인라인 ✨ ${val ? '켜짐' : '꺼짐'}`);
        };
        this.$inlineEnabled.addEventListener('change', onToggleInline);
        this.$inlineEnabled.addEventListener('input', onToggleInline);
      }
      if (this.$proposalMd) {
        const persistProposal = () => {
          this.state.proposalMd = this.$proposalMd.value;
          LS.set(KEYS.proposalMd, this.state.proposalMd);
        };
        this.$proposalMd.addEventListener('input', persistProposal);
        this.$proposalMd.addEventListener('change', persistProposal);
      }

       // memo toolbar helpers
       const surround = (prefix, suffix = prefix) => {
         const ta = this.$memo;
         const { selectionStart: s, selectionEnd: e, value } = ta;
         if (s == null || e == null) return;
         const before = value.slice(0, s);
         const selection = value.slice(s, e) || '텍스트';
         const after = value.slice(e);
         const next = `${before}${prefix}${selection}${suffix}${after}`;
         ta.value = next;
         ta.focus();
         const caret = (before + prefix + selection + suffix).length;
         ta.setSelectionRange(caret, caret);
         ta.dispatchEvent(new Event('input', { bubbles: true }));
       };
       const linePrefix = pfx => {
         const ta = this.$memo;
         const { selectionStart: s, selectionEnd: e, value } = ta;
         const start = value.lastIndexOf('\n', s - 1) + 1;
         const end = value.indexOf('\n', e);
         const last = end === -1 ? value.length : end;
         const body = value.slice(start, last);
         const prefix = body.startsWith(pfx + ' ') ? '' : `${pfx} `;
         const next = value.slice(0, start) + prefix + body + value.slice(last);
         ta.value = next;
         ta.focus();
         const caret = start + (prefix ? prefix.length : 0);
         ta.setSelectionRange(caret, caret);
         ta.dispatchEvent(new Event('input', { bubbles: true }));
       };
       this.$memoBold?.addEventListener('click', () => surround('**'));
       this.$memoItalic?.addEventListener('click', () => surround('*'));
       this.$memoCode?.addEventListener('click', () => surround('`'));
       this.$memoH1?.addEventListener('click', () => linePrefix('#'));
       this.$memoH2?.addEventListener('click', () => linePrefix('##'));
       this.$memoUl?.addEventListener('click', () => linePrefix('-'));
       this.$memoOl?.addEventListener('click', () => linePrefix('1.'));
       this.$memoFull?.addEventListener('click', () => {
         this.classList.toggle('memo-full');
         this.toast(this.classList.contains('memo-full') ? '전체화면' : '일반 모드');
       });
       this.$memoExportMd?.addEventListener('click', () => {
         const content = this.$memo.value || '';
         const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url; a.download = 'memo.md'; document.body.appendChild(a); a.click(); a.remove();
         URL.revokeObjectURL(url);
         this.toast('memo.md 다운로드');
       });
       this.$memoExportHtml?.addEventListener('click', () => {
         const content = (this.$memo.value || '')
           .replace(/\n/g, '<br/>')
           .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
           .replace(/\*(.*?)\*/g, '<em>$1</em>')
           .replace(/`(.*?)`/g, '<code>$1</code>');
         const html = `<!doctype html><meta charset="utf-8"/><title>Memo</title><body style="font: 14px/1.6 system-ui, sans-serif; padding: 24px; max-width: 760px; margin: auto;">${content}</body>`;
         const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url; a.download = 'memo.html'; document.body.appendChild(a); a.click(); a.remove();
         URL.revokeObjectURL(url);
         this.toast('memo.html 다운로드');
       });
       this.$memoClear?.addEventListener('click', () => {
         if (confirm('메모를 모두 지울까요?')) {
           this.$memo.value = '';
           this.$memo.dispatchEvent(new Event('input', { bubbles: true }));
         }
       });

       // selection add
       this.$addSel.addEventListener('click', () => {

        const sel = window.getSelection();
        const text = sel && sel.toString().trim();
        if (!text) {
          this.toast('선택된 텍스트가 없습니다.');
          return;
        }
        const now = new Date();
        const entry = `\n> ${text}\n— ${now.toLocaleString()}`;
        this.$memo.value = `${(this.$memo.value || '') + entry}\n`;
        this.$memo.dispatchEvent(new Event('input', { bubbles: true }));
        this.toast('선택 내용을 추가했습니다.');
      });

      // download memo
      this.$download.addEventListener('click', () => {
        const content = this.$memo.value || '';
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'memo.txt';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.toast('memo.txt 다운로드');
      });

      // AI summary
      this.$aiSummary.addEventListener('click', () =>
        this.summarizeWithGemini()
      );

      // Proposal actions
      if (this.$loadOriginalMd)
        this.$loadOriginalMd.addEventListener('click', () =>
          this.maybeLoadOriginalMarkdown(true)
        );
      if (this.$proposeNewVersion)
        this.$proposeNewVersion.addEventListener('click', () =>
          this.proposeNewVersion()
        );

      // drag move
      const onPointerMove = e => {
        if (!this._drag.active) return;
        const dx = e.clientX - this._drag.startX;
        const dy = e.clientY - this._drag.startY;
        const { x, y } = this.clamp(
          this._drag.origX + dx,
          this._drag.origY + dy
        );
        Object.assign(this.$panel.style, {
          left: `${x}px`,
          top: `${y}px`,
          right: 'auto',
          bottom: 'auto',
        });
      };
      const onPointerUp = e => {
        if (!this._drag.active) return;
        this._drag.active = false;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        // persist position
        const rect = this.$panel.getBoundingClientRect();
        LS.set(KEYS.position, { x: rect.left, y: rect.top });
      };
      this.$drag.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        const rect = this.$panel.getBoundingClientRect();
        this._drag = {
          active: true,
          startX: e.clientX,
          startY: e.clientY,
          origX: rect.left,
          origY: rect.top,
        };
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
      });

      // viewport clamp on resize
      window.addEventListener('resize', () => {
        const rect = this.$panel.getBoundingClientRect();
        const { x, y } = this.clamp(rect.left, rect.top);
        Object.assign(this.$panel.style, {
          left: `${x}px`,
          top: `${y}px`,
          right: 'auto',
          bottom: 'auto',
        });
        LS.set(KEYS.position, { x, y });
      });

       // keyboard: Esc to close + editor shortcuts
       window.addEventListener('keydown', e => {
         if (e.key === 'Escape' && this.$panel.classList.contains('open')) {
           this.$panel.classList.remove('open');
           this.updateOpen();
         }
         if (e.altKey && (e.key === 'm' || e.key === 'M')) {
           this.$panel.classList.toggle('open');
           this.updateOpen();
         }
         // common editor shortcuts when panel open
         if (this.$panel.classList.contains('open') && document.activeElement === this.$memo) {
           const meta = e.metaKey || e.ctrlKey;
           if (meta && e.key.toLowerCase() === 'b') { e.preventDefault(); surround('**'); }
           if (meta && e.key.toLowerCase() === 'i') { e.preventDefault(); surround('*'); }
           if (meta && e.key === '`') { e.preventDefault(); surround('`'); }
         }
       });

       // indent/outdent with Tab/Shift+Tab inside memo
       this.$memo.addEventListener('keydown', e => {
         if (e.key === 'Tab') {
           e.preventDefault();
           const ta = this.$memo;
           const { selectionStart: s, selectionEnd: epos, value } = ta;
           if (e.shiftKey) {
             // outdent: remove leading two spaces or one dash
             const start = value.lastIndexOf('\n', s - 1) + 1;
             const line = value.slice(start, epos);
             let removed = 0;
             let newLine = line;
             if (newLine.startsWith('  ')) { newLine = newLine.slice(2); removed = 2; }
             else if (newLine.startsWith('- ')) { newLine = newLine.slice(2); removed = 2; }
             else if (newLine.startsWith('1. ')) { newLine = newLine.slice(3); removed = 3; }
             const next = value.slice(0, start) + newLine + value.slice(epos);
             ta.value = next;
             const ns = Math.max(s - removed, start);
             ta.setSelectionRange(ns, ns);
           } else {
             const before = value.slice(0, s);
             const after = value.slice(epos);
             ta.value = before + '  ' + after;
             const ns = s + 2;
             ta.setSelectionRange(ns, ns);
           }
           ta.dispatchEvent(new Event('input', { bubbles: true }));
         }
       });

    }

    getCurrentPostInfo() {
      // Supports routes: #/blog/:year/:slug and /blog/:year/:slug (or 'post')
      const fromHash = () => {
        const h = (location.hash || '').replace(/^#/, '');
        const m = h.match(/^\/?(blog|post)\/(\d{4})\/([^\/?#]+)/);
        if (m) return { type: m[1], year: m[2], slug: m[3] };
        return null;
      };
      const fromPath = () => {
        const p = location.pathname || '';
        const m = p.match(/^\/?(blog|post)\/(\d{4})\/([^\/?#]+)/);
        if (m) return { type: m[1], year: m[2], slug: m[3] };
        return null;
      };
      return fromHash() || fromPath();
    }

    buildOriginalMarkdownPath(info) {
      if (!info) return null;
      const { year, slug } = info;
      return `/posts/${year}/${slug}.md`;
    }

    async maybeLoadOriginalMarkdown(force = false) {
      try {
        const info = this.getCurrentPostInfo();
        if (!info) {
          if (this.$originalPath)
            this.$originalPath.textContent =
              '현재 페이지가 블로그 글 상세가 아닙니다.';
          return;
        }
        const mdPath = this.buildOriginalMarkdownPath(info);
        if (this.$originalPath) this.$originalPath.textContent = `${mdPath}`;

        if (this._originalLoaded && !force) return;

        const origin = location.origin;
        const url = `${origin}${mdPath}`;
        if (this.$status) this.$status.textContent = '원문 불러오는 중…';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`원문 로드 실패(${res.status})`);
        const text = await res.text();
        if (this.$proposalMd) {
          if (force || !this.$proposalMd.value) {
            this.$proposalMd.value = text;
            this.state.proposalMd = text;
            LS.set(KEYS.proposalMd, text);
            this.toast(
              '원문을 불러왔습니다. 내용을 편집한 뒤 PR을 생성하세요.'
            );
          }
        }
        this._originalLoaded = true;
        if (this.$status) this.$status.textContent = 'Ready';
      } catch (err) {
        console.error('maybeLoadOriginalMarkdown error:', err);
        if (this.$status) this.$status.textContent = '오류';
        this.toast(err?.message || '원문을 불러오지 못했습니다.');
      }
    }

    async proposeNewVersion() {
      try {
        const backend = window.__APP_CONFIG?.apiBaseUrl || window.APP_CONFIG?.apiBaseUrl || DEFAULT_API_URL;
        const info = this.getCurrentPostInfo();
        if (!info) {
          this.toast('현재 페이지에서 글 정보를 찾을 수 없습니다.');
          return;
        }
        const md = (this.$proposalMd?.value || '').trim();
        if (!md) {
          this.toast('제안할 마크다운이 비어 있습니다.');
          return;
        }

        const mdPath = this.buildOriginalMarkdownPath(info);
        const endpoint = `${backend.replace(/\/$/, '')}/api/v1/admin/propose-new-version`;

        const payload = {
          original: {
            year: info.year,
            slug: info.slug,
            path: mdPath,
            url: `${location.origin}/#/blog/${info.year}/${info.slug}`,
          },
          markdown: md,
          sourcePage: location.href,
        };

        if (this.$proposeNewVersion) this.$proposeNewVersion.disabled = true;
        const prev = this.$status?.textContent || '';
        if (this.$status) this.$status.textContent = 'PR 생성 요청 중…';
        const adminToken = LS.get(KEYS.adminToken, '');
        const headers = { 'Content-Type': 'application/json' };
        if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(`요청 실패(${res.status}) ${t.slice(0, 200)}`);
        }
        const data = await res.json().catch(() => ({}));
        const prUrl = data.prUrl || data.url || data.html_url;
        if (prUrl && this.$prLink) {
          this.$prLink.href = prUrl;
          this.$prLink.style.display = '';
        }
        this.toast(prUrl ? 'PR이 생성되었습니다.' : '요청이 완료되었습니다.');
        if (this.$status) this.$status.textContent = '완료';
        setTimeout(() => {
          if (this.$status) this.$status.textContent = prev || 'Ready';
        }, 1400);
      } catch (err) {
        console.error('proposeNewVersion error:', err);
        if (this.$status) this.$status.textContent = '오류';
        this.toast(err?.message || 'PR 생성 요청에 실패했습니다.');
      } finally {
        if (this.$proposeNewVersion) this.$proposeNewVersion.disabled = false;
      }
    }
  }

  customElements.define('ai-memo-pad', AIMemoPad);

  // Ensure single instance mounted
  const mountOnce = () => {
    if (document.body && !document.querySelector('ai-memo-pad')) {
      const el = document.createElement('ai-memo-pad');
      document.body.appendChild(el);
    }
  };
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', mountOnce);
  else mountOnce();
})();
