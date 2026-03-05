/* ═══ shared ide-engine.js ═══ */

(function () {
  if (window.__ideEngineLoaded) return;
  window.__ideEngineLoaded = true;

  // 1. Core Tokenizer
  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function colorize(line) {
    const KW = new Set(['def', 'for', 'while', 'if', 'else', 'elif', 'return', 'in', 'and', 'or', 'not', 'class', 'True', 'False', 'None', 'from', 'import', 'as', 'with', 'try', 'except', 'finally', 'raise', 'yield', 'lambda', 'pass', 'break', 'continue']);
    const BI = new Set(['len', 'range', 'append', 'join', 'sorted', 'list', 'str', 'int', 'print', 'enumerate', 'max', 'min', 'sum', 'set', 'dict', 'tuple', 'abs', 'float', 'map', 'zip', 'any', 'all', 'pop', 'insert', 'remove', 'extend', 'index', 'count', 'keys', 'values', 'items', 'get', 'update', 'add', 'discard', 'copy', 'clear', 'replace', 'split', 'strip', 'lower', 'upper', 'find', 'startswith', 'format', 'isinstance', 'type', 'reversed', 'heapify', 'heappush', 'heappop', 'deque', 'defaultdict', 'Counter', 'bisect_left', 'bisect_right', 'inf']);
    const tokens = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '#') { tokens.push({ t: 'cm', x: line.slice(i) }); break; }
      if (line.slice(i, i + 3) === '"""' || line.slice(i, i + 3) === "'''") {
        const q = line.slice(i, i + 3);
        let end = line.indexOf(q, i + 3);
        if (end === -1) { tokens.push({ t: 'str', x: line.slice(i) }); break; }
        tokens.push({ t: 'str', x: line.slice(i, end + 3) }); i = end + 3; continue;
      }
      if (line[i] === '"' || line[i] === "'") {
        const q = line[i]; let j = i + 1;
        while (j < line.length && line[j] !== q) { if (line[j] === '\\\\') j++; j++; }
        tokens.push({ t: 'str', x: line.slice(i, j + 1) }); i = j + 1; continue;
      }
      if (/[A-Za-z_]/.test(line[i])) {
        let j = i;
        while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
        const w = line.slice(i, j);
        const call = j < line.length && line[j] === '(';
        if (KW.has(w)) tokens.push({ t: 'kw', x: w });
        else if (BI.has(w) && call) tokens.push({ t: 'bi', x: w });
        else if (call) tokens.push({ t: 'fn', x: w });
        else tokens.push({ t: 'id', x: w });
        i = j; continue;
      }
      if (/\\d/.test(line[i])) {
        let j = i;
        while (j < line.length && /[\\d.]/.test(line[j])) j++;
        tokens.push({ t: 'num', x: line.slice(i, j) }); i = j; continue;
      }
      tokens.push({ t: 'p', x: line[i] }); i++;
    }
    const cm = { kw: 'itok-kw', fn: 'itok-fn', bi: 'itok-bi', num: 'itok-num', str: 'itok-str', cm: 'itok-cm' };
    return tokens.map(t => { const e = escHtml(t.x); const c = cm[t.t]; return c ? '<span class="' + c + '">' + e + '</span>' : e; }).join('');
  }

  // 2. Data Extractors
  // Using try/catch and typeof to sniff out global let/const without crashing
  function getPySource() {
    if (typeof window.__TRACE_PYTHON_SOURCE !== 'undefined') return window.__TRACE_PYTHON_SOURCE;
    try { if (typeof PY_SOURCE !== 'undefined') return PY_SOURCE; } catch (e) { }
    try { if (typeof SOURCE_CODE !== 'undefined') return SOURCE_CODE; } catch (e) { }
    try { if (typeof PYTHON_SOURCE !== 'undefined') return PYTHON_SOURCE; } catch (e) { }
    return [];
  }
  function getSteps() {
    try { if (typeof states !== 'undefined') return states; } catch (e) { }
    try { if (typeof steps !== 'undefined') return steps; } catch (e) { }
    return [];
  }
  function getCur() {
    try { if (typeof currentStateIdx === 'number') return currentStateIdx; } catch (e) { }
    try { if (typeof currentStep === 'number') return currentStep; } catch (e) { }
    try { if (typeof cur === 'number') return cur; } catch (e) { }
    return 0;
  }

  // 3. UI Builders
  function initIDE() {
    if (document.getElementById('ide-sidebar')) return;

    const sidebar = document.createElement('div');
    sidebar.id = 'ide-sidebar';
    sidebar.className = 'ide-sidebar';
    sidebar.innerHTML = \`
      <div class="ide-sidebar-section ide-code-area">
        <div class="ide-sidebar-title">📄 Python Source</div>
        <div class="ide-sidebar-body"><pre class="ide-src-code" id="ide-src-code"></pre></div>
      </div>
      <div class="ide-sidebar-section ide-vars-area">
        <div class="ide-sidebar-title">📊 Live Variables</div>
        <div class="ide-sidebar-body"><table class="ide-live-vars"><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody id="ide-live-vars-body"></tbody></table></div>
      </div>
    \`;
    document.body.appendChild(sidebar);

    const card = document.querySelector('.card') || document.querySelector('.container > div') || document.body;
    let title = document.querySelector('.header h2') ? document.querySelector('.header h2').innerHTML : 'Algorithm Simulation';
    
    const headerOverlay = document.createElement('div');
    headerOverlay.className = 'ide-header-overlay';
    headerOverlay.innerHTML = \`
      <h2>\${title}</h2>
      <div class="ide-header-actions">
        <button class="ide-btn-code active" id="ide-btn-code-top" type="button" title="코드 보기">&lt;/&gt;</button>
        <button class="btn-info" style="border:1px solid #3e3e42;border-radius:50%;width:26px;height:26px;background:none;color:#888;cursor:pointer;" onclick="document.getElementById('modal')?.classList.add('open')">?</button>
      </div>
    \`;
    
    if(card.firstChild) {
      card.insertBefore(headerOverlay, card.firstChild);
    } else {
      card.appendChild(headerOverlay);
    }

    function toggleIDE() {
      const isIde = document.body.classList.toggle('ide-mode');
      document.querySelectorAll('.btn-code, .ide-btn-code').forEach(btn => btn.classList.toggle('active', isIde));
      setTimeout(renderSidebar, 10);
      // Trigger resize for canvas resizing in some algorithms
      window.dispatchEvent(new Event('resize'));
    }

    document.getElementById('ide-btn-code-top').addEventListener('click', toggleIDE);
    
    const origHeader = document.querySelector('.header');
    if (origHeader) {
      let btnCodeOrig = origHeader.querySelector('.btn-code');
      if (!btnCodeOrig) {
        btnCodeOrig = document.createElement('button');
        btnCodeOrig.className = 'btn-code ide-btn-code';
        btnCodeOrig.innerHTML = '&lt;/&gt;';
        btnCodeOrig.title = '코드 보기';
        const btnInfo = origHeader.querySelector('.btn-info');
        if (btnInfo) origHeader.insertBefore(btnCodeOrig, btnInfo);
        else origHeader.appendChild(btnCodeOrig);
      }
      btnCodeOrig.addEventListener('click', toggleIDE);
    }

    setInterval(renderSidebar, 150);
  }

  // 4. Render loop
  function inferLine(step, curIdx, total, srcLen) {
    const last = Math.max(srcLen - 1, 0);
    // Explicit line property takes absolute priority
    if (typeof step?.codeLine === 'number') return Math.min(last, Math.max(0, step.codeLine));
    if (typeof step?.line === 'number') return Math.min(last, Math.max(0, step.line - 1));
    
    // Some legacy scripts might use step variables for tracking code, falling back to message parsing
    const text = [(step?.msg || ''), (step?.desc || ''), (step?.phase || ''), (step?.type || '')].join(' ').toLowerCase();
    if (/done|complete|완료|finish|종료|end/.test(text)) return last;
    if (/init|start|초기|시작/.test(text)) return 0;
    if (total <= 1) return 0;
    
    // Fuzzy mapping for legacy completely unsupported files
    return Math.min(last, Math.max(0, Math.floor((curIdx / (total - 1)) * (last * 0.8))));
  }

  let lastCur = -1;
  let lastStepsHash = -1;
  function renderSidebar() {
    if (!document.body.classList.contains('ide-mode')) return; 
    
    const cur = getCur();
    const steps = getSteps();
    const stepsHash = steps.length + cur;
    if (stepsHash === lastStepsHash) return; 
    lastStepsHash = stepsHash;

    const src = getPySource();
    const step = steps[cur] || {};
    const codeEl = document.getElementById('ide-src-code');
    
    if (src.length > 0 && codeEl) {
      const line = inferLine(step, cur, steps.length, src.length);
      codeEl.innerHTML = src.map((l, i) =>
        '<span class="ide-src-line' + (i === line ? ' active' : '') + '">' + colorize(l) + '</span>'
      ).join('\\n');
      
      const activeEl = codeEl.querySelector('.ide-src-line.active');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }

    const tbody = document.getElementById('ide-live-vars-body');
    if (tbody && step) {
      // In older simulators, maybe variables are nested in 'vars', 'locals', or entirely unstructured
      // Let's grab variables from 'vars' if explicit, otherwise guess them from step keys
      const explicitVars = step.vars || step.locals || null;
      const targetObj = explicitVars ? explicitVars : step;
      
      const vars = [];
      const skip = new Set(['msg','phase','type','desc','description','html','innerHTML','line','codeLine','vars','locals']);
      Object.entries(targetObj).forEach(([k, v]) => {
        if (!explicitVars && skip.has(k)) return;
        if (typeof v === 'function' || k.startsWith('_') || k === 'stack') return;
        
        let val;
        if (v === null) val = 'null';
        else if (v === undefined) val = '-';
        else if (Array.isArray(v)) {
          const preview = v.slice(0, 8).map(x => typeof x === 'object' ? '{...}' : JSON.stringify(x)).join(', ');
          val = '[' + preview + (v.length > 8 ? ', ...' : '') + ']';
        } else if (typeof v === 'object') val = JSON.stringify(v).slice(0, 80);
        else val = String(v);
        
        vars.push('<tr><td>' + escHtml(k) + '</td><td>' + escHtml(val) + '</td></tr>');
      });
      tbody.innerHTML = vars.join('');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIDE);
  } else {
    initIDE();
  }
})();
