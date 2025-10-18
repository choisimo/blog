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
    fontSize: 'aiMemo.fontSize',
    events: 'aiMemo.events'
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
        fontSize: LS.get(KEYS.fontSize, 13),
        events: LS.get(KEYS.events, [])
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
        this.logEvent({ type: 'ai_summary_done', label: 'ok' });
      } catch (err) {
        console.error('Gemini summarize error:', err);
        this.$status.textContent = '오류';
        this.toast(err?.message || '요약 중 오류가 발생했습니다.');
        this.logEvent({ type: 'ai_summary_error', label: err?.message || 'error' });
      } finally {
        btn.disabled = false;
        setTimeout(() => {
          this.$status.textContent = prevStatus || 'Ready';
        }, 1400);
      }
    }

    async runCatalyst(promptText) {
      const prompt = (promptText || this.$catalystInput?.value || '').trim();
      if (!prompt) { this.toast('Catalyst 프롬프트를 입력하세요.'); return; }
      const article = this.getArticleText();
      const memo = this.$memo.value || '';
      const limit = (s, max = 8000) => s && s.length > max ? `${s.slice(0, max)}\n…(truncated)` : s;
      const instructions = [
        '사용자 프롬프트를 "촉매"로 사용해 글의 새로운 관점을 제시하세요.',
        '- 한국어로 작성하고, 구조적인 소제목과 간결한 문장을 사용',
        '- 필요 시 불릿 목록, 표, 간단한 코드 예시를 포함',
        `- 사용자 프롬프트: "${prompt.replace(/` + "`" + `/g, '\\`')}"`
      ].join('\n');

       const btn = this.$catalystRun || this.$catalystBtn; const inputEl = this.$catalystInput;
      const prev = this.$status.textContent;
      try {
         if (btn) btn.disabled = true;
         if (inputEl) inputEl.disabled = true;
         this.$status.textContent = 'Catalyst 생성 중…';
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
              '[현재 메모]',
              limit(memo, 2000),
            ].join('\n'),
            instructions,
          }),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(`Catalyst 실패(${res.status}) ${t.slice(0, 200)}`);
        }
        const data = await res.json();
        const out = (data?.data?.summary || data?.summary || '').toString();
        if (!out) throw new Error('응답 파싱 실패');

        const stamp = new Date().toLocaleString();
        const block = `\n\n## ${prompt}\n[위 관점 @ ${stamp}]\n${out.trim()}\n`;
        this.$memo.value = (this.$memo.value || '') + block;
        if (this.$memoEditor) this.$memoEditor.value = this.$memo.value;
        if (this.$memoPreview) this.renderMarkdownToPreview(this.$memo.value);
        this.$memo.dispatchEvent(new Event('input', { bubbles: true }));
        this.toast('Catalyst 결과가 메모에 추가되었습니다.');
        this.logEvent({ type: 'catalyst_run', label: prompt });
         if (this.$catalystInput) this.$catalystInput.value = '';
         if (this.$catalystBox) this.$catalystBox.style.display = 'none';
         if (this.$catalystInput) this.$catalystInput.disabled = false;
        this.$status.textContent = '완료';
      } catch (err) {
        console.error('Catalyst error:', err);
        this.$status.textContent = '오류';
        this.toast(err?.message || 'Catalyst 생성 중 오류가 발생했습니다.');
      } finally {
         if (btn) btn.disabled = false;
         if (inputEl) inputEl.disabled = false;
         setTimeout(() => { this.$status.textContent = prev || 'Ready'; }, 1400);
      }
    }

    applyFontSize(size) {
      const fs = Math.max(10, Math.min(20, parseInt(size || 13, 10)));
      const root = this.shadowRoot;
      if (!root) return;
      const targets = [this.$memo, this.$memoEditor, this.$memoPreview];
      targets.forEach(t => {
        if (!t) return;
        t.style.fontSize = `${fs}px`;
        if (t.tagName === 'TEXTAREA') t.style.lineHeight = '1.6';
      });
    }

    // Convert Markdown to sanitized HTML string
    markdownToHtml(src) {
      let s = String(src || '');

      // escape HTML
      s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      // collect tokens for code to avoid further markdown transforms inside
      const tokens = [];
      const tokenize = html => {
        tokens.push(html);
        return `@@TOKEN${tokens.length - 1}@@`;
      };

      // fenced code blocks ```lang\n...\n```
      s = s.replace(/```([\w-]*)\n([\s\S]*?)```/g, (m, lang, code) => {
        const c = code.replace(/\n$/, '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
        return tokenize(`<pre><code class="lang-${lang || 'text'}">${c}</code></pre>`);
      });

      // inline code `...`
      s = s.replace(/`([^`]+)`/g, (m, code) => {
        const c = code.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        return tokenize(`<code>${c}</code>`);
      });

      // headings
      s = s.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>')
           .replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>')
           .replace(/^####\s+(.*)$/gm, '<h4>$1</h4>')
           .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
           .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
           .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');

      // url sanitizer
      const sanitizeUrl = (url) => {
        try {
          const raw = (url || '').trim();
          if (!raw) return '#';
          // allow only http(s), mailto, tel; support relative links
          const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw);
          const u = hasScheme ? new URL(raw) : new URL(raw, location.href);
          const p = u.protocol.toLowerCase();
          if (p === 'http:' || p === 'https:' || p === 'mailto:' || p === 'tel:') return u.href;
          return '#';
        } catch (_) {
          return '#';
        }
      };

      // images ![alt](url)
      s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, url) => {
        const safe = sanitizeUrl(url);
        const a = String(alt || '').replace(/"/g, '&quot;');
        return `<img alt="${a}" src="${safe}" loading="lazy" referrerpolicy="no-referrer" />`;
      });

      // links [text](url)
      s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, url) => {
        const safe = sanitizeUrl(url);
        return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      });

      // bold/italic (naive)
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
           .replace(/\*([^*]+)\*/g, '<em>$1</em>');

      // lists
      s = s.replace(/^(?:- |\* )(.*)$/gm, '<li>$1</li>');
      s = s.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
      // ordered lists
      s = s.replace(/^\d+\. (.*)$/gm, '<li>$1</li>');
      s = s.replace(/(<li>.*<\/li>\n?)+/g, m => m.includes('<ul>') ? m : `<ol>${m}</ol>`);

      // blockquotes
      s = s.replace(/^>\s?(.*)$/gm, '<blockquote>$1<\/blockquote>');

      // paragraphs (split by double newlines)
      s = s.split(/\n{2,}/).map(block => {
        if (/^<h\d|<pre|<ul>|<ol>|<blockquote>|<img|<p>|<a /.test(block.trim())) return block;
        return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
      }).join('\n');

      // restore tokens
      s = s.replace(/@@TOKEN(\d+)@@/g, (m, i) => tokens[+i] || '');

      return s;
    }

    // Enhance <pre><code> blocks: add line numbers and simple syntax colors
    enhanceCodeBlocks() {
      if (!this.$memoPreview) return;
      const blocks = this.$memoPreview.querySelectorAll('pre > code');
      blocks.forEach(codeEl => {
        const cls = codeEl.className || '';
        const m = cls.match(/lang-([\w-]+)/);
        const lang = (m && m[1] || 'text').toLowerCase();
        const raw = codeEl.textContent || '';
        const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

        const highlightLine = (line) => {
          let out = escapeHtml(line);
          const apply = (regex, wrap) => {
            out = out.replace(regex, wrap);
          };

          const word = (list) => new RegExp(`\\b(?:${list.join('|')})\\b`, 'g');
          const fnName = /\b([A-Za-z_][A-Za-z0-9_]*)\s*(?=\()/g;

          if (lang === 'js' || lang === 'ts' || lang === 'javascript' || lang === 'typescript' || lang === 'c' || lang === 'cpp' || lang === 'java') {
            // split comment part
            const idx = out.indexOf('//');
            let head = idx >= 0 ? out.slice(0, idx) : out;
            let tail = idx >= 0 ? out.slice(idx) : '';
            // strings
            head = head
              .replace(/"([^"\\]|\\.)*"/g, '<span class="str">$&</span>')
              .replace(/'([^'\\]|\\.)*'/g, '<span class="str">$&</span>')
              .replace(/`([^`\\]|\\.)*`/g, '<span class="str">$&</span>');
            // numbers
            head = head.replace(/\b\d+(?:\.\d+)?\b/g, '<span class="num">$&</span>');
            // keywords
            const kws = word(['const','let','var','function','return','if','else','for','while','do','switch','case','break','continue','class','extends','new','try','catch','finally','throw','await','async','yield','import','from','export','default','in','of','this','super','true','false','null','undefined']);
            head = head.replace(kws, '<span class="kw">$&</span>');
            // function names
            head = head.replace(fnName, (m, g1) => `<span class="fn">${g1}</span>`);
            if (tail) tail = `<span class="cm">${tail}</span>`;
            out = head + tail;
          } else if (lang === 'py' || lang === 'python') {
            const hash = out.indexOf('#');
            let head = hash >= 0 ? out.slice(0, hash) : out;
            let tail = hash >= 0 ? out.slice(hash) : '';
            head = head
              .replace(/"([^"\\]|\\.)*"/g, '<span class="str">$&</span>')
              .replace(/'([^'\\]|\\.)*'/g, '<span class="str">$&</span>');
            head = head.replace(/\b\d+(?:\.\d+)?\b/g, '<span class="num">$&</span>');
            const kws = word(['def','return','if','elif','else','for','while','try','except','finally','with','as','class','import','from','pass','break','continue','True','False','None','in','is','not','and','or','lambda','yield']);
            head = head.replace(kws, '<span class="kw">$&</span>');
            head = head.replace(fnName, (m, g1) => `<span class="fn">${g1}</span>`);
            if (tail) tail = `<span class="cm">${tail}</span>`;
            out = head + tail;
          } else if (lang === 'json') {
            out = out
              .replace(/"([^"\\]|\\.)*"(?=\s*:)/g, '<span class="kw">$&</span>')
              .replace(/"([^"\\]|\\.)*"/g, '<span class="str">$&</span>')
              .replace(/\b\d+(?:\.\d+)?\b/g, '<span class="num">$&</span>')
              .replace(/\b(true|false|null)\b/g, '<span class="kw">$1</span>');
          } else if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
            const hash = out.indexOf('#');
            let head = hash >= 0 ? out.slice(0, hash) : out;
            let tail = hash >= 0 ? out.slice(hash) : '';
            head = head.replace(/"([^"\\]|\\.)*"/g, '<span class="str">$&</span>').replace(/'([^'\\]|\\.)*'/g, '<span class="str">$&</span>');
            const kws = word(['if','then','fi','for','do','done','case','esac','function','in','elif','else','return','local','export']);
            head = head.replace(kws, '<span class="kw">$&</span>');
            if (tail) tail = `<span class="cm">${tail}</span>`;
            out = head + tail;
          }
          return out;
        };

        const lines = raw.split('\n');
        const html = lines.map(l => `<span class="line">${highlightLine(l)}</span>`).join('\n');
        codeEl.innerHTML = html;
      });
    }

    // Render preview and enhance code blocks
    renderMarkdownToPreview(src) {
      if (!this.$memoPreview) return;
      const html = this.markdownToHtml(src);
      this.$memoPreview.innerHTML = html;
      this.enhanceCodeBlocks();
    }


    // debounce preview rendering to keep typing smooth
    scheduleRenderPreview(src) {
      clearTimeout(this._renderTimer);
      this._renderTimer = setTimeout(() => this.renderMarkdownToPreview(src), 100);
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
      const html = this.$devHtml?.value || '';
      const css = this.$devCss?.value || '';
      const js = this.$devJs?.value || '';
      if (!this.$preview) return;
      const srcdoc = this.buildSrcdoc(html, css, js, false);
      this.$preview.srcdoc = srcdoc;
      this.$status.textContent = '미리보기 갱신';
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
        <div id="historyLauncher" class="launcher history button" title="History">📖</div>
        <div id="historyOverlay" class="history-overlay" style="display:none;">
          <div class="history-toolbar">
            <div class="left">
              <strong>Web of Curiosity</strong>
              <span class="small" style="margin-left:8px; opacity:0.8;">Scroll: zoom • Drag: pan • Click: center • Double-click post: open</span>
            </div>
            <div class="right">
              <button id="historyExport" class="btn secondary">내보내기</button>
              <button id="historyImport" class="btn secondary">가져오기</button>
              <button id="historyReset" class="btn secondary">초기화</button>
              <button id="historyClose" class="btn">닫기</button>
            </div>
          </div>
          <canvas id="historyCanvas"></canvas>
        </div>
        <div id="panel" class="panel">
          <div id="drag" class="header">
            <div class="title">떠다니는 AI 메모</div>
            <div class="spacer"></div>
            <div id="close" class="close" aria-label="닫기">✕</div>
          </div>
          <div class="tabs">
            <div class="tab" data-tab="memo">메모</div>
            <div class="tab" data-tab="preview">미리보기</div>
            <div class="tab" data-tab="dev">새 버전 제안</div>
            <div class="tab" data-tab="settings">설정</div>
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
                <button id="memoClear" class="btn secondary">지우기</button>
              </div>
            </div>
          </div>

          <div id="previewBody" class="body">
            <div class="split">
              <div class="split-left">
                <label class="label" for="memo">편집기</label>
                <textarea id="memoEditor" class="textarea" placeholder="여기에 메모를 작성하세요"></textarea>
              </div>
              <div class="split-right">
                <label class="label">미리보기</label>
                <div id="memoPreview" class="preview-md"></div>
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

          <div id="settingsBody" class="body">
            <div class="section">
              <label class="label" for="inlineEnabled">문단 끝 ✨ 인라인 확장</label>
              <div class="row">
                <input id="inlineEnabled" type="checkbox" />
                <div class="small" style="opacity:0.8">글 본문 단락 끝에 ✨ 아이콘을 표시하고 아래로 결과를 펼칩니다.</div>
              </div>
            </div>
            <div class="section">
              <label class="label" for="fontSize">폰트 크기</label>
              <select id="fontSize" class="input">
                <option value="12">12</option>
                <option value="13" selected>13</option>
                <option value="14">14</option>
                <option value="16">16</option>
              </select>
            </div>
          </div>
          <div id="catalystBox" class="row" style="display:none; padding: 8px 12px 0 12px; gap:6px;">
             <input id="catalystInput" class="input" placeholder="어떻게 확장해볼까요? 예: 사용 사례 관점에서 다시 보기" maxlength="160" />
            <button id="catalystRun" class="btn">생성</button>
            <button id="catalystCancel" class="btn secondary">취소</button>
          </div>
          <div class="footer">
            <div id="status" class="small">Ready</div>
            <div class="row">
              <button id="addSelection" class="btn secondary">선택 추가</button>
              <button id="aiSummary" class="btn">AI 요약</button>
              <button id="catalyst" class="btn">Catalyst ✨</button>
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
      this.$historyLauncher = this.shadowRoot.getElementById('historyLauncher');
      this.$historyOverlay = this.shadowRoot.getElementById('historyOverlay');
      this.$historyCanvas = this.shadowRoot.getElementById('historyCanvas');
      this.$historyClose = this.shadowRoot.getElementById('historyClose');
      this.$historyReset = this.shadowRoot.getElementById('historyReset');
      this.$historyExport = this.shadowRoot.getElementById('historyExport');
      this.$historyImport = this.shadowRoot.getElementById('historyImport');
      this.$drag = this.shadowRoot.getElementById('drag');
      this.$close = this.shadowRoot.getElementById('close');
      this.$tabs = Array.from(this.shadowRoot.querySelectorAll('.tab'));
      this.$memoBody = this.shadowRoot.getElementById('memoBody');
      this.$previewBody = this.shadowRoot.getElementById('previewBody');
      this.$devBody = this.shadowRoot.getElementById('devBody');
      this.$settingsBody = this.shadowRoot.getElementById('settingsBody');
      this.$memo = this.shadowRoot.getElementById('memo');
      this.$memoEditor = this.shadowRoot.getElementById('memoEditor');
      this.$memoPreview = this.shadowRoot.getElementById('memoPreview');
      this.$fontSize = this.shadowRoot.getElementById('fontSize');
      this.$inlineEnabled = this.shadowRoot.getElementById('inlineEnabled');
      this.$memoBold = this.shadowRoot.getElementById('memoBold');
      this.$memoItalic = this.shadowRoot.getElementById('memoItalic');
      this.$memoCode = this.shadowRoot.getElementById('memoCode');
      this.$memoH1 = this.shadowRoot.getElementById('memoH1');
      this.$memoH2 = this.shadowRoot.getElementById('memoH2');
      this.$memoUl = this.shadowRoot.getElementById('memoUl');
      this.$memoOl = this.shadowRoot.getElementById('memoOl');
      this.$memoFull = this.shadowRoot.getElementById('memoFull');

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
      this.$catalystBtn = this.shadowRoot.getElementById('catalyst');
      this.$catalystBox = this.shadowRoot.getElementById('catalystBox');
      this.$catalystInput = this.shadowRoot.getElementById('catalystInput');
      this.$catalystRun = this.shadowRoot.getElementById('catalystRun');
      this.$catalystCancel = this.shadowRoot.getElementById('catalystCancel');
      this.$download = this.shadowRoot.getElementById('download');
      this.$toast = this.shadowRoot.getElementById('toast');
    }

    restore() {
      // content
      this.$memo.value = this.state.memo || '';
      if (this.$memoEditor) this.$memoEditor.value = this.state.memo || '';
      if (this.$inlineEnabled)
        this.$inlineEnabled.checked = !!this.state.inlineEnabled;
      if (this.$fontSize) {
        const fs = parseInt(this.state.fontSize || 13, 10);
        this.$fontSize.value = String(fs);
        this.applyFontSize(fs);
      }

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
      this.$previewBody?.classList.toggle('active', this.state.mode === 'preview');
      this.$devBody.classList.toggle('active', this.state.mode === 'dev');
      this.$settingsBody?.classList.toggle('active', this.state.mode === 'settings');

      // ensure preview reflects latest (debounced for smoother mount)
      if (this.state.mode === 'preview' && this.$memoPreview) {
        this.scheduleRenderPreview(this.$memoEditor?.value || this.$memo?.value || '');
      }
     }

     // ===== History: event logging & overlay =====
     logEvent(evt) {
       try {
         const info = this.getCurrentPostInfo();
         const base = {
           t: Date.now(),
           page: { url: location.href, title: document.title, post: info || null },
         };
         const rec = Object.assign(base, evt || {});
         let arr = Array.isArray(this.state.events) ? this.state.events.slice() : [];
         arr.push(rec);
         // cap to last 500 events to bound storage
         if (arr.length > 500) arr = arr.slice(arr.length - 500);
         this.state.events = arr;
         LS.set(KEYS.events, arr);
         return rec;
       } catch (_) { return null; }
     }

       openHistory() {
         if (!this.$historyOverlay || !this.$historyCanvas) return;
         this.$historyOverlay.style.display = 'block';
         this.resizeHistoryCanvas();
         this.drawHistory();
         this.attachHistoryInteractions();
         this.hideHistoryTooltip();
         this.logEvent({ type: 'history_open', label: '히스토리 열기' });
       }
       closeHistory() {
         if (!this.$historyOverlay) return;
         this.$historyOverlay.style.display = 'none';
         this.detachHistoryInteractions();
         this.hideHistoryTooltip();
         this.logEvent({ type: 'history_close', label: '히스토리 닫기' });
       }

      resizeHistoryCanvas() {
        const c = this.$historyCanvas; if (!c) return;
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const w = window.innerWidth; const h = window.innerHeight;
        c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
        c.style.width = w + 'px'; c.style.height = h + 'px';
        const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      animateHistoryTo(target, duration = 280) {
        if (!this._hist || !this.$historyCanvas) return;
        const start = { tx: this._hist.tx, ty: this._hist.ty, scale: this._hist.scale };
        const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        if (this._histAnim) cancelAnimationFrame(this._histAnim);
        const t0 = performance.now();
        const step = (now) => {
          const p = Math.min(1, (now - t0) / duration);
          const k = ease(p);
          this._hist.tx = start.tx + (target.tx - start.tx) * k;
          this._hist.ty = start.ty + (target.ty - start.ty) * k;
          this._hist.scale = start.scale + (target.scale - start.scale) * k;
          this.drawHistory();
          if (p < 1) this._histAnim = requestAnimationFrame(step);
        };
        this._histAnim = requestAnimationFrame(step);
      }

      centerHistoryOn(node, { animate = true } = {}) {
        const c = this.$historyCanvas; if (!c || !node) return;
        const rect = c.getBoundingClientRect();
        const cx = rect.width / 2; const cy = rect.height / 2;
        const ns = Math.max(1, this._hist?.scale || 1);
        const tx = cx - node.x * ns;
        const ty = cy - node.y * ns;
         if (animate) this.animateHistoryTo({ tx, ty, scale: ns }, 280);
         else { this._hist.tx = tx; this._hist.ty = ty; this._hist.scale = ns; this.scheduleHistoryDraw(); }
      }

     attachHistoryInteractions() {
       if (this._histBound) return; this._histBound = true;
       this._hist = this._hist || { scale: 1, tx: 0, ty: 0, dragging: false, lx:0, ly:0 };
       const c = this.$historyCanvas; if (!c) return;
        const onResize = () => { this.resizeHistoryCanvas(); this.scheduleHistoryDraw(); };
         const onWheel = (e) => {
           e.preventDefault();
           const { offsetX, offsetY, deltaY } = e;
           const factor = deltaY < 0 ? 1.1 : 0.9;
           const { scale, tx, ty } = this._hist;
           const x = (offsetX - tx) / scale; const y = (offsetY - ty) / scale;
           const ns = Math.max(0.3, Math.min(3, scale * factor));
           this._hist.scale = ns;
           this._hist.tx = offsetX - x * ns; this._hist.ty = offsetY - y * ns;
           this.scheduleHistoryDraw();
           // keep tooltip synced
           if (this._hist.mouseX != null && this._hist.mouseY != null) {
             const g = this._histGraph || this.layoutGraph(this.buildGraph());
             let hit = null; const xw = (this._hist.mouseX - this._hist.tx)/ns; const yw = (this._hist.mouseY - this._hist.ty)/ns;
             for (let i=g.nodes.length-1;i>=0;i--) { const n=g.nodes[i]; const r=n.r||16; const dx=xw-n.x, dy=yw-n.y; if (dx*dx+dy*dy<=r*r) { hit=n; break; } }
             this._hist.hoverId = hit ? hit.id : null;
             this.updateHistoryTooltip(hit, this._hist.mouseX, this._hist.mouseY);
           }
         };
        const onDown = (e) => {
          this._hist.dragging = true; this._hist.lx = e.clientX; this._hist.ly = e.clientY;
          c.classList.add('grabbing');
          this.hideHistoryTooltip();
        };
        const onMove = (e) => {
          this._hist.mouseX = e.clientX; this._hist.mouseY = e.clientY;
          if (this._hist.dragging) {
            const dx = e.clientX - this._hist.lx; const dy = e.clientY - this._hist.ly; this._hist.lx = e.clientX; this._hist.ly = e.clientY; this._hist.tx += dx; this._hist.ty += dy; this.scheduleHistoryDraw();
          } else {
            // hover detection when not dragging
            const rect = c.getBoundingClientRect();
            const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
            const x = (mx - this._hist.tx) / (this._hist.scale||1);
            const y = (my - this._hist.ty) / (this._hist.scale||1);
            const g = this._histGraph || this.layoutGraph(this.buildGraph());
            let hit = null;
            for (let i=g.nodes.length-1;i>=0;i--) {
              const n = g.nodes[i]; const r = (n.r||16);
              const dx = x - n.x; const dy = y - n.y;
              if (dx*dx + dy*dy <= r*r) { hit = n; break; }
            }
            const prev = this._hist.hoverId;
            this._hist.hoverId = hit ? hit.id : null;
            if (prev !== this._hist.hoverId) this.drawHistory();
            this.updateHistoryTooltip(hit, e.clientX, e.clientY);
            c.style.cursor = hit ? 'pointer' : 'grab';
          }
        };
        const onUp = () => { this._hist.dragging = false; c.classList.remove('grabbing'); };
       const onKey = (e) => { if (e.key === 'Escape') this.closeHistory(); };
       c.addEventListener('wheel', onWheel, { passive: false });
       c.addEventListener('pointerdown', onDown);
       window.addEventListener('pointermove', onMove);
       window.addEventListener('pointerup', onUp);
       window.addEventListener('resize', onResize);
       window.addEventListener('keydown', onKey);
         const onClick = (e) => {
          const rect = c.getBoundingClientRect();
          const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
          const x = (mx - this._hist.tx) / (this._hist.scale||1);
          const y = (my - this._hist.ty) / (this._hist.scale||1);
          const g = this._histGraph || this.layoutGraph(this.buildGraph());
          let hit = null;
          for (let i=g.nodes.length-1;i>=0;i--) {
            const n = g.nodes[i]; const r = (n.r||16);
            const dx = x - n.x; const dy = y - n.y;
            if (dx*dx + dy*dy <= r*r) { hit = n; break; }
          }
          if (!hit) return;
          if (hit.kind === 'post' || hit.kind === 'post_node') {
            // smooth center on node
            this.centerHistoryOn(hit, { animate: true });
          }
        };
        const onDblClick = (e) => {
          const rect = c.getBoundingClientRect();
          const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
          const x = (mx - this._hist.tx) / (this._hist.scale||1);
          const y = (my - this._hist.ty) / (this._hist.scale||1);
          const g = this._histGraph || this.layoutGraph(this.buildGraph());
          let hit = null;
          for (let i=g.nodes.length-1;i>=0;i--) {
            const n = g.nodes[i]; const r = (n.r||16);
            const dx = x - n.x; const dy = y - n.y;
            if (dx*dx + dy*dy <= r*r) { hit = n; break; }
          }
          if (hit && (hit.kind === 'post' || hit.kind === 'post_node')) {
            const p = hit.meta?.post;
            if (p) {
              const href = `#/blog/${p.year}/${p.slug}`;
              try { window.location.hash = href.replace(/^#/, ''); }
              catch (_) { window.location.href = href; }
              this.closeHistory();
            }
          }
        };
         c.addEventListener('click', onClick);
         c.addEventListener('dblclick', onDblClick);
         this.$historyClose?.addEventListener('click', () => this.closeHistory());
         this.$historyReset?.addEventListener('click', () => { if (!confirm('히스토리 기록을 모두 삭제할까요?')) return; this.state.events = []; LS.set(KEYS.events, []); this.drawHistory(); this.toast('기록을 초기화했습니다.'); this.logEvent({ type: 'history_reset', label: '히스토리 초기화' }); });
         this.$historyExport?.addEventListener('click', () => {
           try {
             const data = { exportedAt: new Date().toISOString(), events: this.state.events || [] };
             const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
             const url = URL.createObjectURL(blob);
             const a = document.createElement('a');
             a.href = url; a.download = 'ai-memo-history.json';
             document.body.appendChild(a); a.click(); a.remove();
             URL.revokeObjectURL(url);
             this.toast('히스토리를 내보냈습니다.');
             this.logEvent({ type: 'download_history', label: '히스토리 내보내기' });
           } catch (_) { this.toast('내보내기에 실패했습니다.'); }
         });
         this.$historyImport?.addEventListener('click', () => {
           try {
             const input = document.createElement('input');
             input.type = 'file';
             input.accept = 'application/json,.json';
             input.style.display = 'none';
             document.body.appendChild(input);
             input.addEventListener('change', async () => {
               try {
                 const file = input.files && input.files[0];
                 if (!file) return; const text = await file.text();
                 const parsed = JSON.parse(text);
                 const events = Array.isArray(parsed?.events) ? parsed.events : (Array.isArray(parsed) ? parsed : []);
                 if (!Array.isArray(events)) throw new Error('올바른 형식이 아닙니다.');
                 // sanitize and cap
                 const cleaned = events.filter(e => e && typeof e === 'object' && typeof e.t === 'number');
                 this.state.events = cleaned.slice(-500);
                 LS.set(KEYS.events, this.state.events);
                 this.drawHistory();
                 this.toast('히스토리를 가져왔습니다.');
                 this.logEvent({ type: 'history_import', label: '히스토리 가져오기' });
               } catch (err) {
                 console.error('history import error:', err);
                 this.toast('가져오기에 실패했습니다.');
               } finally {
                 input.remove();
               }
             }, { once: true });
             input.click();
           } catch (_) {
             this.toast('가져오기 시작에 실패했습니다.');
           }
         });
         this._histHandlers = { onWheel, onDown, onMove, onUp, onResize, onKey, onClick, onDblClick };
     }

      detachHistoryInteractions() {
        if (!this._histBound) return; this._histBound = false;
        const c = this.$historyCanvas; if (!c) return;
        const h = this._histHandlers || {};
        c.removeEventListener('wheel', h.onWheel);
        c.removeEventListener('pointerdown', h.onDown);
        c.removeEventListener('click', h.onClick);
        c.removeEventListener('dblclick', h.onDblClick);
        window.removeEventListener('pointermove', h.onMove);
        window.removeEventListener('pointerup', h.onUp);
        window.removeEventListener('resize', h.onResize);
        window.removeEventListener('keydown', h.onKey);
        this._histHandlers = null;
        this.hideHistoryTooltip();
      }

       buildGraph() {
         const events = Array.isArray(this.state.events) ? this.state.events : [];
         const postMap = new Map();
         const nodes = []; const edges = [];
         const keyOfPost = (p) => p ? `${p.year}/${p.slug}` : 'unknown';
         const addNode = (id, kind, label, meta) => { nodes.push({ id, kind, label, meta }); };
         const addEdge = (a, b, w=1) => { edges.push({ a, b, w }); };
         // current post
         const info = this.getCurrentPostInfo();
         if (info) {
           const pid = `post:${keyOfPost(info)}`;
           if (!postMap.has(pid)) { postMap.set(pid, true); addNode(pid, 'post', document.title, { post: info }); }
         }
         // group duplicate events by (postKey,type,label) with count
         const grouped = new Map();
         for (const ev of events) {
           if (!ev?.page?.post) continue;
           const postKey = keyOfPost(ev.page.post);
           const t = ev.type || 'event';
           const l = ev.label || t;
           const k = `${postKey}|${t}|${l}`;
           const g = grouped.get(k) || { count: 0, any: null, post: ev.page.post };
           g.count += 1; g.any = g.any || ev; grouped.set(k, g);
         }
         for (const [k, g] of grouped) {
           const pid = `post:${keyOfPost(g.post)}`;
           if (!postMap.has(pid)) { postMap.set(pid, true); addNode(pid, 'post', (g.any?.page?.title) || pid, { post: g.post }); }
           const baseId = `ev:${g.any.t}`;
           const nid = `${baseId}:${g.count}`;
           const label = g.count > 1 ? `${g.any.label || g.any.type} ×${g.count}` : (g.any.label || g.any.type || 'event');
           addNode(nid, g.any.type || 'event', label, { ev: g.any, count: g.count });
           addEdge(pid, nid, Math.min(1, 0.3 + 0.1 * g.count));
         }
         // sort nodes for stable rendering (posts under, events above)
         nodes.sort((a,b)=> (a.kind==='post'&&b.kind!=='post') ? -1 : (a.kind!=='post'&&b.kind==='post') ? 1 : (a.id > b.id ? 1 : -1));
         return { nodes, edges };
       }

      layoutGraph(graph) {
        const { nodes, edges } = graph; const C = { postR: 36, evR: 16 };
        const byKind = (k) => nodes.filter(n => n.kind === k || (k==='event' && n.kind!=='post'));
        const posts = byKind('post'); const events = nodes.filter(n => n.kind!=='post');
        const cx = window.innerWidth/2, cy = window.innerHeight/2;
        posts.forEach((n,i)=>{ n.x = cx + (i- (posts.length-1)/2)*140; n.y = cy; n.r = C.postR; });
        // place events around their post in small rings
        const postPos = new Map(posts.map(p => [p.meta.post.year+'/'+p.meta.post.slug, p]));
        const groups = new Map();
        for (const n of events) {
          const p = (n.meta?.ev?.page?.post) || (this.getCurrentPostInfo() || null);
          const key = p ? p.year+'/'+p.slug : 'unknown';
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(n);
        }
        for (const [key, arr] of groups) {
          const pnode = postPos.get(key); if (!pnode) continue;
          arr.forEach((n,i)=>{
            const ang = (i/arr.length)*Math.PI*2; const rad = 96 + (i%4)*20;
            n.x = pnode.x + Math.cos(ang)*rad; n.y = pnode.y + Math.sin(ang)*rad; n.r = C.evR;
          });
        }
        return graph;
      }

      scheduleHistoryDraw() { if (this._histDrawReq) return; this._histDrawReq = requestAnimationFrame(() => { this._histDrawReq = null; this.drawHistory(); }); }

      drawHistory() {
        const c = this.$historyCanvas; if (!c) return; const ctx = c.getContext('2d');
        const { scale, tx, ty } = this._hist || { scale:1, tx:0, ty:0 };
        ctx.save(); ctx.clearRect(0,0,c.width,c.height); ctx.translate(tx, ty); ctx.scale(scale, scale);
        const graph = this.layoutGraph(this.buildGraph());
        this._histGraph = graph;
        // edges
        ctx.strokeStyle = 'rgba(100,116,139,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([0]);
        for (const e of graph.edges) {
          const a = graph.nodes.find(n=>n.id===e.a); const b = graph.nodes.find(n=>n.id===e.b); if (!a||!b) continue;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        // nodes
        for (const n of graph.nodes) {
          ctx.beginPath();
          if (n.kind === 'post') { ctx.fillStyle = '#111827'; ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 3; ctx.arc(n.x, n.y, n.r, 0, Math.PI*2); ctx.fill(); ctx.stroke(); }
          else { ctx.fillStyle = '#1d4ed8'; ctx.strokeStyle = 'rgba(29,78,216,0.3)'; ctx.lineWidth = 2; ctx.arc(n.x, n.y, n.r, 0, Math.PI*2); ctx.fill(); ctx.stroke(); }
          // label
          ctx.fillStyle = n.kind==='post' ? '#fff' : '#0b1020';
          ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const raw = String(n.label || '');
          const label = raw.length > 18 ? raw.slice(0, 17) + '…' : raw;
          ctx.fillText(label, n.x, n.y);
        }
        // hover highlight
        if (this._hist && this._hist.hoverId) {
          const hn = graph.nodes.find(n => n.id === this._hist.hoverId);
          if (hn) {
            ctx.beginPath();
            ctx.strokeStyle = hn.kind==='post' ? '#fcd34d' : '#93c5fd';
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 4]);
            ctx.arc(hn.x, hn.y, (hn.r||16)+6, 0, Math.PI*2);
            ctx.stroke();
            ctx.setLineDash([]);
            // draw subtle connector to center
            const rect = this.$historyCanvas.getBoundingClientRect();
            const cx = rect.width/2, cy = rect.height/2;
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(148,163,184,0.5)';
            ctx.setLineDash([2, 6]);
            ctx.moveTo(hn.x, hn.y); ctx.lineTo(cx, cy); ctx.stroke();
            ctx.setLineDash([]);
          }
        }
        ctx.restore();
      }

      updateOpen() {
        const isOpen = this.$panel.classList.contains('open');
        LS.set(KEYS.isOpen, isOpen);
        this.state.isOpen = isOpen;
      }

      updateHistoryTooltip(node, clientX, clientY) {
        if (!node) return this.hideHistoryTooltip();
        let tip = this.$historyTooltip;
         if (!tip) {
           tip = document.createElement('div');
           tip.className = 'history-tooltip';
           tip.style.opacity = '0';
           tip.style.transition = 'opacity 120ms ease';
           this.$historyTooltip = tip;
           this.shadowRoot.appendChild(tip);
           requestAnimationFrame(()=>{ tip.style.opacity = '1'; });
         }
         const lines = [];
         if (node.kind === 'post') {
           const p = node.meta?.post;
           lines.push(`Post: ${node.label}`);
           if (p) lines.push(`${p.year}/${p.slug}`);
           lines.push('Click: center • Double-click: open');
         } else {
           const ev = node.meta?.ev;
           const pg = ev?.page;
           lines.push(`Event: ${node.label}`);
           if (node.meta?.count && node.meta.count > 1) lines.push(`Count: ${node.meta.count}`);
           if (ev?.type) lines.push(`Type: ${ev.type}`);
           if (ev?.t) {
             try { lines.push(new Date(ev.t).toLocaleString()); } catch (_) {}
           }
           if (pg?.title) lines.push(`Page: ${pg.title}`);
           if (pg?.post) { const p = pg.post; lines.push(`Post: ${p.year}/${p.slug}`); }
         }
        tip.textContent = lines.join(' • ');
        tip.style.left = Math.round(clientX + 12) + 'px';
        tip.style.top = Math.round(clientY + 12) + 'px';
        return tip;
      }

      hideHistoryTooltip() {
        if (this.$historyTooltip) { this.$historyTooltip.remove(); this.$historyTooltip = null; }
      }


     updateMode() {
      const active = this.shadowRoot.querySelector('.tab.active');
      const mode = active ? active.dataset.tab : 'memo';
      LS.set(KEYS.mode, mode);
      this.state.mode = mode;
      if (mode === 'dev') {
        this.maybeLoadOriginalMarkdown();
      }
      if (mode === 'preview') {
        if (this.$memoEditor && this.$memoPreview) {
           this.$memoEditor.value = this.$memo.value || '';
           this.scheduleRenderPreview(this.$memoEditor.value);
        }
      }
    }

     bind() {
       // launcher
       this.$launcher.addEventListener('click', () => {
         this.$panel.classList.toggle('open');
         this.updateOpen();
       });

       // history overlay toggle
       if (this.$historyLauncher && this.$historyOverlay) {
         this.$historyLauncher.addEventListener('click', () => {
           const vis = this.$historyOverlay.style.display !== 'none';
           if (vis) this.closeHistory(); else this.openHistory();
         });
       }

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
          this.$previewBody?.classList.toggle('active', mode === 'preview');
          this.$devBody.classList.toggle('active', mode === 'dev');
          this.$settingsBody?.classList.toggle('active', mode === 'settings');
          this.updateMode();
        })
      );

      // input persistence
       const saveMemo = () => {
         this.state.memo = this.$memo.value;
         LS.set(KEYS.memo, this.state.memo);
         if (this.$memoEditor && this.$memoEditor.value !== this.state.memo) {
           this.$memoEditor.value = this.state.memo;
         }
          if (this.$memoPreview) {
            this.scheduleRenderPreview(this.state.memo);
          }
          this.$status.textContent = '저장됨';
         clearTimeout(this._saveTimer);
         this._saveTimer = setTimeout(() => (this.$status.textContent = 'Ready'), 900);
       };

      this.$memo.addEventListener('input', saveMemo);
      this.$memo.addEventListener('change', saveMemo);
      if (this.$memoEditor) {
        const saveAndRender = () => {
          this.state.memo = this.$memoEditor.value;
          LS.set(KEYS.memo, this.state.memo);
          this.scheduleRenderPreview(this.state.memo);
          if (this.$memo.value !== this.state.memo) this.$memo.value = this.state.memo;
          this.$status.textContent = '저장됨';
          clearTimeout(this._saveTimer);
          this._saveTimer = setTimeout(() => (this.$status.textContent = 'Ready'), 900);
        };
        this.$memoEditor.addEventListener('input', saveAndRender);
        this.$memoEditor.addEventListener('change', saveAndRender);

        // scroll sync: editor -> preview
        const sync = () => {
          if (!this.$memoPreview) return;
          const ta = this.$memoEditor;
          const ratio = ta.scrollTop / (ta.scrollHeight - ta.clientHeight || 1);
          const target = (this.$memoPreview.scrollHeight - this.$memoPreview.clientHeight) * ratio;
          this.$memoPreview.scrollTop = target;
        };
        this.$memoEditor.addEventListener('scroll', () => requestAnimationFrame(sync));
      }
       if (this.$inlineEnabled) {
         const onToggleInline = () => {
           const val = !!this.$inlineEnabled.checked;
           this.state.inlineEnabled = val;
           LS.set(KEYS.inlineEnabled, val);
           this.toast(`인라인 ✨ ${val ? '켜짐' : '꺼짐'}`);
           this.logEvent({ type: 'toggle_inline', label: val ? 'on' : 'off' });
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
       const getActiveTextarea = () => {
         const active = this.shadowRoot.activeElement || document.activeElement;
         if (active === this.$memoEditor) return this.$memoEditor;
         return this.$memo;
       };
       const surround = (prefix, suffix = prefix) => {
         const ta = getActiveTextarea();
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
         const ta = getActiveTextarea();
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
           const entering = !this.classList.contains('memo-full');
           this.classList.toggle('memo-full');
           this.toast(entering ? '전체화면' : '일반 모드');
           this.logEvent({ type: 'toggle_fullscreen', label: entering ? 'enter' : 'exit' });
           if (this.$memoPreview) this.renderMarkdownToPreview(this.$memoEditor?.value || this.$memo?.value || '');
         });

       this.$memoClear?.addEventListener('click', () => {
         if (confirm('메모를 모두 지울까요?')) {
           this.$memo.value = '';
           this.$memo.dispatchEvent(new Event('input', { bubbles: true }));
         }
       });

      // selection add
      this.$addSel.addEventListener('click', () => {
        this.logEvent({ type: 'add_selection', label: '선택 추가' });

        const sel = window.getSelection();
        const text = sel && sel.toString().trim();
        if (!text) {
          this.toast('선택된 텍스트가 없습니다.');
          return;
        }
        const now = new Date();
        const entry = `\n> ${text}\n— ${now.toLocaleString()}`;
        const next = `${(this.$memo.value || '') + entry}\n`;
        this.$memo.value = next;
        if (this.$memoEditor) this.$memoEditor.value = next;
        if (this.$memoPreview) this.renderMarkdownToPreview(next);
        this.$memo.dispatchEvent(new Event('input', { bubbles: true }));
        this.toast('선택 내용을 추가했습니다.');
      });

      // Catalyst UI
      if (this.$catalystBtn) {
        this.$catalystBtn.addEventListener('click', () => {
          if (!this.$catalystBox) return;
          const visible = this.$catalystBox.style.display !== 'none';
          this.$catalystBox.style.display = visible ? 'none' : 'flex';
          this.logEvent({ type: visible ? 'catalyst_close' : 'catalyst_open', label: visible ? 'close' : 'open' });
          if (!visible) {
            setTimeout(() => this.$catalystInput?.focus(), 0);
          }
        });
      }
      if (this.$catalystCancel) {
         this.$catalystCancel.addEventListener('click', () => {
           if (this.$catalystInput) this.$catalystInput.value = '';
           if (this.$catalystBox) this.$catalystBox.style.display = 'none';
           this.logEvent({ type: 'catalyst_cancel', label: 'cancel' });
         });
      }
      if (this.$catalystRun) {
         this.$catalystRun.addEventListener('click', () => this.runCatalyst());
         this.$catalystInput?.addEventListener('input', () => {
           const v = this.$catalystInput.value || '';
           if (v.length > 160) this.$catalystInput.value = v.slice(0,160);
         });
      }
      if (this.$catalystInput) {
        this.$catalystInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.runCatalyst(); }
          if (e.key === 'Escape') { e.preventDefault(); this.$catalystCancel?.click(); }
        });
      }

      // unified download menu
      this.$download.addEventListener('click', () => { 
        const sel = document.createElement('select');
        sel.innerHTML = '<option value="txt">일반 텍스트 (.txt)</option><option value="md">Markdown (.md)</option><option value="html">HTML (.html)</option>';
        sel.style.position = 'absolute';
        sel.style.right = '12px';
        sel.style.bottom = '44px';
        sel.style.zIndex = '2147483647';
        sel.style.padding = '6px';
        sel.style.borderRadius = '6px';
        sel.style.border = '1px solid #e5e7eb';
        sel.style.background = '#fff';
        this.$panel.appendChild(sel);
        const cleanup = () => sel.remove();
        sel.addEventListener('change', () => {
          const type = sel.value;
          const md = this.$memo.value || '';
          if (type === 'txt') {
            const blob = new Blob([md], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'memo.txt'; document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            this.toast('memo.txt 다운로드');
          } else if (type === 'md') {
            const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'memo.md'; document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            this.toast('memo.md 다운로드');
          } else if (type === 'html') {
            const body = this.markdownToHtml(md);
            const html = '<!doctype html><meta charset="utf-8"/><title>Memo</title><body style="font: 14px/1.6 system-ui, sans-serif; padding: 24px; max-width: 760px; margin: auto;">' + body + '</body>';
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'memo.html'; document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            this.toast('memo.html 다운로드');
          }
          cleanup();
        });
        const onBlur = () => cleanup();
        sel.addEventListener('blur', onBlur);
        setTimeout(() => sel.focus(), 0);
      });

       // AI summary
      this.$aiSummary.addEventListener('click', () => {
        this.logEvent({ type: 'ai_summary', label: 'AI 요약' });
        this.summarizeWithGemini();
      });

      // track key actions
      this.$download?.addEventListener('click', () => this.logEvent({ type: 'download_memo', label: '메모 다운로드' }));
       this.$historyLauncher?.addEventListener('click', () => this.logEvent({ type: 'open_history', label: '히스토리 토글' }));


      // font size
      if (this.$fontSize) {
         const onFs = () => {
           const fs = parseInt(this.$fontSize.value || '13', 10);
           this.applyFontSize(fs);
           LS.set(KEYS.fontSize, fs);
           this.state.fontSize = fs;
           this.logEvent({ type: 'change_font_size', label: String(fs) });
         };
        this.$fontSize.addEventListener('change', onFs);
        this.$fontSize.addEventListener('input', onFs);
      }

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
         const activeEl = this.shadowRoot.activeElement || document.activeElement;
         const isMemo = activeEl === this.$memo;
         const isEditor = activeEl === this.$memoEditor;
         if (this.$panel.classList.contains('open') && (isMemo || isEditor)) {
           const meta = e.metaKey || e.ctrlKey;
           if (meta && e.key.toLowerCase() === 'b') { e.preventDefault(); surround('**'); }
           if (meta && e.key.toLowerCase() === 'i') { e.preventDefault(); surround('*'); }
           if (meta && e.key === '`') { e.preventDefault(); surround('`'); }
         }
       });

       // indent/outdent with Tab/Shift+Tab inside memo
        const tabIndentHandler = (ta, e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const { selectionStart: s, selectionEnd: epos, value } = ta;
            if (e.shiftKey) {
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
        };
       this.$memo.addEventListener('keydown', e => tabIndentHandler(this.$memo, e));
       if (this.$memoEditor) this.$memoEditor.addEventListener('keydown', e => tabIndentHandler(this.$memoEditor, e));

       // close tooltip softly
       const tipFadeOut = () => { if (this.$historyTooltip) { this.$historyTooltip.style.opacity = '0'; setTimeout(()=> this.hideHistoryTooltip(), 140); } };
       window.addEventListener('pointerdown', tipFadeOut);
       window.addEventListener('scroll', tipFadeOut, { passive: true });

       // basic auto-close for brackets/quotes
       const autoClose = (ta, e) => {
         const map = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
         const close = map[e.key];
         if (!close) return;
         e.preventDefault();
         const { selectionStart: s, selectionEnd: epos, value } = ta;
         const before = value.slice(0, s);
         const after = value.slice(epos);
         ta.value = before + e.key + close + after;
         const ns = s + 1;
         ta.setSelectionRange(ns, ns);
         ta.dispatchEvent(new Event('input', { bubbles: true }));
       };
       const autoCloseKeys = new Set(['(', '[', '{', '"', "'", '`']);
       const onKeydownAuto = (ta) => (e) => {
         if (autoCloseKeys.has(e.key) && !(e.ctrlKey||e.metaKey||e.altKey)) return autoClose(ta, e);
       };
       this.$memo.addEventListener('keydown', onKeydownAuto(this.$memo));
       if (this.$memoEditor) this.$memoEditor.addEventListener('keydown', onKeydownAuto(this.$memoEditor));

       // slash command menu (minimal)
       const openSlashMenu = (ta) => {
         const menu = document.createElement('div');
         menu.style.position = 'absolute';
         menu.style.right = '12px';
         menu.style.bottom = '44px';
         menu.style.zIndex = '2147483647';
         menu.style.background = '#fff';
         menu.style.border = '1px solid #e5e7eb';
         menu.style.borderRadius = '8px';
         menu.style.padding = '6px';
         menu.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)';
          const items = [
            { k: 'h1', label: '제목 1', apply: () => { insertPrefix('# '); this.logEvent({ type: 'slash_menu', label: 'h1' }); } },
            { k: 'h2', label: '제목 2', apply: () => { insertPrefix('## '); this.logEvent({ type: 'slash_menu', label: 'h2' }); } },
            { k: 'quote', label: '인용구', apply: () => { insertPrefix('> '); this.logEvent({ type: 'slash_menu', label: 'quote' }); } },
            { k: 'code', label: '코드 블록', apply: () => { surround('```\n', '\n```'); this.logEvent({ type: 'slash_menu', label: 'code' }); } },
            { k: 'ul', label: '글머리 기호', apply: () => { insertPrefix('- '); this.logEvent({ type: 'slash_menu', label: 'ul' }); } },
            { k: 'ol', label: '번호 목록', apply: () => { insertPrefix('1. '); this.logEvent({ type: 'slash_menu', label: 'ol' }); } },
          ];
         menu.innerHTML = items.map((it,i)=>`<div data-i="${i}" style="padding:4px 8px; cursor:pointer;">${it.label}</div>`).join('');
         this.$panel.appendChild(menu);
         const cleanup = () => menu.remove();
         menu.addEventListener('click', (e) => {
           const t = e.target.closest('[data-i]');
           if (!t) return;
           const i = +t.dataset.i;
           items[i].apply();
           cleanup();
         });
         setTimeout(()=> menu.focus?.(),0);

         const surround = (prefix, suffix=prefix) => {
           const { selectionStart: s, selectionEnd: epos, value } = ta;
           const before = value.slice(0, s);
           const selection = value.slice(s, epos) || '';
           const after = value.slice(epos);
           const next = before + prefix + selection + suffix + after;
           ta.value = next; const ns = (before + prefix + selection).length; ta.setSelectionRange(ns, ns); ta.dispatchEvent(new Event('input', { bubbles: true }));
         };
         const insertPrefix = (p) => {
           const { selectionStart: s, value } = ta;
           const start = value.lastIndexOf('\n', s - 1) + 1;
           ta.setRangeText(p, start, start, 'end');
           ta.dispatchEvent(new Event('input', { bubbles: true }));
         };
          this.logEvent({ type: 'open_slash_menu', label: 'slash' });
          return cleanup;
       };
       const attachSlashHandler = (ta) => {
         let cleanup = null;
         ta.addEventListener('keydown', (e) => {
           if (e.key === '/' && !(e.ctrlKey||e.metaKey||e.altKey)) {
             const { selectionStart: s, value } = ta;
             const prevChar = s > 0 ? value.charAt(s-1) : '\n';
             if (prevChar === '\n') {
               setTimeout(()=>{ cleanup = openSlashMenu(ta); },0);
             }
           }
           if (e.key === 'Escape' && cleanup) { cleanup(); cleanup = null; }
         });
       };
       attachSlashHandler(this.$memo);
       if (this.$memoEditor) attachSlashHandler(this.$memoEditor);

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
