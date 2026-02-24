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
    closeAfterInject: 'aiMemo.closeAfterInject',
    events: 'aiMemo.events',
    layoutMode: 'aiMemo.layoutMode',
    previewPane: 'aiMemo.previewPane'
  };

  const NOISY_EVENT_TYPES = new Set([
    'history_open',
    'history_close',
    'history_reset',
    'download_history',
    'history_import',
    'layout_change',
    'preview_pane',
    'toggle_inline',
    'toggle_close_after_inject',
    'reset_position',
    'toggle_fullscreen',
    'catalyst_open',
    'catalyst_close',
    'catalyst_cancel',
    'enter_block_select'
  ]);

  // 기본값 설정
  const DEFAULT_API_URL = 'https://api.nodove.com';
  const DEFAULT_REPO_URL = 'https://github.com/choisimo/blog';
  const BLOCK_SELECTORS = 'p, pre, code, blockquote, ul, ol, li, table, thead, tbody, tr, th, td, figure, figcaption, h1, h2, h3, h4, h5, h6, section, article, main';

  function normalizeBaseUrl(url) {
    let normalized = String(url || '').trim();

    // Migrate legacy domains to unified gateway
    if (normalized.includes('ai-check.nodove.com')) {
      normalized = normalized.replace('ai-check.nodove.com', 'api.nodove.com');
    }
    // Direct backend URL should also be migrated to go through Workers
    if (normalized.includes('blog-b.nodove.com')) {
      normalized = normalized.replace('blog-b.nodove.com', 'api.nodove.com');
    }

    while (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    if (normalized.endsWith('/api')) {
      normalized = normalized.slice(0, -4);
    }
    return normalized;
  }

  function getFabPositionSetting() {
    try {
      const raw = localStorage.getItem('fab.position');
      if (raw === 'bottom' || raw === 'left') return raw;
      const parsed = raw != null ? JSON.parse(raw) : null;
      if (parsed === 'bottom' || parsed === 'left') return parsed;
    } catch (_) {}
    return 'bottom';
  }

  class AIMemoPad extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.state = {
        isOpen: !!LS.get(KEYS.isOpen, false),
        position: LS.get(KEYS.position, { x: null, y: null }),
        mode: LS.get(KEYS.mode, 'memo'),
        memo: LS.get(KEYS.memo, ''),
        inlineEnabled: !!LS.get(KEYS.inlineEnabled, true),
        closeAfterInject: !!LS.get(KEYS.closeAfterInject, false),
        devHtml: LS.get(KEYS.devHtml, '<div>Hello AI Memo 👋</div>'),
        devCss: LS.get(
          KEYS.devCss,
          'body { font-family: system-ui, sans-serif; padding: 12px; }'
        ),
        devJs: LS.get(KEYS.devJs, 'console.log("Hello from user JS");'),
        proposalMd: LS.get(KEYS.proposalMd, ''),
        fontSize: LS.get(KEYS.fontSize, 13),
        fabPosition: getFabPositionSetting(),
        events: LS.get(KEYS.events, []),
        layoutMode: LS.get(KEYS.layoutMode, 'split'),
        previewPane: LS.get(KEYS.previewPane, 'editor')
      };
      this.root = null; // shadow root container
      this._originalLoaded = false;
      this.isBlockSelectMode = false;
      this.highlightedBlock = null;
      this._turndown = null;
      this._prevCursor = '';
      this._boundBlockHighlight = this.handleBlockHighlight.bind(this);
      this._boundBlockCapture = this.handleBlockCapture.bind(this);
      this._boundBlockKeydown = this.handleBlockKeydown.bind(this);
      this.$previewSplit = null;
      this.$layoutSplit = null;
      this.$layoutTabs = null;
      this.$previewPaneToggle = null;
      this.$previewPaneButtons = [];

      if (window.TurndownService) {
        this._turndown = new window.TurndownService();
      } else {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/turndown/dist/turndown.js';
        script.onload = () => {
          if (window.TurndownService) {
            this._turndown = new window.TurndownService();
          }
        };
        document.head.appendChild(script);
      }

      // Output channel ensures UI writes stay scoped to shadow DOM
      this.out = {
        getStatus: () => {
          const statusText = this.shadowRoot?.querySelector('.status-text');
          return statusText ? statusText.textContent || '' : '';
        },
        setStatus: (text) => {
          try {
            const statusText = this.shadowRoot?.querySelector('.status-text');
            if (statusText) statusText.textContent = String(text ?? '');
          } catch (_) {}
        },
        tempStatus: (text, restoreTo, delay = 1400) => {
          try {
            const statusText = this.shadowRoot?.querySelector('.status-text');
            const prev = typeof restoreTo === 'string' ? restoreTo : (statusText?.textContent || 'Ready');
            if (statusText) statusText.textContent = String(text ?? '');
            clearTimeout(this._statusTimer);
            this._statusTimer = setTimeout(() => { try { if (statusText) statusText.textContent = prev; } catch (_) {} }, delay);
          } catch (_) {}
        },
        toast: (msg) => { try { const t = this.$toast; if (!t) return; t.textContent = String(msg || ''); t.classList.add('show'); clearTimeout(this._toastTimer); this._toastTimer = setTimeout(() => t.classList.remove('show'), 1600); } catch (_) {} },
        append: (block) => {
          try {
            const cur = this.$memo?.value || '';
            const next = cur + String(block || '');
            if (this.$memo) this.$memo.value = next;
            if (this.$memoEditor) this.$memoEditor.value = next;
            if (this.$memoPreview) this.renderMarkdownToPreview(next);
            if (this.$memo) this.$memo.dispatchEvent(new Event('input', { bubbles: true }));
            return next;
          } catch (_) { return null; }
        },
        renderAIDetails: (details) => {
          try {
            const aiDetails = this.$aiDetails;
            if (!aiDetails) return;
            aiDetails.innerHTML = '';
            const title = document.createElement('h3');
            title.textContent = 'AI Q&A Details';
            aiDetails.appendChild(title);
            const ul = document.createElement('ul');
            Object.keys(details).forEach(key => {
              const li = document.createElement('li');
              li.textContent = `${key}: ${details[key]}`;
              ul.appendChild(li);
            });
            aiDetails.appendChild(ul);
          } catch (_) {}
        }
      };
    }

    connectedCallback() {
      this.render();
      this.bind();
      this.applyThemeFromPage();
      this.restore();
      this.updateOpen();
      this.updateMode();
      window.addEventListener(
        'aiMemo:log',
        this._onExternalLog
      );
      this._boundBeforeUnload = () => {
        if (this.state.memo) {
          LS.set(KEYS.memo, this.state.memo);
        }
      };
      window.addEventListener('beforeunload', this._boundBeforeUnload);
      
      this._isKeyboardVisible = false;
      this._viewportHeight = window.visualViewport?.height || window.innerHeight;
      this._boundHandleViewportResize = this.handleViewportResize.bind(this);
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', this._boundHandleViewportResize);
      }
    }

    disconnectedCallback() {
      window.removeEventListener(
        'aiMemo:log',
        this._onExternalLog
      );
      window.removeEventListener('beforeunload', this._boundBeforeUnload);
      this.cleanupHistoryInteractions();
      
      if (window.visualViewport && this._boundHandleViewportResize) {
        window.visualViewport.removeEventListener('resize', this._boundHandleViewportResize);
      }
      this.restoreBodyScroll();
    }

    handleViewportResize() {
      if (!window.visualViewport) return;
      const currentHeight = window.visualViewport.height;
      const windowHeight = window.innerHeight;
      const heightDiff = windowHeight - currentHeight;
      const keyboardThreshold = 150;
      
      const wasKeyboardVisible = this._isKeyboardVisible;
      this._isKeyboardVisible = heightDiff > keyboardThreshold;
      
      if (wasKeyboardVisible !== this._isKeyboardVisible) {
        this.$panel?.classList.toggle('keyboard-active', this._isKeyboardVisible);
      }
    }

    lockBodyScroll() {
      if (this._bodyScrollLocked) return;
      this._bodyScrollLocked = true;
      this._originalBodyOverflow = document.body.style.overflow;
      this._originalBodyPosition = document.body.style.position;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    }

    restoreBodyScroll() {
      if (!this._bodyScrollLocked) return;
      this._bodyScrollLocked = false;
      document.body.style.overflow = this._originalBodyOverflow || '';
      document.body.style.position = this._originalBodyPosition || '';
      document.body.style.width = '';
    }

    cleanupHistoryInteractions() {
      if (!this._histListeners) return;
      const { onMove, onUp, onResize, onKey } = this._histListeners;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      this._histListeners = null;
      this._histBound = false;
    }

    applyThemeFromPage() {
      const update = () => {
        const isDark = document.documentElement.classList.contains('dark');
        const isTerminal = document.documentElement.classList.contains('terminal');
        this.classList.toggle('dark', isDark);
        this.classList.toggle('terminal', isTerminal);
        if (this.$historyOverlay && this.$historyOverlay.style.display !== 'none') {
          this.scheduleHistoryDraw();
        }
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
      // Use actual dimensions or fallback to default panel size (400x520)
      const w = rect.width > 0 ? rect.width : Math.min(400, vw - 32);
      const h = rect.height > 0 ? rect.height : Math.min(520, vh - 100);
      // Stricter check: if position would place panel mostly off-screen, return null
      // Panel must have at least 50% visible or be within reasonable bounds
      const minVisible = 100; // at least 100px must be visible
      if (x < -w + minVisible || x > vw - minVisible || y < -h + minVisible || y > vh - minVisible) {
        return { x: null, y: null };
      }
      // Clamp to keep panel fully within viewport with padding
      const padding = 12;
      const nx = Math.max(padding, Math.min(vw - w - padding, x));
      const ny = Math.max(padding, Math.min(vh - h - padding, y));
      return { x: nx, y: ny };
    }

    // Deprecated: prefer using this.out.toast(msg) directly to keep output scoped within the shadow DOM
    toast(msg) { try { this.out.toast(msg); } catch (_) {} }

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
      const prevStatus = this.out.getStatus();
      const statusDot = this.shadowRoot?.querySelector('.status-dot');
      
      try {
        btn.disabled = true;
        if (statusDot) statusDot.style.background = '#7c3aed';
        this.out.setStatus('AI 요약 중…');
        
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
        this.out.append(block);
        this.out.toast('AI 요약이 메모에 추가되었습니다.');
        if (statusDot) statusDot.style.background = 'var(--memo-accent)';
        this.out.setStatus('완료');
        this.logEvent({ type: 'ai_summary_done', label: 'ok' });
      } catch (err) {
        console.error('Gemini summarize error:', err);
        if (statusDot) statusDot.style.background = '#dc2626';
        this.out.setStatus('오류');
        this.out.toast(err?.message || '요약 중 오류가 발생했습니다.');
        this.logEvent({ type: 'ai_summary_error', label: err?.message || 'error' });
      } finally {
        btn.disabled = false;
        setTimeout(() => {
          if (statusDot) statusDot.style.background = 'var(--memo-accent)';
          this.out.setStatus(prevStatus || 'Ready');
        }, 1400);
      }
    }


    async runCatalyst(promptText) {
      const prompt = (promptText || this.$catalystInput?.value || '').trim();
      if (!prompt) { this.out.toast('Catalyst 프롬프트를 입력하세요.'); return; }
      const article = this.getArticleText();
      const memo = this.$memo.value || '';
      const limit = (s, max = 8000) => s && s.length > max ? `${s.slice(0, max)}\n…(truncated)` : s;
      const instructions = [
        '사용자 프롬프트를 "촉매"로 사용해 글의 새로운 관점을 제시하세요.',
        '- 한국어로 작성하고, 구조적인 소제목과 간결한 문장을 사용',
        '- 필요 시 불릿 목록, 표, 간단한 코드 예시를 포함',
        `- 사용자 프롬프트: "${prompt.replace(/` + "`" + `/g, '\\`')}"`
      ].join('\n');

      const btn = this.$catalystRun || this.$catalystBtn; 
      const inputEl = this.$catalystInput;
      const catalystPanel = this.$catalystBox;
      const prev = this.out.getStatus();
      
      try {
        // Set loading state
        if (btn) btn.disabled = true;
        if (inputEl) inputEl.disabled = true;
        if (catalystPanel) catalystPanel.classList.add('loading');
        
        // Update status with loading indicator
        const statusDot = this.shadowRoot?.querySelector('.status-dot');
        if (statusDot) statusDot.style.background = '#7c3aed';
        this.out.setStatus('Catalyst 생성 중…');
        
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
        this.out.append(block);
        this.out.toast('Catalyst 결과가 메모에 추가되었습니다.');
        this.logEvent({ type: 'catalyst_run', label: prompt });
        if (this.$catalystInput) this.$catalystInput.value = '';
        if (this.$catalystBox) this.$catalystBox.style.display = 'none';
        if (this.$catalystInput) this.$catalystInput.disabled = false;
        
        // Success status
        if (statusDot) statusDot.style.background = 'var(--memo-accent)';
        this.out.setStatus('완료');
      } catch (err) {
        console.error('Catalyst error:', err);
        const statusDot = this.shadowRoot?.querySelector('.status-dot');
        if (statusDot) statusDot.style.background = '#dc2626';
        this.out.setStatus('오류');
        this.out.toast(err?.message || 'Catalyst 생성 중 오류가 발생했습니다.');
      } finally {
        if (btn) btn.disabled = false;
        if (inputEl) inputEl.disabled = false;
        if (catalystPanel) catalystPanel.classList.remove('loading');
        setTimeout(() => { 
          const statusDot = this.shadowRoot?.querySelector('.status-dot');
          if (statusDot) statusDot.style.background = 'var(--memo-accent)';
          this.out.setStatus(prev || 'Ready'); 
        }, 1400);
      }
    }

    // ========================================================================
    // Cloud Sync & Versioning
    // ========================================================================

    getUserId() {
      // Use a persistent user ID (could be enhanced with auth)
      let userId = LS.get('aiMemo.userId', null);
      if (!userId) {
        userId = 'user-' + crypto.randomUUID();
        LS.set('aiMemo.userId', userId);
      }
      return userId;
    }

    getApiBase() {
      // Priority: runtime config > localStorage > default
      // This should match frontend/src/utils/apiBase.ts logic
      
      // 1) Runtime injected config (window.APP_CONFIG)
      const w = typeof window !== 'undefined' ? window : null;
      const fromRuntime = w?.APP_CONFIG?.apiBaseUrl || w?.__APP_CONFIG?.apiBaseUrl;
      if (typeof fromRuntime === 'string' && fromRuntime) return normalizeBaseUrl(fromRuntime);

      // 2) localStorage override (developer convenience)
      try {
        const v = LS.get('aiMemo.backendUrl');
        if (typeof v === 'string' && v) {
          const normalized = normalizeBaseUrl(v);
          if (normalized !== v) {
            try {
              LS.set('aiMemo.backendUrl', normalized);
            } catch (_) {}
          }
          return normalized;
        }
      } catch {
        // ignore
      }

      // 3) Localhost detection
      const host = location.host;
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        return normalizeBaseUrl('http://localhost:8787');
      }

      // 4) Default production URL
      return normalizeBaseUrl(DEFAULT_API_URL);
    }

    async syncToCloud() {
      const content = (this.$memo?.value || '').trim();
      if (!content) {
        this.out.toast('메모가 비어 있습니다.');
        return;
      }

      const userId = this.getUserId();
      const apiBase = this.getApiBase();

      this.out.setStatus('동기화 중...');
      const syncBtn = this.$memoSync;
      if (syncBtn) syncBtn.disabled = true;

      try {
        const res = await fetch(`${apiBase}/api/v1/memos/${encodeURIComponent(userId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            createVersion: true,
            changeSummary: `Manual sync at ${new Date().toLocaleString()}`
          })
        });

        const data = await res.json();

        if (!data.ok) {
          throw new Error(data.error?.message || 'Sync failed');
        }

        this.out.toast(`클라우드에 저장됨 (v${data.data?.version || '?'})`);
        this.logEvent({ type: 'cloud_sync', label: 'success', version: data.data?.version });
      } catch (err) {
        console.error('Sync error:', err);
        this.out.toast(err?.message || '동기화 실패');
      } finally {
        if (syncBtn) syncBtn.disabled = false;
        this.out.setStatus('Ready');
      }
    }

    async openVersions() {
      if (!this.$versionsOverlay || !this.$versionsList) return;

      this.$versionsOverlay.style.display = 'flex';
      this.$versionsList.innerHTML = '<div class="versions-empty">로딩 중...</div>';
      this.logEvent({ type: 'versions_open' });

      const userId = this.getUserId();
      const apiBase = this.getApiBase();

      try {
        const res = await fetch(`${apiBase}/api/v1/memos/${encodeURIComponent(userId)}/versions?limit=20`);
        const data = await res.json();

        if (!data.ok || !data.data?.versions?.length) {
          this.$versionsList.innerHTML = '<div class="versions-empty">저장된 버전이 없습니다.<br><small>동기화 버튼을 눌러 클라우드에 저장하세요.</small></div>';
          return;
        }

        const versions = data.data.versions;
        this.$versionsList.innerHTML = versions.map(v => `
          <div class="version-item" data-version="${v.version}">
            <div class="version-info">
              <span class="version-number">v${v.version}</span>
              <span class="version-date">${new Date(v.createdAt).toLocaleString()}</span>
            </div>
            <div class="version-meta">
              <span class="version-size">${Math.round(v.contentLength / 1024 * 10) / 10}KB</span>
              ${v.changeSummary ? `<span class="version-summary">${v.changeSummary}</span>` : ''}
            </div>
            <button class="version-restore" data-version="${v.version}">복원</button>
          </div>
        `).join('');

        // Add restore click handlers
        this.$versionsList.querySelectorAll('.version-restore').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const version = parseInt(btn.dataset.version);
            if (version) this.restoreVersion(version);
          });
        });

      } catch (err) {
        console.error('Versions error:', err);
        this.$versionsList.innerHTML = '<div class="versions-empty">버전 로딩 실패</div>';
      }
    }

    closeVersions() {
      if (this.$versionsOverlay) {
        this.$versionsOverlay.style.display = 'none';
      }
      this.logEvent({ type: 'versions_close' });
    }

    async loadVersionsInline() {
      if (!this.$versionsInlineList) return;

      this.$versionsInlineList.innerHTML = '<div class="versions-empty">로딩 중...</div>';
      this.logEvent({ type: 'versions_tab_load' });

      const userId = this.getUserId();
      const apiBase = this.getApiBase();

      try {
        const res = await fetch(`${apiBase}/api/v1/memos/${encodeURIComponent(userId)}/versions?limit=20`);
        const data = await res.json();

        if (!data.ok || !data.data?.versions?.length) {
          this.$versionsInlineList.innerHTML = '<div class="versions-empty">저장된 버전이 없습니다.<br><small>동기화 버튼을 눌러 클라우드에 저장하세요.</small></div>';
          return;
        }

        const versions = data.data.versions;
        this.$versionsInlineList.innerHTML = versions.map(v => `
          <div class="version-item" data-version="${v.version}">
            <div class="version-info">
              <span class="version-number">v${v.version}</span>
              <span class="version-date">${new Date(v.createdAt).toLocaleString()}</span>
            </div>
            <div class="version-meta">
              <span class="version-size">${Math.round(v.contentLength / 1024 * 10) / 10}KB</span>
              ${v.changeSummary ? `<span class="version-summary">${v.changeSummary}</span>` : ''}
            </div>
            <button class="version-restore" data-version="${v.version}">복원</button>
          </div>
        `).join('');

        // Add restore click handlers
        this.$versionsInlineList.querySelectorAll('.version-restore').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const version = parseInt(btn.dataset.version);
            if (version) this.restoreVersion(version);
          });
        });

      } catch (err) {
        console.error('Versions inline error:', err);
        this.$versionsInlineList.innerHTML = '<div class="versions-empty">버전 로딩 실패</div>';
      }
    }

    async restoreVersion(version) {
      if (!confirm(`버전 ${version}을(를) 복원할까요?\n현재 메모가 덮어씌워집니다.`)) return;

      const userId = this.getUserId();
      const apiBase = this.getApiBase();

      this.out.setStatus('복원 중...');

      try {
        // First get the version content
        const getRes = await fetch(`${apiBase}/api/v1/memos/${encodeURIComponent(userId)}/versions/${version}`);
        const getData = await getRes.json();

        if (!getData.ok || !getData.data?.version?.content) {
          throw new Error('버전 데이터를 가져올 수 없습니다.');
        }

        // Apply to memo
        const content = getData.data.version.content;
        if (this.$memo) this.$memo.value = content;
        if (this.$memoEditor) this.$memoEditor.value = content;
        this.state.memo = content;
        LS.set(KEYS.memo, content);

        if (this.$memoPreview) {
          this.scheduleRenderPreview(content);
        }

        // Call restore endpoint to create a new version
        const restoreRes = await fetch(`${apiBase}/api/v1/memos/${encodeURIComponent(userId)}/restore/${version}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const restoreData = await restoreRes.json();

        this.closeVersions();
        this.out.toast(`버전 ${version} 복원됨`);
        this.logEvent({ type: 'version_restore', label: `v${version}`, newVersion: restoreData.data?.version });
      } catch (err) {
        console.error('Restore error:', err);
        this.out.toast(err?.message || '복원 실패');
      } finally {
        this.out.setStatus('Ready');
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
    // Code highlighting is deferred using requestIdleCallback for better performance
    renderMarkdownToPreview(src) {
      if (!this.$memoPreview) return;
      const html = this.markdownToHtml(src);
      this.$memoPreview.innerHTML = html;
      // Defer code highlighting to idle time to avoid blocking main thread
      this.scheduleCodeHighlight();
    }

    // Schedule code block enhancement during idle time
    scheduleCodeHighlight() {
      // Cancel any pending highlight task
      if (this._highlightIdleId) {
        (typeof cancelIdleCallback === 'function' ? cancelIdleCallback : clearTimeout)(this._highlightIdleId);
      }
      const doHighlight = () => {
        this._highlightIdleId = null;
        this.enhanceCodeBlocks();
      };
      // Use requestIdleCallback if available, otherwise fall back to setTimeout
      if (typeof requestIdleCallback === 'function') {
        this._highlightIdleId = requestIdleCallback(doHighlight, { timeout: 500 });
      } else {
        this._highlightIdleId = setTimeout(doHighlight, 50);
      }
    }

    applyLayoutMode(mode) {
      if (!this.$previewSplit) return;
      const layout = mode === 'tab' ? 'tab' : 'split';
      this.$previewSplit.setAttribute('data-layout', layout);
      if (layout === 'split') {
        this.$previewSplit.setAttribute('data-active-pane', 'editor');
      }
      if (this.$layoutSplit && this.$layoutTabs) {
        this.$layoutSplit.classList.toggle('active', layout === 'split');
        this.$layoutSplit.setAttribute('aria-pressed', layout === 'split' ? 'true' : 'false');
        this.$layoutTabs.classList.toggle('active', layout === 'tab');
        this.$layoutTabs.setAttribute('aria-pressed', layout === 'tab' ? 'true' : 'false');
      }
      if (this.$previewPaneToggle) {
        this.$previewPaneToggle.dataset.visible = layout === 'tab' ? 'true' : 'false';
      }
      this.state.layoutMode = layout;
      LS.set(KEYS.layoutMode, layout);
    }

    applyPreviewPane(pane) {
      if (!this.$previewSplit) return;
      const next = pane === 'preview' ? 'preview' : 'editor';
      this.$previewSplit.setAttribute('data-active-pane', next);
      if (Array.isArray(this.$previewPaneButtons)) {
        this.$previewPaneButtons.forEach(btn => {
          const active = btn.dataset.pane === next;
          btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
      }
      this.state.previewPane = next;
      LS.set(KEYS.previewPane, next);
      if (next === 'preview' && this.$memoPreview) {
        // Render any pending content or current content
        const src = this._pendingPreviewSrc || this.$memoEditor?.value || this.$memo?.value || '';
        this._pendingPreviewSrc = null;
        this.renderMarkdownToPreview(src);
      }
    }


    // Check if preview pane is actually visible
    isPreviewVisible() {
      // Preview is visible when:
      // 1. In preview mode with split layout, or
      // 2. In preview mode with tab layout AND preview pane is active
      const mode = this.state.mode;
      if (mode !== 'preview') return false;
      const layout = this.state.layoutMode;
      if (layout === 'split') return true;
      // tab layout: check active pane
      return this.state.previewPane === 'preview';
    }

    // debounce preview rendering to keep typing smooth
    // Only render if preview is actually visible
    scheduleRenderPreview(src) {
      clearTimeout(this._renderTimer);
      // Skip rendering if preview is not visible
      if (!this.isPreviewVisible()) {
        this._pendingPreviewSrc = src; // Store for later render when tab becomes active
        return;
      }
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
      this.out.tempStatus('미리보기 갱신', 'Ready');
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
      this.out.toast('feature.html 다운로드');
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
        <div class="bottom-app-bar"></div>
        <div id="launcher" class="launcher button" title="AI Memo" aria-label="AI Memo">📝</div>
        <div id="historyLauncher" class="launcher history button" title="History" aria-label="History">📖</div>
        <div id="historyOverlay" class="history-overlay" style="display:none;">
          <div class="history-toolbar">
            <div class="left">
              <strong>Web of Curiosity</strong>
              <span class="small" style="margin-left:8px; opacity:0.8;">Scroll: zoom • Drag: pan • Click: pin • Double-click post: open</span>
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
        <div id="versionsOverlay" class="versions-overlay" style="display:none;">
          <div class="versions-panel">
            <div class="versions-header">
              <strong>버전 기록</strong>
              <button id="versionsClose" class="btn-close" aria-label="닫기">✕</button>
            </div>
            <div id="versionsList" class="versions-list">
              <div class="versions-empty">로딩 중...</div>
            </div>
            <div class="versions-footer">
              <span class="versions-info">클라우드에 저장된 버전을 복원할 수 있습니다.</span>
            </div>
          </div>
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
            <div class="tab" data-tab="versions">버전</div>
            <div class="tab" data-tab="dev">새 버전 제안</div>
            <div class="tab" data-tab="settings">설정</div>
          </div>
          <div id="memoBody" class="body">
            <div class="section">
              <div class="memo-toolbar">
                <div class="toolbar-group format-group" role="toolbar" aria-label="서식">
                  <button id="memoBold" class="toolbar-btn" title="Bold (Ctrl+B)" aria-label="Bold"><span class="icon">B</span></button>
                  <button id="memoItalic" class="toolbar-btn" title="Italic (Ctrl+I)" aria-label="Italic"><span class="icon italic">I</span></button>
                  <button id="memoCode" class="toolbar-btn" title="Inline code" aria-label="Inline code"><span class="icon mono">{}</span></button>
                </div>
                <div class="toolbar-divider"></div>
                <div class="toolbar-group heading-group" role="toolbar" aria-label="제목">
                  <button id="memoH1" class="toolbar-btn" title="제목 1 (#)" aria-label="Heading 1"><span class="icon">H1</span></button>
                  <button id="memoH2" class="toolbar-btn" title="제목 2 (##)" aria-label="Heading 2"><span class="icon">H2</span></button>
                </div>
                <div class="toolbar-divider"></div>
                <div class="toolbar-group list-group" role="toolbar" aria-label="목록">
                  <button id="memoUl" class="toolbar-btn" title="글머리 기호 (-)" aria-label="Bullet list"><span class="icon">•─</span></button>
                  <button id="memoOl" class="toolbar-btn" title="번호 목록 (1.)" aria-label="Numbered list"><span class="icon">1.</span></button>
                </div>
                <div class="toolbar-spacer"></div>
                <div class="toolbar-group action-group" role="toolbar" aria-label="동작">
                  <button id="addSelection" class="toolbar-btn action" type="button" title="선택한 텍스트 추가" aria-label="선택 추가"><span class="icon">✂</span><span class="label">선택</span></button>
                  <button id="addBlock" class="toolbar-btn action" type="button" title="블록 선택 모드" aria-label="블록 추가"><span class="icon">▢</span><span class="label">블록</span></button>
                </div>
                <div class="toolbar-divider"></div>
                <div class="toolbar-group ai-group" role="toolbar" aria-label="AI 기능">
                  <button id="aiSummary" class="toolbar-btn ai" type="button" title="AI로 요약 생성" aria-label="AI 요약"><span class="icon">✦</span><span class="label">요약</span></button>
                  <button id="catalyst" class="toolbar-btn ai primary" type="button" title="Catalyst 프롬프트" aria-label="Catalyst"><span class="icon">⚡</span><span class="label">Catalyst</span></button>
                </div>
              </div>
              <div class="memo-hint">
                <span class="hint-text">Markdown 지원</span>
                <span class="hint-divider">•</span>
                <span class="hint-shortcut"><kbd>Alt</kbd>+<kbd>M</kbd> 토글</span>
                <span class="hint-divider">•</span>
                <span class="hint-shortcut"><kbd>/</kbd> 명령어</span>
              </div>
              <textarea id="memo" class="textarea" style="min-height:300px; height:300px;" placeholder="여기에 메모를 작성하세요...&#10;&#10;Tip: / 를 입력하면 서식 메뉴가 열립니다"></textarea>
            </div>
          </div>

          <div id="previewBody" class="body">
            <div class="preview-layout-bar">
              <div class="layout-toggle" role="group" aria-label="레이아웃 전환">
                <button id="layoutSplit" class="layout-btn" type="button" data-layout="split" aria-pressed="false">분할</button>
                <button id="layoutTabs" class="layout-btn" type="button" data-layout="tab" aria-pressed="false">탭</button>
              </div>
              <div id="previewPaneToggle" class="preview-pane-toggle" role="tablist" aria-label="미리보기 전환" data-visible="false">
                <button type="button" data-pane="editor" role="tab" aria-selected="false">편집</button>
                <button type="button" data-pane="preview" role="tab" aria-selected="false">미리보기</button>
              </div>
            </div>
            <div class="split" id="previewSplit" data-layout="split" data-active-pane="editor">
              <div class="split-left" data-pane="editor">
                <label class="label" for="memoEditor">편집기</label>
                <textarea id="memoEditor" class="textarea" placeholder="여기에 메모를 작성하세요"></textarea>
              </div>
              <div class="split-right" data-pane="preview">
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
            </div>
            <div class="small muted" style="margin-top:6px;">
              - 원문을 불러온 후 필요한 수정을 하고 PR을 생성하세요. PR에는 원본과의 관계가 frontmatter의 derivedFrom으로 표시됩니다.
            </div>
            <div class="section">
              <a id="prLink" class="small" target="_blank" rel="noopener" style="display:none;">PR 열기 →</a>
            </div>
          </div>

          <div id="settingsBody" class="body">
            <div class="section">
              <label class="label" for="inlineEnabled">문단 끝 ✨ 인라인 확장</label>
              <div class="row">
                <input id="inlineEnabled" type="checkbox" aria-label="문단 끝 인라인 확장" />
                <div class="small" style="opacity:0.8">글 본문 단락 끝에 ✨ 아이콘을 표시하고 아래로 결과를 펼칩니다.</div>
              </div>
            </div>
             <div class="section">
               <label class="label" for="closeAfterInject">주입 후 창 닫기</label>
               <div class="row">
                 <input id="closeAfterInject" type="checkbox" aria-label="생각 노드 주입 후 창 닫기" />
                 <div class="small" style="opacity:0.8">그래프에 주입이 완료되면 메모 패널을 닫습니다.</div>
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
             <div class="section">
               <label class="label" for="fabPosition">FAB 배치</label>
               <div class="row" style="gap:8px; align-items:flex-start;">
                 <select id="fabPosition" class="input">
                   <option value="bottom">하단 바</option>
                   <option value="left">좌측 사이드</option>
                 </select>
                 <div class="small" style="opacity:0.8">
                   채팅/메모 도크 위치를 선택합니다.
                 </div>
               </div>
             </div>
             <div class="section">
               <label class="label">패널 위치</label>
               <div class="row" style="gap:10px; align-items:flex-start;">
                 <button id="resetPosition" class="btn secondary" type="button">위치 초기화</button>
                 <div class="small" style="opacity:0.8">
                   화면이 작거나 패널이 보이지 않을 때 기본 위치로 되돌립니다.
                 </div>
               </div>
             </div>
          </div>

          <div id="versionsBody" class="body">
            <div class="section">
              <div class="versions-inline-header">
                <label class="label">클라우드 버전</label>
                <button id="versionsRefresh" class="btn secondary" type="button">새로고침</button>
              </div>
              <div id="versionsInlineList" class="versions-inline-list">
                <div class="versions-empty">버전 탭을 선택하면 로딩됩니다.</div>
              </div>
              <div class="versions-inline-footer">
                <span class="small muted">클라우드에 저장된 버전을 선택하여 복원할 수 있습니다.</span>
              </div>
            </div>
          </div>

          <div id="catalystBox" class="catalyst-panel" style="display:none;">
            <div class="catalyst-card">
              <div class="catalyst-header">
                <span class="catalyst-pill">
                  <span class="catalyst-icon">⚡</span>
                  <span class="catalyst-title">Catalyst</span>
                </span>
                <span class="catalyst-status">실험 기능</span>
              </div>
              <p class="catalyst-subtext">
                AI에게 확장 프롬프트를 전달해 요약, 인사이트, 액션 아이템 등을 빠르게 받아보세요.
              </p>
              <label class="catalyst-input-label" for="catalystInput">프롬프트</label>
              <div class="catalyst-input-shell">
                <span class="catalyst-input-indicator">/</span>
                <input
                  id="catalystInput"
                  class="input catalyst-input"
                  placeholder="어떻게 확장해볼까요? 예: 사용 사례 관점에서 다시 보기"
                  maxlength="160"
                />
                <span class="catalyst-input-hint">최대 160자</span>
              </div>
              <div class="catalyst-suggestions" aria-label="추천 프롬프트">
                <button type="button" class="catalyst-suggestion">사용 사례 정리</button>
                <button type="button" class="catalyst-suggestion">톤 조정</button>
                <button type="button" class="catalyst-suggestion">액션 아이템</button>
              </div>
              <div class="catalyst-actions">
                <button id="catalystCancel" class="btn secondary">취소</button>
                <button id="catalystRun" class="btn catalyst-run"><span class="catalyst-run-icon">▶</span> 생성</button>
              </div>
            </div>
          </div>
          <div class="footer">
            <div id="status" class="status-bar">
              <span class="status-dot"></span>
              <span class="status-text">Ready</span>
            </div>
            <div class="footer-actions">
              <button id="memoSync" class="footer-btn" type="button" title="클라우드 동기화" aria-label="클라우드 동기화" data-tooltip="클라우드 동기화">
                <span class="btn-icon">☁</span>
              </button>
              <button id="memoVersions" class="footer-btn" type="button" title="버전 기록" aria-label="버전 기록" data-tooltip="버전 기록">
                <span class="btn-icon">⏱</span>
              </button>
              <button id="memoToGraph" class="footer-btn" type="button" title="그래프에 추가" aria-label="그래프에 추가" data-tooltip="그래프에 추가">
                <span class="btn-icon">◉</span>
              </button>
              <button id="download" class="footer-btn" type="button" title="다운로드" aria-label="메모 다운로드" data-tooltip="메모 다운로드">
                <span class="btn-icon">↓</span>
              </button>
              <button id="memoFull" class="footer-btn" type="button" title="전체화면" aria-label="전체화면" data-tooltip="전체화면 전환">
                <span class="btn-icon">⛶</span>
              </button>
              <button id="memoClear" class="footer-btn danger" type="button" title="지우기" aria-label="지우기" data-tooltip="메모 지우기">
                <span class="btn-icon">✕</span>
              </button>
            </div>
          </div>
          <div id="toast" class="toast"></div>
        </div>
      `;
      this.shadowRoot.appendChild(doc);
      // Ensure fixed positioning even if stylesheet hasn't loaded yet (or fails)
      this.injectCriticalStyles();
      // Robustly ensure full styles get applied in browsers that ignore <link> in shadow DOM
      this.ensureStylesLoaded();

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
      this.$versionsBody = this.shadowRoot.getElementById('versionsBody');
      this.$memo = this.shadowRoot.getElementById('memo');
      this.$memoEditor = this.shadowRoot.getElementById('memoEditor');
      this.$memoPreview = this.shadowRoot.getElementById('memoPreview');
      this.$previewSplit = this.shadowRoot.getElementById('previewSplit');
      this.$layoutSplit = this.shadowRoot.getElementById('layoutSplit');
      this.$layoutTabs = this.shadowRoot.getElementById('layoutTabs');
      this.$previewPaneToggle = this.shadowRoot.getElementById('previewPaneToggle');
      this.$previewPaneButtons = Array.from(
        this.shadowRoot.querySelectorAll('#previewPaneToggle button')
      );
      this.$fontSize = this.shadowRoot.getElementById('fontSize');
      this.$fabPosition = this.shadowRoot.getElementById('fabPosition');
      this.$inlineEnabled = this.shadowRoot.getElementById('inlineEnabled');
      this.$closeAfterInject = this.shadowRoot.getElementById('closeAfterInject');
      this.$resetPosition = this.shadowRoot.getElementById('resetPosition');
      this.$memoBold = this.shadowRoot.getElementById('memoBold');
      this.$memoItalic = this.shadowRoot.getElementById('memoItalic');
      this.$memoCode = this.shadowRoot.getElementById('memoCode');
      this.$memoH1 = this.shadowRoot.getElementById('memoH1');
      this.$memoH2 = this.shadowRoot.getElementById('memoH2');
      this.$memoUl = this.shadowRoot.getElementById('memoUl');
      this.$memoOl = this.shadowRoot.getElementById('memoOl');
      this.$memoFull = this.shadowRoot.getElementById('memoFull');

      this.$memoClear = this.shadowRoot.getElementById('memoClear');
      this.$addBlock = this.shadowRoot.getElementById('addBlock');

      this.$originalPath = this.shadowRoot.getElementById('originalPath');
      this.$proposalMd = this.shadowRoot.getElementById('proposalMd');
      this.$loadOriginalMd = this.shadowRoot.getElementById('loadOriginalMd');
      this.$proposeNewVersion =
        this.shadowRoot.getElementById('proposeNewVersion');
      this.$prLink = this.shadowRoot.getElementById('prLink');
      this.$status = this.shadowRoot.getElementById('status');
      this.$addSel = this.shadowRoot.getElementById('addSelection');
      this.$memoToGraph = this.shadowRoot.getElementById('memoToGraph');
      this.$aiSummary = this.shadowRoot.getElementById('aiSummary');
      this.$catalystBtn = this.shadowRoot.getElementById('catalyst');
      this.$catalystBox = this.shadowRoot.getElementById('catalystBox');
      this.$catalystInput = this.shadowRoot.getElementById('catalystInput');
      this.$catalystRun = this.shadowRoot.getElementById('catalystRun');
      this.$catalystCancel = this.shadowRoot.getElementById('catalystCancel');
      this.$catalystSuggestions = Array.from(
        this.shadowRoot.querySelectorAll('.catalyst-suggestion')
      );
      this.$download = this.shadowRoot.getElementById('download');
      this.$toast = this.shadowRoot.getElementById('toast');
    }

    createBlockHighlighter() {
      if (document.getElementById('ai-memo-highlighter')) return;
      const overlay = document.createElement('div');
      overlay.id = 'ai-memo-highlighter';
      Object.assign(overlay.style, {
        display: 'none',
        position: 'absolute',
        zIndex: '2147483646',
        backgroundColor: 'rgba(99, 102, 241, 0.18)',
        border: '1.5px solid rgba(99, 102, 241, 0.7)',
        borderRadius: '6px',
        boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.45)',
        pointerEvents: 'none',
        transition: 'top 120ms ease, left 120ms ease, width 120ms ease, height 120ms ease',
        willChange: 'top, left, width, height',
      });
      document.body.appendChild(overlay);
    }

    destroyBlockHighlighter() {
      const overlay = document.getElementById('ai-memo-highlighter');
      if (overlay) overlay.remove();
      this.highlightedBlock = null;
    }

    toggleBlockSelectMode(force) {
      const next = typeof force === 'boolean' ? force : !this.isBlockSelectMode;
      if (next === this.isBlockSelectMode) return;
      this.isBlockSelectMode = next;

      if (document.body) {
        document.body.classList.toggle('ai-memo-block-select-active', next);
        if (!next && this._prevCursor) {
          document.body.style.cursor = this._prevCursor;
          this._prevCursor = '';
        } else if (next) {
          this._prevCursor = document.body.style.cursor || '';
          document.body.style.cursor = 'crosshair';
        }
      }
      if (this.$panel) this.$panel.classList.toggle('selecting-block', next);

      if (next) {
        this.out.tempStatus('추가할 블록을 클릭하세요 (ESC 취소)', 'Ready', 2400);
        this.createBlockHighlighter();
        document.addEventListener('mousemove', this._boundBlockHighlight, { capture: true, passive: true });
        document.addEventListener('click', this._boundBlockCapture, true);
        document.addEventListener('keydown', this._boundBlockKeydown, true);
      } else {
        document.removeEventListener('mousemove', this._boundBlockHighlight, true);
        document.removeEventListener('click', this._boundBlockCapture, true);
        document.removeEventListener('keydown', this._boundBlockKeydown, true);
        this.destroyBlockHighlighter();
      }
    }

    handleBlockHighlight(event) {
      if (!this.isBlockSelectMode) return;
      this.createBlockHighlighter();
      const overlay = document.getElementById('ai-memo-highlighter');
      if (!overlay) return;

      overlay.style.display = 'none';
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!target || target.closest('ai-memo-pad') || target.id === 'ai-memo-highlighter') {
        this.highlightedBlock = null;
        return;
      }

      const block = target.closest(BLOCK_SELECTORS);
      if (!block) {
        this.highlightedBlock = null;
        return;
      }

      this.highlightedBlock = block;
      const rect = block.getBoundingClientRect();
      overlay.style.display = 'block';
      overlay.style.top = `${rect.top + window.scrollY}px`;
      overlay.style.left = `${rect.left + window.scrollX}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
    }

    handleBlockCapture(event) {
      if (!this.isBlockSelectMode || !this.highlightedBlock) return;
      if ('button' in event && event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      if (!this._turndown) {
        this.out.toast('Markdown 변환기를 로드 중입니다. 잠시 후 다시 시도하세요.');
        this.toggleBlockSelectMode(false);
        return;
      }

      try {
        const html = this.highlightedBlock.outerHTML;
        const markdown = this._turndown.turndown(html || '');
        if (markdown.trim()) {
          this.out.append(`\n\n${markdown.trim()}\n`);
          this.out.toast('선택한 블록을 메모에 추가했습니다.');
          this.logEvent({ type: 'add_block', label: 'block', content: markdown.slice(0, 2000) });
        } else {
          this.out.toast('추가할 내용이 없습니다.');
        }
      } catch (err) {
        console.error('Block capture failed', err);
        this.out.toast('블록을 추가하지 못했습니다.');
      }

      this.toggleBlockSelectMode(false);
    }

    handleBlockKeydown(event) {
      if (!this.isBlockSelectMode) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        this.out.tempStatus('블록 선택 모드를 종료합니다.', 'Ready', 1400);
        this.toggleBlockSelectMode(false);
      }
    }

    // Inject minimal critical styles as a safety net so the UI stays fixed and scoped
    // Always inject these styles to guarantee positioning even before external CSS loads
    injectCriticalStyles() {
      try {
        // Always inject critical styles to ensure fixed positioning is applied immediately
        // This prevents the panel from appearing in the document flow while CSS loads
        const existing = this.shadowRoot?.querySelector('style[data-ai-memo="critical"]');
        if (existing) return; // Already injected
        
        const style = document.createElement('style');
        style.setAttribute('data-ai-memo', 'critical');
        style.textContent = `
          :host { all: initial; display: contents; }
          .launcher { position: fixed !important; right: 16px; bottom: calc(96px + env(safe-area-inset-bottom, 0px)); z-index: 2147483647; }
          .launcher.history { bottom: calc(152px + env(safe-area-inset-bottom, 0px)); }
          .panel { 
            position: fixed !important; 
            z-index: 2147483647; 
            right: 20px; 
            bottom: calc(100px + env(safe-area-inset-bottom, 0px)); 
            display: none;
            width: 400px;
            max-width: min(480px, calc(100vw - 32px));
            height: min(520px, calc(100dvh - 100px));
            max-height: calc(100dvh - 80px);
          }
          .panel.open { display: flex; flex-direction: column; }
          .history-overlay { position: fixed !important; inset: 0; z-index: 2147483647; display: none; }
          .versions-overlay { position: fixed !important; inset: 0; z-index: 2147483647; display: none; }
        `;
        this.shadowRoot.prepend(style); // Prepend so external CSS can override if loaded
      } catch (_) {}
    }

    // Load and attach the full CSS into the shadow root if the external <link> failed
    ensureStylesLoaded() {
      try {
        const root = this.shadowRoot;
        const panel = root && root.getElementById('panel');
        if (!panel) return;
        const ok = () => getComputedStyle(panel).position === 'fixed';
        if (ok()) return; // already styled

        const attachText = (cssText) => {
          try {
            if (root.adoptedStyleSheets && 'replaceSync' in CSSStyleSheet.prototype) {
              const sheet = new CSSStyleSheet();
              sheet.replaceSync(cssText);
              root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
            } else {
              const style = document.createElement('style');
              style.textContent = cssText;
              root.appendChild(style);
            }
          } catch (_) {}
        };

        // Fetch CSS and inline it
        fetch('/ai-memo/ai-memo.css')
          .then((r) => (r.ok ? r.text() : ''))
          .then((txt) => { if (txt) attachText(txt); })
          .catch(() => {});
      } catch (_) {}
    }

    restore() {
      // content
      this.$memo.value = this.state.memo || '';
      if (this.$memoEditor) this.$memoEditor.value = this.state.memo || '';
      if (this.$inlineEnabled)
        this.$inlineEnabled.checked = !!this.state.inlineEnabled;
      if (this.$closeAfterInject)
        this.$closeAfterInject.checked = !!this.state.closeAfterInject;
      if (this.$fontSize) {
        const fs = parseInt(this.state.fontSize || 13, 10);
        this.$fontSize.value = String(fs);
        this.applyFontSize(fs);
      }
      if (this.$fabPosition) {
        this.$fabPosition.value = this.state.fabPosition === 'left' ? 'left' : 'bottom';
      }

      // panel open
      this.$panel.classList.toggle('open', !!this.state.isOpen);

      // position - Reset to CSS defaults to prevent panel appearing outside viewport
      // Always use CSS default positioning (right: 20px, bottom: 100px) instead of saved position
      // This ensures panel always starts in a safe visible location
      this.state.position = { x: null, y: null };
      LS.set(KEYS.position, { x: null, y: null });
      // Explicitly set position to ensure panel is visible even if CSS hasn't loaded
      Object.assign(this.$panel.style, {
        left: '',
        top: '',
        right: '20px',
        bottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
        position: 'fixed',
      });

      // dev content
      if (this.$proposalMd)
        this.$proposalMd.value = this.state.proposalMd || '';

      // announce aria labels for important actions (a11y)
      if (this.$memoToGraph) this.$memoToGraph.setAttribute('aria-label', '그래프에 추가');
      if (this.$aiSummary) this.$aiSummary.setAttribute('aria-label', 'AI 요약');
      if (this.$download) this.$download.setAttribute('aria-label', '메모 다운로드');

      // mode
      this.$tabs.forEach(t =>
        t.classList.toggle('active', t.dataset.tab === this.state.mode)
      );
      this.updateMode();
     }

     // ===== History: event logging & overlay =====
     logEvent(evt) {
       try {
         if (!evt || (evt.type && NOISY_EVENT_TYPES.has(evt.type))) return null;
         const info = this.getCurrentPostInfo();
         const base = {
           t: Date.now(),
           page: { url: location.href, title: document.title, post: info || null },
         };
         const rec = Object.assign(base, evt || {});
         if (!rec.label && rec.type) {
           rec.label = rec.type;
         }
         
         let currentEvents = LS.get(KEYS.events, []);
         if (!Array.isArray(currentEvents)) currentEvents = [];
         
         currentEvents.push(rec);
         if (currentEvents.length > 500) currentEvents = currentEvents.slice(currentEvents.length - 500);
         
         this.state.events = currentEvents;
         LS.set(KEYS.events, currentEvents);
         
         this._graphCache = null;
         this._graphCacheKey = null;
         
         window.dispatchEvent(new CustomEvent('aiMemo:eventsChanged'));
         
         return rec;
       } catch (_) { return null; }
     }

       openHistory() {
         if (!this.$historyOverlay || !this.$historyCanvas) return;
         this.$historyOverlay.style.display = 'block';
         this._hist = this._hist || { scale: 1, tx: 0, ty: 0, dragging: false };
         this._hist.hoverId = null; this._hist.pinnedId = null;
         this.resizeHistoryCanvas();
         this.drawHistory();
         this.attachHistoryInteractions();
         this.hideHistoryTooltip();
         this.closeHistoryInfo();
         this.logEvent({ type: 'history_open', label: '히스토리 열기' });
       }
       closeHistory() {
         if (!this.$historyOverlay) return;
         this.$historyOverlay.style.display = 'none';
         this.detachHistoryInteractions();
         this.hideHistoryTooltip();
         this.closeHistoryInfo();
         if (this._hist) { this._hist.hoverId = null; this._hist.pinnedId = null; }
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
           this._hist.mouseX = e.clientX; this._hist.mouseY = e.clientY;
           const factor = deltaY < 0 ? 1.1 : 0.9;
           const { scale, tx, ty } = this._hist;
           const x = (offsetX - tx) / scale; const y = (offsetY - ty) / scale;
           const ns = Math.max(0.3, Math.min(3, scale * factor));
           this._hist.scale = ns;
           this._hist.tx = offsetX - x * ns; this._hist.ty = offsetY - y * ns;
           this.scheduleHistoryDraw();
           if (this._hist.mouseX != null && this._hist.mouseY != null) {
             const rect = c.getBoundingClientRect();
             const mx = this._hist.mouseX - rect.left; const my = this._hist.mouseY - rect.top;
             const g = this._histGraph || this.layoutGraph(this.buildGraph());
             const xw = (mx - this._hist.tx) / ns; const yw = (my - this._hist.ty) / ns;
             const hit = this.hitTestHistoryNode(g, xw, yw);
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
            const rect = c.getBoundingClientRect();
            const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
            const x = (mx - this._hist.tx) / (this._hist.scale||1);
            const y = (my - this._hist.ty) / (this._hist.scale||1);
            const g = this._histGraph || this.layoutGraph(this.buildGraph());
            const hit = this.hitTestHistoryNode(g, x, y);
            if (!this._hist?.pinnedId) {
              const prev = this._hist.hoverId;
              this._hist.hoverId = hit ? hit.id : null;
              if (prev !== this._hist.hoverId) this.drawHistory();
            }
            this.updateHistoryTooltip(hit, e.clientX, e.clientY);
            c.style.cursor = hit ? 'pointer' : 'grab';
          }
        };
        const onUp = () => { this._hist.dragging = false; c.classList.remove('grabbing'); };
       const onKey = (e) => { if (e.key === 'Escape') this.closeHistory(); };
       this._histListeners = { onMove, onUp, onResize, onKey };
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
          const hit = this.hitTestHistoryNode(g, x, y);
          if (!hit) return;
          // pin selection and show info
          this._hist.pinnedId = hit.id;
          this.updateHistoryInfo(hit, true);
          if (hit.kind === 'post' || hit.kind === 'post_node') {
            // smooth center on node
            this.centerHistoryOn(hit, { animate: true });
          }
          this.drawHistory();
        };
        const onDblClick = (e) => {
          const rect = c.getBoundingClientRect();
          const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
          const x = (mx - this._hist.tx) / (this._hist.scale||1);
          const y = (my - this._hist.ty) / (this._hist.scale||1);
          const g = this._histGraph || this.layoutGraph(this.buildGraph());
          const hit = this.hitTestHistoryNode(g, x, y);
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
          this.$historyReset?.addEventListener('click', () => { if (!confirm('히스토리 기록을 모두 삭제할까요?')) return; this.state.events = []; LS.set(KEYS.events, []); this._graphCache = null; this._graphCacheKey = null; if (this._hist) { this._hist.hoverId = null; this._hist.pinnedId = null; } this.hideHistoryTooltip(); this.closeHistoryInfo(); this.drawHistory(); this.out.toast('기록을 초기화했습니다.'); this.logEvent({ type: 'history_reset', label: '히스토리 초기화' }); });
         this.$historyExport?.addEventListener('click', () => {
           try {
             const data = { exportedAt: new Date().toISOString(), events: this.state.events || [] };
             const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
             const url = URL.createObjectURL(blob);
             const a = document.createElement('a');
             a.href = url; a.download = 'ai-memo-history.json';
             document.body.appendChild(a); a.click(); a.remove();
             URL.revokeObjectURL(url);
             this.out.toast('히스토리를 내보냈습니다.');
             this.logEvent({ type: 'download_history', label: '히스토리 내보내기' });
           } catch (_) { this.out.toast('내보내기에 실패했습니다.'); }
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
                  // Invalidate graph cache
                  this._graphCache = null;
                  this._graphCacheKey = null;
                  this.drawHistory();
                 this.out.toast('히스토리를 가져왔습니다.');
                 this.logEvent({ type: 'history_import', label: '히스토리 가져오기' });
               } catch (err) {
                 console.error('history import error:', err);
                 this.out.toast('가져오기에 실패했습니다.');
               } finally {
                 input.remove();
               }
             }, { once: true });
             input.click();
           } catch (_) {
             this.out.toast('가져오기 시작에 실패했습니다.');
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
         
         // Cache check: use cached graph if events haven't changed
         const eventsKey = events.length + ':' + (events[events.length - 1]?.t || 0);
         if (this._graphCache && this._graphCacheKey === eventsKey) {
           return this._graphCache;
         }
         
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
         
         const graph = { nodes, edges };
         // Cache the result
         this._graphCache = graph;
         this._graphCacheKey = eventsKey;
         return graph;
       }

      layoutGraph(graph) {
        // Cache check: use cached layout if graph and viewport haven't changed
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const layoutKey = `${graph.nodes.length}:${vw}:${vh}`;
        if (this._layoutCache && this._layoutCacheKey === layoutKey && this._layoutCacheGraph === graph) {
          return this._layoutCache;
        }
        
        const { nodes, edges } = graph; const C = { postR: 36, evR: 16 };
        const byKind = (k) => nodes.filter(n => n.kind === k || (k==='event' && n.kind!=='post'));
        const posts = byKind('post'); const events = nodes.filter(n => n.kind!=='post');
        const cx = vw/2, cy = vh/2;
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
        
        // Cache the result
        this._layoutCache = graph;
        this._layoutCacheKey = layoutKey;
        this._layoutCacheGraph = graph;
        return graph;
      }

      hitTestHistoryNode(graph, x, y) {
        for (let i = graph.nodes.length - 1; i >= 0; i--) {
          const n = graph.nodes[i];
          const r = n.r || 16;
          const dx = x - n.x;
          const dy = y - n.y;
          if (n.kind === 'thought') {
            const w = r * 2.6; const h = r * 1.6;
            if (Math.abs(dx) <= w / 2 && Math.abs(dy) <= h / 2) return n;
          } else if (n.kind === 'ai_summary_done' || n.kind === 'catalyst_run') {
            if (Math.abs(dx) + Math.abs(dy) <= r) return n;
          } else {
            if (dx * dx + dy * dy <= r * r) return n;
          }
        }
        return null;
      }

      scheduleHistoryDraw() { if (this._histDrawReq) return; this._histDrawReq = requestAnimationFrame(() => { this._histDrawReq = null; this.drawHistory(); }); }

      drawHistory() {
        const c = this.$historyCanvas; if (!c) return; const ctx = c.getContext('2d');
        const { scale, tx, ty } = this._hist || { scale:1, tx:0, ty:0 };
        ctx.save(); ctx.clearRect(0,0,c.width,c.height); ctx.translate(tx, ty); ctx.scale(scale, scale);
        const graph = this.layoutGraph(this.buildGraph());
        this._histGraph = graph;

        const isDark = this.classList.contains('dark');
        const theme = isDark ? {
          edge: 'rgba(148,163,184,0.45)',
          postFill: '#0f172a',
          postStroke: 'rgba(255,255,255,0.08)',
          postLabel: '#e5e7eb',
          thoughtFill: '#fef08a',
          thoughtStroke: 'rgba(250,204,21,0.6)',
          thoughtLabel: '#713f12',
          aiFill: '#c4b5fd',
          aiStroke: 'rgba(124,58,237,0.6)',
          aiLabel: '#eae4ff',
          eventFill: '#60a5fa',
          eventStroke: 'rgba(96,165,250,0.4)',
          eventLabel: '#0b1220',
          hiDefault: '#93c5fd',
          hiPost: '#fcd34d',
          hiThought: '#f59e0b',
          hiAI: '#c084fc',
          connector: 'rgba(148,163,184,0.5)'
        } : {
          edge: 'rgba(100,116,139,0.6)',
          postFill: '#111827',
          postStroke: 'rgba(0,0,0,0.2)',
          postLabel: '#ffffff',
          thoughtFill: '#fef08a',
          thoughtStroke: 'rgba(250,204,21,0.6)',
          thoughtLabel: '#713f12',
          aiFill: '#c4b5fd',
          aiStroke: 'rgba(124,58,237,0.6)',
          aiLabel: '#1f1147',
          eventFill: '#1d4ed8',
          eventStroke: 'rgba(29,78,216,0.3)',
          eventLabel: '#0b1020',
          hiDefault: '#93c5fd',
          hiPost: '#fcd34d',
          hiThought: '#f59e0b',
          hiAI: '#c084fc',
          connector: 'rgba(148,163,184,0.5)'
        };

        // helpers for shapes
        const drawDiamond = (x, y, r, fill, stroke, lw=2) => {
          ctx.beginPath();
          ctx.moveTo(x, y - r);
          ctx.lineTo(x + r, y);
          ctx.lineTo(x, y + r);
          ctx.lineTo(x - r, y);
          ctx.closePath();
          ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.fill(); ctx.stroke();
        };
        const drawRoundedRect = (cx, cy, w, h, rad, fill, stroke, lw=2) => {
          const x = cx - w/2, y = cy - h/2; const r = Math.min(rad, w/2, h/2);
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + w, y, x + w, y + h, r);
          ctx.arcTo(x + w, y + h, x, y + h, r);
          ctx.arcTo(x, y + h, x, y, r);
          ctx.arcTo(x, y, x + w, y, r);
          ctx.closePath();
          ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.fill(); ctx.stroke();
        };

        // draw edges and nodes with theme-aware styles
        const byId = Object.create(null);
        for (const n of graph.nodes) byId[n.id] = n;

        const hoveredId = (this._hist && (this._hist.pinnedId || this._hist.hoverId)) || null;

        // edges first (under nodes)
        ctx.lineCap = 'round';
        for (const e of graph.edges) {
          const a = byId[e.a];
          const b = byId[e.b];
          if (!a || !b) continue;
          const isActive = hoveredId && (hoveredId === a.id || hoveredId === b.id);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = isActive ? theme.connector : theme.edge;
          ctx.lineWidth = isActive ? 2.4 : 1.4;
          ctx.stroke();
        }

        // node helpers
        const drawCircle = (x, y, r, fill, stroke, lw = 2) => {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = fill;
          ctx.strokeStyle = stroke;
          ctx.lineWidth = lw;
          ctx.fill();
          ctx.stroke();
        };
        const strokeRoundedRect = (cx, cy, w, h, rad, color, lw=4) => {
          const x = cx - w/2, y = cy - h/2; const r = Math.min(rad, w/2, h/2);
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + w, y, x + w, y + h, r);
          ctx.arcTo(x + w, y + h, x, y + h, r);
          ctx.arcTo(x, y + h, x, y, r);
          ctx.arcTo(x, y, x + w, y, r);
          ctx.closePath();
          ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
        };

        // nodes
        for (const n of graph.nodes) {
          const r = n.r || 16;
          let fill = theme.eventFill;
          let stroke = theme.eventStroke;
          if (n.kind === 'post') { fill = theme.postFill; stroke = theme.postStroke; }
          else if (n.kind === 'thought') { fill = theme.thoughtFill; stroke = theme.thoughtStroke; }
          else if (n.kind === 'ai_summary_done' || n.kind === 'catalyst_run') { fill = theme.aiFill; stroke = theme.aiStroke; }

          if (n.kind === 'thought') {
            const w = r * 2.6, h = r * 1.6;
            drawRoundedRect(n.x, n.y, w, h, 10, fill, stroke, 2);
          } else if (n.kind === 'ai_summary_done' || n.kind === 'catalyst_run') {
            drawDiamond(n.x, n.y, r, fill, stroke, 2);
          } else {
            drawCircle(n.x, n.y, r, fill, stroke, 2);
          }
        }

        // labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const truncate = (s, max) => (s && s.length > max) ? s.slice(0, max - 1) + '…' : (s || '');
        for (const n of graph.nodes) {
          const r = n.r || 16;
          let color = theme.eventLabel;
          let font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
          let y = n.y;
          if (n.kind === 'post') { color = theme.postLabel; font = 'bold 13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'; }
          else if (n.kind === 'thought') { color = theme.thoughtLabel; }
          else if (n.kind === 'ai_summary_done' || n.kind === 'catalyst_run') { color = theme.aiLabel; }

          ctx.fillStyle = color;
          ctx.font = font;
          const label = n.kind === 'post' ? truncate(n.label, 28) : truncate(n.label, 22);
          ctx.fillText(label, n.x, y);
        }

        // highlight pinned/hovered and emphasize connectors
        const hilite = (node) => {
          if (!node) return;
          const color = (node.kind === 'post') ? theme.hiPost : (node.kind === 'thought') ? theme.hiThought : ((node.kind === 'ai_summary_done' || node.kind === 'catalyst_run') ? theme.hiAI : theme.hiDefault);
          // emphasize connectors
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = 3.2;
          ctx.globalAlpha = 0.95;
          for (const e of graph.edges) {
            if (e.a === node.id || e.b === node.id) {
              const a = byId[e.a]; const b = byId[e.b];
              if (!a || !b) continue;
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
          }
          ctx.restore();

          // halo around node
          const r = node.r || 16;
          ctx.save();
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.6;
          if (node.kind === 'thought') {
            const w = r * 2.6 + 12; const h = r * 1.6 + 10;
            strokeRoundedRect(node.x, node.y, w, h, 12, color, 6);
          } else if (node.kind === 'ai_summary_done' || node.kind === 'catalyst_run') {
            const rr = r + 8;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y - rr);
            ctx.lineTo(node.x + rr, node.y);
            ctx.lineTo(node.x, node.y + rr);
            ctx.lineTo(node.x - rr, node.y);
            ctx.closePath();
            ctx.lineWidth = 6; ctx.stroke();
          } else {
            ctx.beginPath(); ctx.arc(node.x, node.y, r + 8, 0, Math.PI * 2); ctx.lineWidth = 6; ctx.stroke();
          }
          ctx.restore();
        };

        const pinned = this._hist?.pinnedId && graph.nodes.find(n => n.id === this._hist.pinnedId);
        if (pinned) hilite(pinned); else if (this._hist && this._hist.hoverId) { const hn = graph.nodes.find(n => n.id === this._hist.hoverId); hilite(hn); }
        ctx.restore();
      }

      updateOpen() {
        const isOpen = this.$panel.classList.contains('open');
        LS.set(KEYS.isOpen, isOpen);
        this.state.isOpen = isOpen;
        
        const isMobile = window.innerWidth <= 640;
        if (isMobile) {
          isOpen ? this.lockBodyScroll() : this.restoreBodyScroll();
        }
        
        if (isOpen) {
          requestAnimationFrame(() => {
            const rect = this.$panel.getBoundingClientRect();
            const { x, y } = this.clamp(rect.left, rect.top);
            if (x == null || y == null) {
              // Reset to CSS defaults if position is invalid
              Object.assign(this.$panel.style, {
                left: '',
                top: '',
                right: '',
                bottom: '',
              });
              this.state.position = { x: null, y: null };
              LS.set(KEYS.position, { x: null, y: null });
            }
          });
        }
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
            lines.push('Click: pin • Double-click: open');
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
            if (node.kind === 'thought' && ev?.content) {
              const snip = String(ev.content).replace(/\s+/g, ' ').trim().slice(0, 100);
              if (snip) lines.push(`“${snip}${ev.content.length > 100 ? '…' : ''}”`);
            }
          }
        tip.textContent = lines.join(' • ');
        tip.style.left = Math.round(clientX + 12) + 'px';
        tip.style.top = Math.round(clientY + 12) + 'px';
        return tip;
      }

      hideHistoryTooltip() {
        if (this.$historyTooltip) { this.$historyTooltip.remove(); this.$historyTooltip = null; }
      }

      // Bottom info panel for pinned node
      updateHistoryInfo(node, pinned = true) {
        if (!node) return this.closeHistoryInfo();
        let box = this.$historyInfo;
        if (!box) {
          box = document.createElement('div');
          box.className = 'history-info';
          box.innerHTML = `
            <div class="history-info-toolbar">
              <div class="left">
                <div class="history-info-title"></div>
                <div class="history-info-meta"></div>
              </div>
              <div class="right">
                <button class="btn secondary" data-action="open" style="display:none;">열기</button>
                <button class="btn" data-action="unpin">고정 해제</button>
              </div>
            </div>
            <div class="history-info-body"></div>
          `;
          this.$historyInfo = box;
          this.shadowRoot.appendChild(box);
          // actions
          box.querySelector('[data-action="unpin"]').addEventListener('click', () => {
            if (this._hist) this._hist.pinnedId = null; this.closeHistoryInfo(); this.drawHistory();
          });
          box.querySelector('[data-action="open"]').addEventListener('click', () => {
            const n = this._histGraph?.nodes?.find(nn => nn.id === this._hist?.pinnedId) || node;
            if (n && (n.kind === 'post' || n.kind === 'post_node')) {
              const p = n.meta?.post; if (p) { const href = `#/blog/${p.year}/${p.slug}`; try { window.location.hash = href.replace(/^#/, ''); } catch (_) { window.location.href = href; } this.closeHistory(); }
            }
          });
        }
        const titleEl = box.querySelector('.history-info-title');
        const metaEl = box.querySelector('.history-info-meta');
        const bodyEl = box.querySelector('.history-info-body');
        const openBtn = box.querySelector('[data-action="open"]');

        if (node.kind === 'post') {
          const p = node.meta?.post;
          titleEl.textContent = node.label || `${p?.year}/${p?.slug}`;
          metaEl.textContent = p ? `${p.year}/${p.slug}` : '';
          openBtn.style.display = '';
          // list events for this post
          const key = p ? `${p.year}/${p.slug}` : '';
          const rows = (this.state.events || []).filter(ev => ev?.page?.post && `${ev.page.post.year}/${ev.page.post.slug}` === key)
            .sort((a,b)=> (a.t||0) - (b.t||0))
            .map(ev => {
              const dt = new Date(ev.t).toLocaleString();
              const lbl = ev.label || ev.type;
              return `<li><span class="dt">${dt}</span><span class="sep">•</span><span class="lbl">${lbl}</span></li>`;
            }).join('');
          bodyEl.innerHTML = rows ? `<ul class="history-info-list">${rows}</ul>` : '<div class="small">이 글과 연결된 이벤트가 없습니다.</div>';
        } else if (node.kind === 'thought') {
          const ev = node.meta?.ev || {};
          const firstLine = (ev.label || '').trim();
          titleEl.textContent = firstLine || 'Thought';
          const p = ev?.page?.post; const when = ev.t ? new Date(ev.t).toLocaleString() : '';
          metaEl.textContent = [when, p ? `${p.year}/${p.slug}` : null].filter(Boolean).join(' • ');
          openBtn.style.display = 'none';
          const content = (ev.content || '').toString();
          bodyEl.innerHTML = content ? `<div class="history-info-kv"><div><b>내용</b>${this.markdownToHtml(content)}</div></div>` : '<div class="small">내용 없음</div>';
        } else {
          const ev = node.meta?.ev || {};
          titleEl.textContent = ev.label || ev.type || '이벤트';
          const p = ev?.page?.post; const when = ev.t ? new Date(ev.t).toLocaleString() : '';
          metaEl.textContent = [when, p ? `${p.year}/${p.slug}` : null, ev.type ? `type: ${ev.type}` : null].filter(Boolean).join(' • ');
          openBtn.style.display = 'none';
          bodyEl.innerHTML = '<div class="small">연결 정보</div>';
        }
        return box;
      }

      closeHistoryInfo() {
        if (this.$historyInfo) { this.$historyInfo.remove(); this.$historyInfo = null; }
      }


     updateMode() {
      const active = this.shadowRoot.querySelector('.tab.active');
      const mode = active ? active.dataset.tab : 'memo';
      LS.set(KEYS.mode, mode);
      this.state.mode = mode;
      const previewMode = mode === 'preview';
      if (this.$panel) this.$panel.classList.toggle('preview-mode', previewMode);
      this.classList.toggle('preview-mode', previewMode);
      if (mode === 'dev') {
        this.maybeLoadOriginalMarkdown();
      }
      if (this.$memoBody) this.$memoBody.classList.toggle('active', mode === 'memo');
      if (this.$previewBody) this.$previewBody.classList.toggle('active', mode === 'preview');
      if (this.$devBody) this.$devBody.classList.toggle('active', mode === 'dev');
      if (this.$settingsBody) this.$settingsBody.classList.toggle('active', mode === 'settings');
      if (this.$versionsBody) this.$versionsBody.classList.toggle('active', mode === 'versions');
      this.applyLayoutMode(this.state.layoutMode);
      if (previewMode && this.$memoEditor && this.$memoPreview) {
        this.$memoEditor.value = this.$memo.value || '';
        this.applyPreviewPane(this.state.previewPane);
        this.scheduleRenderPreview(this.$memoEditor.value);
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
        this.closeHistory();
      });

      // tabs
      this.$tabs.forEach(tab =>
        tab.addEventListener('click', () => {
          this.$tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          this.updateMode();
        })
      );

      if (this.$layoutSplit)
        this.$layoutSplit.addEventListener('click', () => {
          this.applyLayoutMode('split');
          this.applyPreviewPane('editor');
          this.logEvent({ type: 'layout_change', mode: 'split' });
        });

      if (this.$layoutTabs)
        this.$layoutTabs.addEventListener('click', () => {
          this.applyLayoutMode('tab');
          this.applyPreviewPane(this.state.previewPane || 'editor');
          this.logEvent({ type: 'layout_change', mode: 'tab' });
        });

      if (Array.isArray(this.$previewPaneButtons)) {
        this.$previewPaneButtons.forEach(btn => {
          btn.addEventListener('click', () => {
            const pane = btn.dataset.pane || 'editor';
            this.applyPreviewPane(pane);
            this.logEvent({ type: 'preview_pane', pane });
          });
        });
      }

      // input persistence - debounced localStorage saving
       // Use memory state during typing, persist to LS on idle/blur
       let memoSaveTimer = null;
       const MEMO_SAVE_DELAY = 1000; // Save to LS 1 second after typing stops
       
       const updateMemoState = (value) => {
         this.state.memo = value;
         if (this.$memoEditor && this.$memoEditor.value !== value) {
           this.$memoEditor.value = value;
         }
         if (this.$memoPreview) {
           this.scheduleRenderPreview(value);
         }
       };
       
       const scheduleMemoSave = () => {
         clearTimeout(memoSaveTimer);
         memoSaveTimer = setTimeout(() => {
           LS.set(KEYS.memo, this.state.memo);
           this.out.tempStatus('저장됨', 'Ready', 900);
         }, MEMO_SAVE_DELAY);
       };
       
       const saveMemoImmediately = () => {
         clearTimeout(memoSaveTimer);
         LS.set(KEYS.memo, this.state.memo);
       };
       
       const saveMemo = () => {
         updateMemoState(this.$memo.value);
         scheduleMemoSave();
       };

      this.$memo.addEventListener('input', saveMemo);
      this.$memo.addEventListener('change', saveMemo);
      // Save immediately on blur
      this.$memo.addEventListener('blur', saveMemoImmediately);
      if (this.$memoEditor) {
        let editorSaveTimer = null;
        const EDITOR_SAVE_DELAY = 1000;
        
        const scheduleEditorSave = () => {
          clearTimeout(editorSaveTimer);
          editorSaveTimer = setTimeout(() => {
            LS.set(KEYS.memo, this.state.memo);
            this.out.tempStatus('저장됨', 'Ready', 900);
          }, EDITOR_SAVE_DELAY);
        };
        
        const saveEditorImmediately = () => {
          clearTimeout(editorSaveTimer);
          LS.set(KEYS.memo, this.state.memo);
        };
        
        const saveAndRender = () => {
          this.state.memo = this.$memoEditor.value;
          this.scheduleRenderPreview(this.state.memo);
          if (this.$memo.value !== this.state.memo) this.$memo.value = this.state.memo;
          scheduleEditorSave();
        };
        this.$memoEditor.addEventListener('input', saveAndRender);
        this.$memoEditor.addEventListener('change', saveAndRender);
        this.$memoEditor.addEventListener('blur', saveEditorImmediately);

        // scroll sync: editor -> preview (throttled to 1 rAF per frame)
        let scrollTicking = false;
        const sync = () => {
          if (!this.$memoPreview) return;
          const ta = this.$memoEditor;
          const ratio = ta.scrollTop / (ta.scrollHeight - ta.clientHeight || 1);
          const target = (this.$memoPreview.scrollHeight - this.$memoPreview.clientHeight) * ratio;
          this.$memoPreview.scrollTop = target;
        };
        this.$memoEditor.addEventListener('scroll', () => {
          if (scrollTicking) return;
          scrollTicking = true;
          requestAnimationFrame(() => {
            sync();
            scrollTicking = false;
          });
        });
      }
       if (this.$inlineEnabled) {
         const onToggleInline = () => {
           const val = !!this.$inlineEnabled.checked;
           this.state.inlineEnabled = val;
           LS.set(KEYS.inlineEnabled, val);
            this.out.toast(`인라인 ✨ ${val ? '켜짐' : '꺼짐'}`);
            this.logEvent({ type: 'toggle_inline', label: val ? 'on' : 'off' });
         };
        this.$inlineEnabled.addEventListener('change', onToggleInline);
        this.$inlineEnabled.addEventListener('input', onToggleInline);
      }
      if (this.$closeAfterInject) {
        const onToggleClose = () => {
          const val = !!this.$closeAfterInject.checked;
          this.state.closeAfterInject = val;
          LS.set(KEYS.closeAfterInject, val);
           this.out.toast(`주입 후 창 닫기 ${val ? '켜짐' : '꺼짐'}`);
           this.logEvent({ type: 'toggle_close_after_inject', label: val ? 'on' : 'off' });
        };
        this.$closeAfterInject.addEventListener('change', onToggleClose);
        this.$closeAfterInject.addEventListener('input', onToggleClose);
      }
      if (this.$resetPosition) {
        this.$resetPosition.addEventListener('click', () => {
          try {
            this.state.position = { x: null, y: null };
            LS.set(KEYS.position, this.state.position);
          } catch (_) {}
          if (this.$panel) {
            Object.assign(this.$panel.style, {
              left: '',
              top: '',
              right: '',
              bottom: '',
            });
          }
          this.out.toast('패널 위치를 기본값으로 되돌렸어요.');
          this.logEvent({ type: 'reset_position', label: 'settings' });
        });
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
            this.out.toast(entering ? '전체화면' : '일반 모드');
            this.logEvent({ type: 'toggle_fullscreen', label: entering ? 'enter' : 'exit' });
           if (this.$memoPreview) this.renderMarkdownToPreview(this.$memoEditor?.value || this.$memo?.value || '');
         });

       this.$memoClear?.addEventListener('click', () => {
         if (confirm('메모를 모두 지울까요?')) {
           this.$memo.value = '';
           this.$memo.dispatchEvent(new Event('input', { bubbles: true }));
         }
       });

      // Cloud sync button
      this.$memoSync = this.shadowRoot.getElementById('memoSync');
      this.$memoSync?.addEventListener('click', () => this.syncToCloud());

      // Versions - inline tab view (preferred) and overlay (fallback)
      this.$memoVersions = this.shadowRoot.getElementById('memoVersions');
      this.$versionsOverlay = this.shadowRoot.getElementById('versionsOverlay');
      this.$versionsList = this.shadowRoot.getElementById('versionsList');
      this.$versionsClose = this.shadowRoot.getElementById('versionsClose');
      this.$versionsInlineList = this.shadowRoot.getElementById('versionsInlineList');
      this.$versionsRefresh = this.shadowRoot.getElementById('versionsRefresh');

      // Versions button now switches to versions tab instead of overlay
      this.$memoVersions?.addEventListener('click', () => {
        this.state.mode = 'versions';
        LS.set(KEYS.mode, 'versions');
        this.$tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'versions'));
        this.updateMode();
        this.loadVersionsInline();
      });
      
      // Refresh button in versions tab
      this.$versionsRefresh?.addEventListener('click', () => this.loadVersionsInline());
      
      // Keep overlay close handlers for backwards compatibility
      this.$versionsClose?.addEventListener('click', () => this.closeVersions());

      // Close versions on overlay click
      this.$versionsOverlay?.addEventListener('click', (e) => {
        if (e.target === this.$versionsOverlay) this.closeVersions();
      });

      // selection add
      this.$addSel.addEventListener('click', () => {
        const sel = window.getSelection();
        const text = sel && sel.toString().trim();
          if (!text) {
            this.out.toast('\uc120\ud0dd\ub41c \ud14d\uc2a4\ud2b8\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.');
            return;
          }
        const now = new Date();
        const entry = `\n> ${text}\n\u0014 ${now.toLocaleString()}\n`;
        this.out.append(entry);
        this.out.toast('\uc120\ud0dd \ub0b4\uc6a9\uc744 \ucd94\uac00\ud588\uc2b5\ub2c8\ub2e4.');
        this.logEvent({ type: 'selection', label: '\uc120\ud0dd \ucd94\uac00', content: text });
      });

      // block add (enter block selection mode)
      if (this.$addBlock) {
        this.$addBlock.addEventListener('click', () => {
          this.logEvent({ type: 'enter_block_select', label: '\ube14\ub85d \ucd94\uac00' });
          this.toggleBlockSelectMode(true);
        });
      }


      // memo -> graph thought injection
      if (this.$memoToGraph) {
        this.$memoToGraph.addEventListener('click', () => {
          const raw = (this.$memo.value || '').trim();
           if (!raw) { this.out.toast('메모가 비어 있습니다.'); return; }
          const firstLine = raw.split(/\r?\n/).find(l => l.trim().length > 0) || '';
          const labelBase = (firstLine || raw).replace(/^\s*#+\s*/, '');
          const label = labelBase.slice(0, 60) + (labelBase.length > 60 ? '…' : '');

          // duplicate guard: check last 20 thought events for same content
          const recent = (this.state.events || []).slice(-50).reverse();
          const dup = recent.find(ev => ev && ev.type === 'thought' && (ev.content || '').trim() === raw);
          if (dup) {
            const ok = confirm('동일한 내용의 생각이 이미 그래프에 있습니다. 다시 추가할까요?');
            if (!ok) { this.out.toast('주입을 취소했습니다.'); return; }
          }

          // build metadata
          const info = this.getCurrentPostInfo();
          const anchor = this.getCurrentAnchor();
          const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
          const meta = { ver: 2, id, source: 'memo', anchor };

          this.logEvent({ type: 'thought', label, content: raw, meta });
           this.out.toast('메모를 그래프에 추가했습니다.');
          if (this.$historyOverlay && this.$historyOverlay.style.display !== 'none') {
            this.drawHistory();
          }
          if (this.state.closeAfterInject) {
            this.$panel.classList.remove('open');
            this.updateOpen();
          }
        });
      }

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
      if (Array.isArray(this.$catalystSuggestions) && this.$catalystSuggestions.length) {
        this.$catalystSuggestions.forEach(btn => {
          btn.addEventListener('click', () => {
            const text = btn.textContent?.trim();
            if (!text || !this.$catalystInput) return;
            this.$catalystInput.value = text;
            this.$catalystInput.focus();
            this.$catalystInput.dispatchEvent(new Event('input', { bubbles: true }));
            this.out.tempStatus('추천 프롬프트 적용됨', 'Ready', 900);
            this.logEvent({ type: 'catalyst_prompt_prefill', label: text });
          });
        });
      }

      // unified download menu
      if (this.$download) {
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
              this.out.toast('memo.txt 다운로드');
            } else if (type === 'md') {
              const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'memo.md'; document.body.appendChild(a); a.click(); a.remove();
              URL.revokeObjectURL(url);
              this.out.toast('memo.md 다운로드');
            } else if (type === 'html') {
              const body = this.markdownToHtml(md);
              const html = '<!doctype html><meta charset="utf-8"/><title>Memo</title><body style="font: 14px/1.6 system-ui, sans-serif; padding: 24px; max-width: 760px; margin: auto;">' + body + '</body>';
              const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'memo.html'; document.body.appendChild(a); a.click(); a.remove();
              URL.revokeObjectURL(url);
              this.out.toast('memo.html 다운로드');
            }
            cleanup();
          });
          const onBlur = () => cleanup();
          sel.addEventListener('blur', onBlur);
          setTimeout(() => sel.focus(), 0);
        });
      }

       // AI summary
      this.$aiSummary.addEventListener('click', () => {
        this.logEvent({ type: 'ai_summary', label: 'AI 요약' });
        this.summarizeWithGemini();
      });

      // track key actions
      if (this.$download) {
        this.$download.addEventListener('click', () => this.logEvent({ type: 'download_memo', label: '메모 다운로드' }));
      }
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

      // FAB position (shared with React FAB)
      if (this.$fabPosition) {
        const onFabPosition = () => {
          const next = this.$fabPosition.value === 'left' ? 'left' : 'bottom';
          this.state.fabPosition = next;
          try {
            localStorage.setItem('fab.position', next);
          } catch (_) {}
          try {
            window.dispatchEvent(
              new CustomEvent('fab:position-changed', { detail: { position: next } })
            );
          } catch (_) {}
          this.out.toast(`FAB 위치: ${next === 'left' ? '좌측' : '하단'}`);
          this.logEvent({ type: 'change_fab_position', label: next });
        };
        this.$fabPosition.addEventListener('change', onFabPosition);
        this.$fabPosition.addEventListener('input', onFabPosition);
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
        if (!this.$panel.classList.contains('open')) return;
        const rect = this.$panel.getBoundingClientRect();
        const { x, y } = this.clamp(rect.left, rect.top);
        if (x == null || y == null) {
          // Reset to CSS defaults if position is invalid
          Object.assign(this.$panel.style, {
            left: '',
            top: '',
            right: '',
            bottom: '',
          });
          LS.set(KEYS.position, { x: null, y: null });
        } else {
          Object.assign(this.$panel.style, {
            left: `${x}px`,
            top: `${y}px`,
            right: 'auto',
            bottom: 'auto',
          });
          LS.set(KEYS.position, { x, y });
        }
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

    getCurrentAnchor() {
      try {
        const scope = document.querySelector('article') ||
          document.querySelector('main') ||
          document.querySelector('article.prose') ||
          document.querySelector('.prose') ||
          document.getElementById('content') ||
          document.body;
        if (!scope) return null;

        const toAnchor = (h) => {
          let id = (h.id || '').trim();
          if (!id) {
            const a = h.querySelector('a[href^="#"]');
            if (a) {
              const href = (a.getAttribute('href') || '').trim();
              if (href.startsWith('#') && href.length > 1) {
                try { id = decodeURIComponent(href.slice(1)); } catch (_) { id = href.slice(1); }
              }
            }
          }
          return id ? { el: h, id } : null;
        };

        let anchors = Array.from(scope.querySelectorAll('h1,h2,h3,h4,h5,h6'))
          .map(toAnchor)
          .filter(Boolean);

        if (anchors.length === 0) {
          anchors = Array.from(scope.querySelectorAll('[id]'))
            .filter(el => el.id && el.id.length > 0)
            .map(el => ({ el, id: el.id }));
        }
        if (anchors.length === 0) return null;

        anchors.forEach(a => { a.top = a.el.getBoundingClientRect().top; });

        const threshold = Math.round(window.innerHeight * 0.33);
        let candidate = anchors
          .filter(a => a.top <= threshold)
          .sort((a, b) => b.top - a.top)[0];
        if (!candidate) {
          candidate = anchors
            .filter(a => a.top > 0)
            .sort((a, b) => a.top - b.top)[0];
        }
        if (!candidate) candidate = anchors[0];

        const id = (candidate && candidate.id || '').trim();
        return id ? `#${id}` : null;
      } catch (_) {
        return null;
      }
    }

    buildOriginalMarkdownPath(info) {
      if (!info) return null;
      const { year, slug } = info;
      return `/posts/${year}/${slug}.md`;
    }

    async maybeLoadOriginalMarkdown(force = false) {
      const prev = this.out.getStatus();
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
        this.out.setStatus('원문 불러오는 중…');
        const res = await fetch(url);
        if (!res.ok) throw new Error(`원문 로드 실패(${res.status})`);
        const text = await res.text();
        if (this.$proposalMd) {
          if (force || !this.$proposalMd.value) {
            this.$proposalMd.value = text;
            this.state.proposalMd = text;
            LS.set(KEYS.proposalMd, text);
            this.out.toast(
              '원문을 불러왔습니다. 내용을 편집한 뒤 PR을 생성하세요.'
            );
          }
        }
        this._originalLoaded = true;
        this.out.setStatus('완료');
      } catch (err) {
        console.error('maybeLoadOriginalMarkdown error:', err);
        this.out.setStatus('오류');
        this.out.toast(err?.message || '원문을 불러오지 못했습니다.');
      } finally {
        setTimeout(() => { this.out.setStatus(prev || 'Ready'); }, 1400);
      }
    }

    async proposeNewVersion() {
      const prev = this.out.getStatus();
      try {
        const backend = window.__APP_CONFIG?.apiBaseUrl || window.APP_CONFIG?.apiBaseUrl || DEFAULT_API_URL;
        const info = this.getCurrentPostInfo();
        if (!info) {
          this.out.toast('현재 페이지에서 글 정보를 찾을 수 없습니다.');
          return;
        }
        const md = (this.$proposalMd?.value || '').trim();
        if (!md) {
          this.out.toast('제안할 마크다운이 비어 있습니다.');
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
        this.out.setStatus('PR 생성 요청 중…');
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
        this.out.toast(prUrl ? 'PR이 생성되었습니다.' : '요청이 완료되었습니다.');
        this.out.setStatus('완료');
      } catch (err) {
        console.error('proposeNewVersion error:', err);
        this.out.setStatus('오류');
        this.out.toast(err?.message || 'PR 생성 요청에 실패했습니다.');
      } finally {
        setTimeout(() => { this.out.setStatus(prev || 'Ready'); }, 1400);
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