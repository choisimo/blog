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
    devHtml: 'aiMemo.dev.html',
    devCss: 'aiMemo.dev.css',
    devJs: 'aiMemo.dev.js',
    repoUrl: 'aiMemo.repoUrl',
  };

  class AIMemoPad extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.state = {
        isOpen: !!LS.get(KEYS.isOpen, false),
        position: LS.get(KEYS.position, { x: null, y: null }),
        mode: LS.get(KEYS.mode, 'memo'),
        memo: LS.get(KEYS.memo, ''),
        apiKey: LS.get(KEYS.apiKey, ''),
        devHtml: LS.get(KEYS.devHtml, '<div>Hello AI Memo 👋</div>'),
        devCss: LS.get(
          KEYS.devCss,
          'body { font-family: system-ui, sans-serif; padding: 12px; }'
        ),
        devJs: LS.get(KEYS.devJs, 'console.log("Hello from user JS");'),
        repoUrl: LS.get(KEYS.repoUrl, ''),
      };
      this._drag = { active: false, startX: 0, startY: 0, origX: 0, origY: 0 };
      this.root = null; // shadow root container
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
      const apiKey = (this.$apiKey.value || '').trim();
      if (!apiKey) {
        this.toast('Gemini API 키를 먼저 입력하세요.');
        return;
      }

      const article = this.getArticleText();
      const memo = this.$memo.value || '';
      const limit = (s, max = 8000) =>
        s && s.length > max ? `${s.slice(0, max)}\n…(truncated)` : s;

      const prompt = [
        '다음 페이지 본문과 나의 메모를 바탕으로 핵심 요약을 작성해 주세요.',
        '',
        '[페이지 본문]',
        limit(article, 6000),
        '',
        '[나의 메모]',
        limit(memo, 2000),
        '',
        '- 한국어로 간결한 불릿 포인트 5~10개로 정리',
        '- 중요 개념/용어는 강조',
        '- 필요한 경우 간단한 예시 코드 포함',
      ].join('\n');

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const body = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      };

      const btn = this.$aiSummary;
      const prevStatus = this.$status.textContent;
      try {
        btn.disabled = true;
        this.$status.textContent = 'AI 요약 중…';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403)
            throw new Error('API 키 인증 오류');
          const t = await res.text();
          throw new Error(`요약 실패(${res.status}) ${t.slice(0, 200)}`);
        }
        const data = await res.json();
        let out = '';
        try {
          const cand = data?.candidates?.[0];
          const parts = cand?.content?.parts || [];
          out = parts.map(p => p.text || '').join('');
        } catch (_) {}
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
        user: { apiKey: (this.$apiKey?.value || '').trim() },
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
      const repo = (this.$repoUrl.value || '').trim();
      if (!repo) {
        this.toast(
          '레포지토리 URL을 입력하세요. 예: https://github.com/choisimo/blog'
        );
        return;
      }
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
            <div class="tab" data-tab="dev">개발</div>
          </div>
          <div id="memoBody" class="body">
            <div class="section">
              <label class="label" for="apiKey">Gemini API Key</label>
              <input id="apiKey" class="input" placeholder="AIza..." />
            </div>
            <div class="section">
              <label class="label" for="memo">메모</label>
              <textarea id="memo" class="textarea" placeholder="여기에 메모를 작성하세요"></textarea>
            </div>
          </div>
          <div id="devBody" class="body">
            <div class="section">
              <label class="label" for="repoUrl">GitHub 레포지토리 URL (이슈 생성용)</label>
              <input id="repoUrl" class="input" placeholder="https://github.com/choisimo/blog" />
            </div>
            <div class="code-grid">
              <div>
                <label class="label" for="devHtml">HTML</label>
                <textarea id="devHtml" class="textarea" spellcheck="false"></textarea>
              </div>
              <div>
                <label class="label" for="devCss">CSS</label>
                <textarea id="devCss" class="textarea" spellcheck="false"></textarea>
              </div>
              <div>
                <label class="label" for="devJs">JavaScript</label>
                <textarea id="devJs" class="textarea" spellcheck="false"></textarea>
              </div>
            </div>
            <div class="actions" style="margin-top:8px;">
              <button id="runPreview" class="btn">미리보기</button>
              <button id="downloadFeature" class="btn secondary">기능 다운로드</button>
              <button id="prSuggest" class="btn">PR 제안하기</button>
            </div>
            <div class="preview-wrap">
              <iframe id="preview" sandbox="allow-scripts"></iframe>
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
      this.$apiKey = this.shadowRoot.getElementById('apiKey');
      this.$repoUrl = this.shadowRoot.getElementById('repoUrl');
      this.$devHtml = this.shadowRoot.getElementById('devHtml');
      this.$devCss = this.shadowRoot.getElementById('devCss');
      this.$devJs = this.shadowRoot.getElementById('devJs');
      this.$runPreview = this.shadowRoot.getElementById('runPreview');
      this.$downloadFeature = this.shadowRoot.getElementById('downloadFeature');
      this.$prSuggest = this.shadowRoot.getElementById('prSuggest');
      this.$preview = this.shadowRoot.getElementById('preview');
      this.$status = this.shadowRoot.getElementById('status');
      this.$addSel = this.shadowRoot.getElementById('addSelection');
      this.$aiSummary = this.shadowRoot.getElementById('aiSummary');
      this.$download = this.shadowRoot.getElementById('download');
      this.$toast = this.shadowRoot.getElementById('toast');
    }

    restore() {
      // content
      this.$memo.value = this.state.memo || '';
      this.$apiKey.value = this.state.apiKey || '';

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
      this.$repoUrl.value = this.state.repoUrl || '';
      this.$devHtml.value = this.state.devHtml || '';
      this.$devCss.value = this.state.devCss || '';
      this.$devJs.value = this.state.devJs || '';

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
      };
      this.$memo.addEventListener('input', saveMemo);
      this.$memo.addEventListener('change', saveMemo);
      this.$apiKey.addEventListener('input', () => {
        this.state.apiKey = this.$apiKey.value;
        LS.set(KEYS.apiKey, this.state.apiKey);
      });
      this.$repoUrl.addEventListener('input', () => {
        this.state.repoUrl = this.$repoUrl.value;
        LS.set(KEYS.repoUrl, this.state.repoUrl);
      });
      const persistDev = () => {
        this.state.devHtml = this.$devHtml.value;
        LS.set(KEYS.devHtml, this.state.devHtml);
        this.state.devCss = this.$devCss.value;
        LS.set(KEYS.devCss, this.state.devCss);
        this.state.devJs = this.$devJs.value;
        LS.set(KEYS.devJs, this.state.devJs);
      };
      this.$devHtml.addEventListener('input', persistDev);
      this.$devCss.addEventListener('input', persistDev);
      this.$devJs.addEventListener('input', persistDev);

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

      // Dev Mode actions
      this.$runPreview.addEventListener('click', () => this.runPreview());
      this.$downloadFeature.addEventListener('click', () =>
        this.downloadFeature()
      );
      this.$prSuggest.addEventListener('click', () => this.openIssue());

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

      // keyboard: Esc to close
      window.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.$panel.classList.contains('open')) {
          this.$panel.classList.remove('open');
          this.updateOpen();
        }
        if (e.altKey && (e.key === 'm' || e.key === 'M')) {
          this.$panel.classList.toggle('open');
          this.updateOpen();
        }
      });
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
