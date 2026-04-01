import os

out_dir = "/home/nodove/workspace/blog/frontend/public/posts/2025"
os.makedirs(out_dir, exist_ok=True)

css_template = """*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Segoe UI',sans-serif;font-size:14px;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
:root{--bg:#1e1e1e;--panel:#252526;--text:#d4d4d4;--border:#3e3e42;--primary:#007acc;--primary-h:#005999;--accent:#4CAF50;--danger:#f44336;--hl:#264f78}
.card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:20px;width:100%;max-width:680px}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:0 4px}
.header h2{margin:0;font-size:1.05rem;color:#fff}
.header .sub{color:#888;font-weight:400}
.btn-info{background:none;border:1px solid var(--border);border-radius:50%;width:26px;height:26px;color:#888;cursor:pointer;font-size:.85rem;font-weight:bold;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0}
.btn-info:hover{border-color:var(--primary);color:var(--primary)}
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100;align-items:center;justify-content:center}
.modal-overlay.open{display:flex}
.modal{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:28px 32px;max-width:560px;width:90%;max-height:80vh;overflow-y:auto;position:relative}
.modal h3{margin:0 0 16px;color:#fff;font-size:1.1rem}
.modal section{margin-bottom:16px}
.modal h4{margin:0 0 6px;color:var(--primary);font-size:.85rem;text-transform:uppercase;letter-spacing:.05em}
.modal p,.modal li{font-size:.9rem;line-height:1.6;color:var(--text);margin:0 0 4px}
.modal ul{padding-left:18px;margin:0}
.tag{display:inline-block;background:#2d2d30;border:1px solid var(--border);border-radius:4px;padding:2px 8px;font-size:.8rem;margin-right:6px;color:#4fc3f7;font-family:monospace}
.modal-close{position:absolute;top:12px;right:14px;background:none;border:none;color:#888;font-size:1.2rem;cursor:pointer;padding:0;line-height:1}
.modal-close:hover{color:#fff}
.controls{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:12px}
button{background:var(--primary);border:none;border-radius:4px;color:#fff;cursor:pointer;padding:5px 12px;font-size:.8rem}
button:hover{background:var(--primary-h)}
button:disabled{opacity:.4;cursor:default}
.step-info{font-size:.82rem;color:#888;margin-left:auto}
input[type=range]{accent-color:var(--primary);width:80px}
.viz{background:#1a1a1a;border:1px solid var(--border);border-radius:6px;padding:12px;min-height:120px;margin-bottom:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;overflow-x:auto;}
.log{font-size:.8rem;color:#888;min-height:36px;padding:4px 0}
.array-row { display: flex; gap: 8px; justify-content: center; min-height: 40px; margin-bottom: 4px; }
.box { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: #333; border: 2px solid var(--border); border-radius: 6px; font-weight: bold; font-size: 1.1rem; transition: all 0.3s; }
.box.active { border-color: var(--primary); box-shadow: 0 0 8px var(--primary); transform: translateY(-2px); }
.box.merged { border-color: var(--accent); background: rgba(76,175,80,0.2); color: var(--accent); }
.box.danger { border-color: var(--danger); background: rgba(244,67,54,0.2); color: var(--danger); }
.grid-row { display: flex; gap: 2px; justify-content: center; }
.grid-cell { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; background: #333; border: 1px solid var(--border); font-size: 0.9rem; transition: all 0.3s; }
.grid-cell.active { border-color: var(--primary); background: var(--primary-h); }
.grid-cell.hl { background: var(--accent); color: #000; }
"""

html_template = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>
{css}
</style>
</head>
<body style="flex-direction:column;">
<div class="header" style="width:100%;max-width:680px;">
    <h2>{title_main} <span class="sub">— {title_sub}</span></h2>
    <button class="btn-info" id="btn-info" type="button" title="설명 보기">?</button>
</div>
<div class="card">
    <div class="viz" id="viz"></div>
    <div class="log" id="log">Initializing...</div>
    <div class="controls">
        <button id="btn-prev">⏮ Prev</button>
        <button id="btn-play">▶ Play</button>
        <button id="btn-pause" disabled>⏸ Pause</button>
        <button id="btn-next">Next ⏭</button>
        <button id="btn-reset">Reset</button>
        <label class="step-info">Speed: <input type="range" id="speed" min="100" max="2000" value="800" dir="rtl"></label>
        <span class="step-info" id="step-counter">Step: 0 / 0</span>
    </div>
</div>

<div class="modal-overlay" id="modal">
    <div class="modal">
        <button class="modal-close" id="modal-close">✕</button>
        <h3>{title}</h3>
        <section><h4>📌 알고리즘</h4><p>{algo}</p></section>
        <section><h4>💡 입력</h4><p>{input_desc}</p></section>
        <section><h4>⏱ 복잡도</h4><span class="tag">{complexity}</span></section>
        <section><h4>🏗 아키텍트의 시선</h4><p>{architect}</p></section>
    </div>
</div>

<script>
let states = [];
{generate_states}

let currentStep = 0;
let playing = false;
let timer;

const viz = document.getElementById('viz');
const log = document.getElementById('log');
const stepCounter = document.getElementById('step-counter');

{render_func}

function next() {{ if (currentStep < states.length - 1) {{ currentStep++; render(); }} else pause(); }}
function prev() {{ if (currentStep > 0) {{ currentStep--; render(); }} }}
function play() {{ if (!playing && currentStep < states.length - 1) {{ playing = true; document.getElementById('btn-play').disabled = true; document.getElementById('btn-pause').disabled = false; timer = setInterval(next, document.getElementById('speed').value); }} }}
function pause() {{ playing = false; document.getElementById('btn-play').disabled = false; document.getElementById('btn-pause').disabled = true; clearInterval(timer); }}
function reset() {{ pause(); currentStep = 0; render(); }}

document.getElementById('btn-next').addEventListener('click', () => {{ pause(); next(); }});
document.getElementById('btn-prev').addEventListener('click', () => {{ pause(); prev(); }});
document.getElementById('btn-play').addEventListener('click', play);
document.getElementById('btn-pause').addEventListener('click', pause);
document.getElementById('btn-reset').addEventListener('click', reset);
document.getElementById('speed').addEventListener('input', () => {{ if (playing) {{ pause(); play(); }} }});

document.getElementById('btn-info').addEventListener('click',()=>document.getElementById('modal').classList.add('open'));
document.getElementById('modal-close').addEventListener('click',()=>document.getElementById('modal').classList.remove('open'));
document.getElementById('modal').addEventListener('click',e=>{{if(e.target===document.getElementById('modal'))document.getElementById('modal').classList.remove('open');}});

render();
</script>
</body>
</html>
"""

algos = [
    {
        "filename": "algo-081-피보나치-최적화-simulator.html",
        "title_main": "피보나치 최적화", "title_sub": "Fibonacci Optimization",
        "algo": "메모이제이션 / Bottom-up DP", "input_desc": "n=10",
        "complexity": "Time O(n), Space O(n) → O(1)",
        "architect": "Top-down(재귀+메모) vs Bottom-up(반복+배열). 두 방식 모두 O(n) but 실무 선호는 Bottom-up.",
        "generate_states": """
function generateStates() {
    let dp = [0, 1];
    states.push({ arr: [...dp], msg: "초기 상태: dp[0]=0, dp[1]=1", active: [] });
    for(let i=2; i<=10; i++) {
        states.push({ arr: [...dp, "?"], msg: `dp[${i}] 계산 준비`, active: [i-1, i-2] });
        dp[i] = dp[i-1] + dp[i-2];
        states.push({ arr: [...dp], msg: `dp[${i}] = dp[${i-1}] + dp[${i-2}] = ${dp[i]}`, active: [i] });
    }
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'array-row';
    state.arr.forEach((val, idx) => {
        const box = document.createElement('div');
        box.className = 'box';
        box.innerText = val;
        if (state.active && state.active.includes(idx)) box.classList.add('active');
        row.appendChild(box);
    });
    viz.appendChild(row);
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-082-계단-오르기-stairs-simulator.html",
        "title_main": "계단 오르기", "title_sub": "Climbing Stairs",
        "algo": "1D DP (피보나치 변형)", "input_desc": "n=6",
        "complexity": "Time O(n), Space O(1)",
        "architect": "상태 전이와 점화식. dp[i] = 'i번째 계단에 도달하는 방법 수'. 피보나치와 동일 구조.",
        "generate_states": """
function generateStates() {
    let dp = [1, 1];
    states.push({ arr: [...dp], msg: "초기 상태: dp[0]=1, dp[1]=1", active: [] });
    for(let i=2; i<=6; i++) {
        states.push({ arr: [...dp, "?"], msg: `계단 ${i} 도달 방법 계산`, active: [i-1, i-2] });
        dp[i] = dp[i-1] + dp[i-2];
        states.push({ arr: [...dp], msg: `dp[${i}] = dp[${i-1}] + dp[${i-2}] = ${dp[i]}`, active: [i] });
    }
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'array-row';
    state.arr.forEach((val, idx) => {
        const box = document.createElement('div');
        box.className = 'box';
        box.innerText = val;
        if (state.active && state.active.includes(idx)) box.classList.add('active');
        row.appendChild(box);
    });
    viz.appendChild(row);
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-083-동전-교환-coin-change-simulator.html",
        "title_main": "동전 교환", "title_sub": "Coin Change",
        "algo": "완전 배낭 DP (Bottom-up)", "input_desc": "coins=[1,5,11], amount=15",
        "complexity": "Time O(amount × coins), Space O(amount)",
        "architect": "완전 탐색→DP 사고 전환. dp[i] = '금액 i를 만드는 최소 동전 수'. INF 초기화 → 갱신.",
        "generate_states": """
function generateStates() {
    let coins = [1, 5, 11];
    let amount = 15;
    let dp = Array(amount + 1).fill(99);
    dp[0] = 0;
    states.push({ arr: [...dp], msg: "초기화: dp[0]=0, 나머지는 INF(99)", active: [0] });
    
    for(let c of coins) {
        states.push({ arr: [...dp], msg: `동전 ${c}원 사용 고려`, active: [] });
        for(let i=c; i<=amount; i++) {
            if(dp[i-c] + 1 < dp[i]) {
                dp[i] = dp[i-c] + 1;
                states.push({ arr: [...dp], msg: `dp[${i}] 갱신: dp[${i-c}] + 1 = ${dp[i]}`, active: [i, i-c] });
            }
        }
    }
    states.push({ arr: [...dp], msg: `최종 결과: ${dp[amount]}개`, active: [amount] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'array-row';
    row.style.flexWrap = 'wrap';
    state.arr.forEach((val, idx) => {
        const box = document.createElement('div');
        box.className = 'box';
        box.style.width = '30px';
        box.style.height = '30px';
        box.style.fontSize = '0.9rem';
        box.innerText = val === 99 ? '∞' : val;
        box.title = `Amount: ${idx}`;
        if (state.active && state.active.includes(idx)) box.classList.add('active');
        row.appendChild(box);
    });
    viz.appendChild(row);
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-084-0-1-배낭-knapsack-simulator.html",
        "title_main": "0/1 배낭", "title_sub": "0/1 Knapsack",
        "algo": "2D DP", "input_desc": "weights=[2,3,4,5], values=[3,4,5,6], capacity=8",
        "complexity": "Time O(n×W), Space O(n×W)",
        "architect": "제약 하 최적화. 각 아이템 한 번씩만 사용(0/1). 1D 롤링 배열로 최적화 가능.",
        "generate_states": """
function generateStates() {
    let w = [2,3,4,5], v = [3,4,5,6], W = 8;
    let dp = Array(w.length + 1).fill(0).map(() => Array(W + 1).fill(0));
    states.push({ grid: dp.map(r=>[...r]), msg: "초기 2D DP 테이블 (0으로 초기화)", active: [] });
    
    for(let i=1; i<=w.length; i++) {
        for(let j=1; j<=W; j++) {
            if(w[i-1] <= j) {
                dp[i][j] = Math.max(dp[i-1][j], dp[i-1][j-w[i-1]] + v[i-1]);
                states.push({ grid: dp.map(r=>[...r]), msg: `아이템 ${i} (w:${w[i-1]}, v:${v[i-1]}), 용량 ${j}: max(${dp[i-1][j]}, ${dp[i-1][j-w[i-1]]}+${v[i-1]}) = ${dp[i][j]}`, active: [i, j] });
            } else {
                dp[i][j] = dp[i-1][j];
            }
        }
    }
    states.push({ grid: dp.map(r=>[...r]), msg: `최종 최대 가치: ${dp[w.length][W]}`, active: [w.length, W] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    state.grid.forEach((row, i) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'grid-row';
        row.forEach((val, j) => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.innerText = val;
            if (state.active && state.active[0] === i && state.active[1] === j) cell.classList.add('active');
            rowDiv.appendChild(cell);
        });
        viz.appendChild(rowDiv);
    });
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-085-lis-최장-증가-부분수열-simulator.html",
        "title_main": "LIS", "title_sub": "Longest Increasing Subsequence",
        "algo": "DP + 이진탐색 (Patience Sorting)", "input_desc": "nums=[10,9,2,5,3,7,101,18]",
        "complexity": "Time O(n log n), Space O(n)",
        "architect": "Patience Sorting. tails[i] = 길이 i+1 인 증가 부분수열의 최소 끝값. 이진탐색으로 교체 위치 찾기.",
        "generate_states": """
function generateStates() {
    let nums = [10,9,2,5,3,7,101,18];
    let tails = [];
    states.push({ arr: [...tails], msg: "초기 tails 배열 비어있음", active: [] });
    
    for(let x of nums) {
        let left = 0, right = tails.length;
        while(left < right) {
            let mid = Math.floor((left + right) / 2);
            if(tails[mid] < x) left = mid + 1;
            else right = mid;
        }
        if(left === tails.length) {
            tails.push(x);
            states.push({ arr: [...tails], msg: `${x} 추가 (새로운 길이 LIS)`, active: [left] });
        } else {
            tails[left] = x;
            states.push({ arr: [...tails], msg: `${x}로 tails[${left}] 교체 (더 작은 끝값)`, active: [left] });
        }
    }
    states.push({ arr: [...tails], msg: `최종 LIS 길이: ${tails.length}`, active: [] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'array-row';
    state.arr.forEach((val, idx) => {
        const box = document.createElement('div');
        box.className = 'box';
        box.innerText = val;
        if (state.active && state.active.includes(idx)) box.classList.add('active');
        row.appendChild(box);
    });
    viz.appendChild(row);
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-086-lcs-최장-공통-부분수열-simulator.html",
        "title_main": "LCS", "title_sub": "Longest Common Subsequence",
        "algo": "2D DP", "input_desc": "text1='abcde', text2='ace'",
        "complexity": "Time O(m×n), Space O(m×n)",
        "architect": "diff 알고리즘의 기초. dp[i][j] = text1[0..i] 와 text2[0..j] 의 LCS 길이.",
        "generate_states": """
function generateStates() {
    let t1 = "abcde", t2 = "ace";
    let dp = Array(t1.length + 1).fill(0).map(() => Array(t2.length + 1).fill(0));
    states.push({ grid: dp.map(r=>[...r]), msg: "초기 2D DP 테이블", active: [] });
    
    for(let i=1; i<=t1.length; i++) {
        for(let j=1; j<=t2.length; j++) {
            if(t1[i-1] === t2[j-1]) {
                dp[i][j] = dp[i-1][j-1] + 1;
                states.push({ grid: dp.map(r=>[...r]), msg: `문자 일치 '${t1[i-1]}': 대각선 + 1 = ${dp[i][j]}`, active: [i, j] });
            } else {
                dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
                states.push({ grid: dp.map(r=>[...r]), msg: `불일치: max(위, 왼쪽) = ${dp[i][j]}`, active: [i, j] });
            }
        }
    }
    states.push({ grid: dp.map(r=>[...r]), msg: `최종 LCS 길이: ${dp[t1.length][t2.length]}`, active: [t1.length, t2.length] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    state.grid.forEach((row, i) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'grid-row';
        row.forEach((val, j) => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.innerText = val;
            if (state.active && state.active[0] === i && state.active[1] === j) cell.classList.add('active');
            rowDiv.appendChild(cell);
        });
        viz.appendChild(rowDiv);
    });
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-087-편집-거리-edit-distance-simulator.html",
        "title_main": "편집 거리", "title_sub": "Edit Distance (Levenshtein)",
        "algo": "2D DP", "input_desc": "word1='horse', word2='ros'",
        "complexity": "Time O(m×n), Space O(m×n)",
        "architect": "문자열 유사도 측정. dp[i][j] = word1[0..i] → word2[0..j] 변환 최소 연산 수.",
        "generate_states": """
function generateStates() {
    let w1 = "horse", w2 = "ros";
    let dp = Array(w1.length + 1).fill(0).map(() => Array(w2.length + 1).fill(0));
    for(let i=0; i<=w1.length; i++) dp[i][0] = i;
    for(let j=0; j<=w2.length; j++) dp[0][j] = j;
    states.push({ grid: dp.map(r=>[...r]), msg: "초기화: 빈 문자열과의 거리", active: [] });
    
    for(let i=1; i<=w1.length; i++) {
        for(let j=1; j<=w2.length; j++) {
            if(w1[i-1] === w2[j-1]) {
                dp[i][j] = dp[i-1][j-1];
                states.push({ grid: dp.map(r=>[...r]), msg: `문자 일치 '${w1[i-1]}': 비용 0 추가`, active: [i, j] });
            } else {
                dp[i][j] = Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]) + 1;
                states.push({ grid: dp.map(r=>[...r]), msg: `불일치: min(교체, 삭제, 삽입) + 1 = ${dp[i][j]}`, active: [i, j] });
            }
        }
    }
    states.push({ grid: dp.map(r=>[...r]), msg: `최종 편집 거리: ${dp[w1.length][w2.length]}`, active: [w1.length, w2.length] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    state.grid.forEach((row, i) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'grid-row';
        row.forEach((val, j) => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.innerText = val;
            if (state.active && state.active[0] === i && state.active[1] === j) cell.classList.add('active');
            rowDiv.appendChild(cell);
        });
        viz.appendChild(rowDiv);
    });
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-088-집-도둑-house-robber-simulator.html",
        "title_main": "집 도둑", "title_sub": "House Robber",
        "algo": "선택/비선택 DP", "input_desc": "nums=[2,7,9,3,1]",
        "complexity": "Time O(n), Space O(1)",
        "architect": "상태 정의의 핵심. dp[i] = 'i번째까지 최대 금액'. 인접 금지로 i-2 참조.",
        "generate_states": """
function generateStates() {
    let nums = [2,7,9,3,1];
    let dp = [nums[0], Math.max(nums[0], nums[1])];
    states.push({ arr: [...dp], msg: `초기화: dp[0]=${dp[0]}, dp[1]=${dp[1]}`, active: [] });
    
    for(let i=2; i<nums.length; i++) {
        dp[i] = Math.max(dp[i-1], dp[i-2] + nums[i]);
        states.push({ arr: [...dp], msg: `집 ${i} (금액 ${nums[i]}): max(스킵 ${dp[i-1]}, 털기 ${dp[i-2]}+${nums[i]}) = ${dp[i]}`, active: [i] });
    }
    states.push({ arr: [...dp], msg: `최종 최대 금액: ${dp[nums.length-1]}`, active: [nums.length-1] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'array-row';
    state.arr.forEach((val, idx) => {
        const box = document.createElement('div');
        box.className = 'box';
        box.innerText = val;
        if (state.active && state.active.includes(idx)) box.classList.add('active');
        row.appendChild(box);
    });
    viz.appendChild(row);
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-089-고유-경로-unique-paths-simulator.html",
        "title_main": "고유 경로", "title_sub": "Unique Paths",
        "algo": "격자 DP", "input_desc": "m=3, n=7",
        "complexity": "Time O(m×n), Space O(m×n) → O(n)",
        "architect": "격자 DP와 조합론. C(m+n-2, m-1)과 동일. DP로 직관적 구현.",
        "generate_states": """
function generateStates() {
    let m = 3, n = 7;
    let dp = Array(m).fill(0).map(() => Array(n).fill(1));
    states.push({ grid: dp.map(r=>[...r]), msg: "초기화: 모든 테두리 1", active: [] });
    
    for(let i=1; i<m; i++) {
        for(let j=1; j<n; j++) {
            dp[i][j] = dp[i-1][j] + dp[i][j-1];
            states.push({ grid: dp.map(r=>[...r]), msg: `dp[${i}][${j}] = 위(${dp[i-1][j]}) + 왼쪽(${dp[i][j-1]}) = ${dp[i][j]}`, active: [i, j] });
        }
    }
    states.push({ grid: dp.map(r=>[...r]), msg: `최종 경로 수: ${dp[m-1][n-1]}`, active: [m-1, n-1] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    state.grid.forEach((row, i) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'grid-row';
        row.forEach((val, j) => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.innerText = val;
            if (state.active && state.active[0] === i && state.active[1] === j) cell.classList.add('active');
            rowDiv.appendChild(cell);
        });
        viz.appendChild(rowDiv);
    });
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-090-단어-분리-word-break-simulator.html",
        "title_main": "단어 분리", "title_sub": "Word Break",
        "algo": "문자열 DP (1D Boolean DP)", "input_desc": "s='leetcode', wordDict=['leet','code']",
        "complexity": "Time O(n²), Space O(n)",
        "architect": "트라이 기반 최적화 가능. dp[i] = 's[0..i] 분리 가능'. 뒤에서 앞으로 역추적.",
        "generate_states": """
function generateStates() {
    let s = "leetcode", dict = ["leet", "code"];
    let dp = Array(s.length + 1).fill(false);
    dp[0] = true;
    states.push({ arr: [...dp], msg: "초기화: dp[0]=true", active: [0] });
    
    for(let i=1; i<=s.length; i++) {
        for(let j=0; j<i; j++) {
            if(dp[j] && dict.includes(s.substring(j, i))) {
                dp[i] = true;
                states.push({ arr: [...dp], msg: `부분 문자열 '${s.substring(j, i)}' 발견! dp[${i}]=true`, active: [i] });
                break;
            }
        }
    }
    states.push({ arr: [...dp], msg: `최종 결과: ${dp[s.length]}`, active: [s.length] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'array-row';
    state.arr.forEach((val, idx) => {
        const box = document.createElement('div');
        box.className = 'box';
        box.innerText = val ? 'T' : 'F';
        if(val) box.classList.add('merged');
        if (state.active && state.active.includes(idx)) box.classList.add('active');
        row.appendChild(box);
    });
    viz.appendChild(row);
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-091-트라이-trie-simulator.html",
        "title_main": "트라이", "title_sub": "Trie (Prefix Tree)",
        "algo": "접두사 트리 (Insert/Search/StartsWith)", "input_desc": "words=['app','apt']",
        "complexity": "Insert/Search O(L), Space O(∑L)",
        "architect": "검색 엔진과 자동 완성. 공통 접두사 공유로 공간 효율. 실무: 검색어 자동완성, IP 라우팅.",
        "generate_states": """
function generateStates() {
    states.push({ arr: ["(root)"], msg: "초기 트라이", active: [0] });
    states.push({ arr: ["(root)", " └── a"], msg: "'app' 삽입: 'a' 추가", active: [1] });
    states.push({ arr: ["(root)", " └── a", "     └── p"], msg: "'app' 삽입: 'p' 추가", active: [2] });
    states.push({ arr: ["(root)", " └── a", "     └── p", "         └── p (end)"], msg: "'app' 삽입 완료", active: [3] });
    states.push({ arr: ["(root)", " └── a", "     └── p", "         ├── p (end)", "         └── t (end)"], msg: "'apt' 삽입: 'a','p' 공유, 't' 추가", active: [4] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    const pre = document.createElement('pre');
    pre.style.color = 'var(--text)';
    pre.style.fontFamily = 'monospace';
    pre.style.textAlign = 'left';
    pre.style.width = '100%';
    pre.style.paddingLeft = '20px';
    state.arr.forEach((line, idx) => {
        const div = document.createElement('div');
        div.innerText = line;
        if (state.active && state.active.includes(idx)) div.style.color = 'var(--primary)';
        pre.appendChild(div);
    });
    viz.appendChild(pre);
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-092-유니온-파인드-simulator.html",
        "title_main": "유니온 파인드", "title_sub": "Union-Find",
        "algo": "경로 압축 + 랭크 기반 합집합", "input_desc": "n=5, unions=[(0,1),(1,2),(3,4),(2,4)]",
        "complexity": "Time O(α(n)) ≈ O(1), Space O(n)",
        "architect": "동적 연결성 관리. 경로 압축으로 find ≈ O(1). 실무: Kruskal MST, 소셜 네트워크 클러스터.",
        "generate_states": """
function generateStates() {
    let parent = [0,1,2,3,4];
    states.push({ arr: [...parent], msg: "초기 상태: 각자 자기 자신이 부모", active: [] });
    parent[1] = 0; states.push({ arr: [...parent], msg: "Union(0,1): 1의 부모를 0으로", active: [1] });
    parent[2] = 0; states.push({ arr: [...parent], msg: "Union(1,2): 2의 부모를 0으로 (경로 압축)", active: [2] });
    parent[4] = 3; states.push({ arr: [...parent], msg: "Union(3,4): 4의 부모를 3으로", active: [4] });
    parent[3] = 0; states.push({ arr: [...parent], msg: "Union(2,4): 3의 부모를 0으로 병합", active: [3] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'array-row';
    state.arr.forEach((val, idx) => {
        const box = document.createElement('div');
        box.className = 'box';
        box.innerHTML = `<span style="font-size:0.6rem;color:#888;position:absolute;top:2px">${idx}</span>${val}`;
        box.style.position = 'relative';
        if (state.active && state.active.includes(idx)) box.classList.add('active');
        row.appendChild(box);
    });
    viz.appendChild(row);
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-093-세그먼트-트리-simulator.html",
        "title_main": "세그먼트 트리", "title_sub": "Segment Tree",
        "algo": "구간 쿼리 / 구간 갱신", "input_desc": "arr=[1,3,5,7]",
        "complexity": "Build O(n), Query/Update O(log n), Space O(n)",
        "architect": "구간 쿼리와 지연 전파. 구간 합/최솟값 O(log n). 실무: 시계열 집계, 범위 업데이트.",
        "generate_states": """
function generateStates() {
    states.push({ arr: ["    [16]    ", "  [4]  [12] ", "[1][3] [5][7]"], msg: "트리 빌드 완료 (구간 합)", active: [0] });
    states.push({ arr: ["    [16]    ", "  [4]  [12] ", "[1][3] [5][7]"], msg: "Query(1,2) -> 3 + 5 = 8", active: [2] });
    states.push({ arr: ["    [20]    ", "  [4]  [16] ", "[1][3] [9][7]"], msg: "Update(2, 9) -> 5가 9로 변경, 조상 노드 갱신", active: [2] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    const pre = document.createElement('pre');
    pre.style.color = 'var(--text)';
    pre.style.fontFamily = 'monospace';
    pre.style.textAlign = 'center';
    pre.style.width = '100%';
    state.arr.forEach((line, idx) => {
        const div = document.createElement('div');
        div.innerText = line;
        if (state.active && state.active.includes(idx)) div.style.color = 'var(--primary)';
        pre.appendChild(div);
    });
    viz.appendChild(pre);
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-094-활동-선택-greedy-simulator.html",
        "title_main": "활동 선택", "title_sub": "Activity Selection (Greedy)",
        "algo": "탐욕 선택 (최조 종료 시간 우선)", "input_desc": "activities=[(1,4),(3,5),(0,6),(5,7)]",
        "complexity": "Time O(n log n), Space O(1)",
        "architect": "탐욕 선택 정당성: 가장 일찍 끝나는 활동을 고르면 남은 시간 최대화.",
        "generate_states": """
function generateStates() {
    let acts = ["(1,4)", "(3,5)", "(0,6)", "(5,7)"];
    states.push({ arr: [...acts], msg: "종료 시간 기준 정렬 완료", active: [] });
    states.push({ arr: [...acts], msg: "(1,4) 선택 (첫 활동)", active: [0], merged: [0] });
    states.push({ arr: [...acts], msg: "(3,5) 거절 (시작 3 < 이전 종료 4)", active: [1], merged: [0], danger: [1] });
    states.push({ arr: [...acts], msg: "(0,6) 거절 (시작 0 < 이전 종료 4)", active: [2], merged: [0], danger: [2] });
    states.push({ arr: [...acts], msg: "(5,7) 선택 (시작 5 >= 이전 종료 4)", active: [3], merged: [0, 3] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'array-row';
    state.arr.forEach((val, idx) => {
        const box = document.createElement('div');
        box.className = 'box';
        box.style.width = '60px';
        box.style.fontSize = '0.9rem';
        box.innerText = val;
        if (state.active && state.active.includes(idx)) box.classList.add('active');
        if (state.merged && state.merged.includes(idx)) box.classList.add('merged');
        if (state.danger && state.danger.includes(idx)) box.classList.add('danger');
        row.appendChild(box);
    });
    viz.appendChild(row);
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-095-허프만-코딩-simulator.html",
        "title_main": "허프만 코딩", "title_sub": "Huffman Coding",
        "algo": "탐욕+힙 (최소 빈도 우선 합병)", "input_desc": "chars={a:5, b:9, c:12, d:13}",
        "complexity": "Time O(n log n), Space O(n)",
        "architect": "데이터 압축과 가변 길이 인코딩. 자주 나오는 문자 = 짧은 코드. 실무: gzip, zip 기초.",
        "generate_states": """
function generateStates() {
    states.push({ arr: ["a:5", "b:9", "c:12", "d:13"], msg: "초기 노드 (빈도순 정렬)", active: [] });
    states.push({ arr: ["ab:14", "c:12", "d:13"], msg: "가장 작은 a(5)와 b(9) 병합 -> ab(14)", active: [0] });
    states.push({ arr: ["c:12", "d:13", "ab:14"], msg: "다시 정렬", active: [] });
    states.push({ arr: ["cd:25", "ab:14"], msg: "c(12)와 d(13) 병합 -> cd(25)", active: [0] });
    states.push({ arr: ["abcd:39"], msg: "최종 루트 노드 완성", active: [0] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'array-row';
    state.arr.forEach((val, idx) => {
        const box = document.createElement('div');
        box.className = 'box';
        box.style.width = 'auto';
        box.style.padding = '0 10px';
        box.innerText = val;
        if (state.active && state.active.includes(idx)) box.classList.add('active');
        row.appendChild(box);
    });
    viz.appendChild(row);
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-096-비트-조작-simulator.html",
        "title_main": "비트 조작", "title_sub": "Bit Manipulation",
        "algo": "XOR / AND / OR / Shift", "input_desc": "n=11 (1011)",
        "complexity": "Time O(1) per operation, Space O(1)",
        "architect": "공간 효율적 상태 표현. XOR: 쌍 소거. n&(n-1): 최하위 1 제거. 실무: 비트마스크 DP, 플래그.",
        "generate_states": """
function generateStates() {
    states.push({ arr: ["1011 (11)"], msg: "초기 값 n = 11", active: [] });
    states.push({ arr: ["1011", "0010", "----", "1001 (9)"], msg: "XOR 연산: 11 ^ 2 = 9", active: [3] });
    states.push({ arr: ["1011", "1010", "----", "1010 (10)"], msg: "n & (n-1): 최하위 1 비트 제거 (11 & 10 = 10)", active: [3] });
    states.push({ arr: ["1011", "0100", "----", "1111 (15)"], msg: "OR 연산: 11 | 4 = 15", active: [3] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    const pre = document.createElement('pre');
    pre.style.color = 'var(--text)';
    pre.style.fontFamily = 'monospace';
    pre.style.textAlign = 'center';
    pre.style.width = '100%';
    pre.style.fontSize = '1.2rem';
    state.arr.forEach((line, idx) => {
        const div = document.createElement('div');
        div.innerText = line;
        if (state.active && state.active.includes(idx)) div.style.color = 'var(--accent)';
        pre.appendChild(div);
    });
    viz.appendChild(pre);
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-097-카운팅-비트-simulator.html",
        "title_main": "카운팅 비트", "title_sub": "Counting Bits",
        "algo": "DP + 비트 연산", "input_desc": "n=5",
        "complexity": "Time O(n), Space O(n)",
        "architect": "DP와 비트 연산 결합. i>>1 = i/2 (한 비트 제거), &1 = 최하위 비트.",
        "generate_states": """
function generateStates() {
    let dp = [0];
    states.push({ arr: [...dp], msg: "초기화: dp[0]=0 (000)", active: [0] });
    for(let i=1; i<=5; i++) {
        dp[i] = dp[i>>1] + (i&1);
        states.push({ arr: [...dp], msg: `dp[${i}] (${i.toString(2)}) = dp[${i>>1}] + ${i&1} = ${dp[i]}`, active: [i] });
    }
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'array-row';
    state.arr.forEach((val, idx) => {
        const box = document.createElement('div');
        box.className = 'box';
        box.innerText = val;
        box.title = idx.toString(2);
        if (state.active && state.active.includes(idx)) box.classList.add('active');
        row.appendChild(box);
    });
    viz.appendChild(row);
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-098-구간-dp-행렬-곱셈-simulator.html",
        "title_main": "구간 DP", "title_sub": "Matrix Chain Multiplication",
        "algo": "Interval DP (최적 분할)", "input_desc": "dims=[10,30,5,60]",
        "complexity": "Time O(n³), Space O(n²)",
        "architect": "최적 분할 전략. 연산 순서에 따라 곱셈 횟수 천 배 차이. 최적 괄호 위치 탐색.",
        "generate_states": """
function generateStates() {
    states.push({ grid: [[0,0,0],[0,0,0],[0,0,0]], msg: "초기 DP 테이블 (길이 1은 비용 0)", active: [] });
    states.push({ grid: [[0,1500,0],[0,0,9000],[0,0,0]], msg: "길이 2 구간 계산: dp[0][1]=1500, dp[1][2]=9000", active: [0,1] });
    states.push({ grid: [[0,1500,4500],[0,0,9000],[0,0,0]], msg: "길이 3 구간 계산: dp[0][2]=4500 (최적 분할)", active: [0,2] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    state.grid.forEach((row, i) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'grid-row';
        row.forEach((val, j) => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.style.width = '50px';
            cell.innerText = val;
            if (state.active && state.active[0] === i && state.active[1] === j) cell.classList.add('active');
            rowDiv.appendChild(cell);
        });
        viz.appendChild(rowDiv);
    });
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-099-최대-사각형-maximal-square-simulator.html",
        "title_main": "최대 사각형", "title_sub": "Maximal Square",
        "algo": "2D DP", "input_desc": "matrix=[['1','0','1'],['1','1','1'],['1','1','1']]",
        "complexity": "Time O(m×n), Space O(m×n)",
        "architect": "기하학적 DP. dp[i][j] = 우하귀를 (i,j)로 하는 최대 정사각형 변의 길이. min 3방향으로 병목 탐색.",
        "generate_states": """
function generateStates() {
    let mat = [[1,0,1],[1,1,1],[1,1,1]];
    let dp = [[1,0,1],[1,1,1],[1,1,1]];
    states.push({ grid: dp.map(r=>[...r]), msg: "초기 상태 (첫 행/열은 그대로)", active: [] });
    dp[1][1] = 1; states.push({ grid: dp.map(r=>[...r]), msg: "dp[1][1] = min(1,0,1)+1 = 1", active: [1,1] });
    dp[1][2] = 2; states.push({ grid: dp.map(r=>[...r]), msg: "dp[1][2] = min(1,1,0)+1 = 2", active: [1,2] });
    dp[2][1] = 2; states.push({ grid: dp.map(r=>[...r]), msg: "dp[2][1] = min(1,1,1)+1 = 2", active: [2,1] });
    dp[2][2] = 2; states.push({ grid: dp.map(r=>[...r]), msg: "dp[2][2] = min(1,2,2)+1 = 2 (최대 크기 2x2)", active: [2,2] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    state.grid.forEach((row, i) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'grid-row';
        row.forEach((val, j) => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.innerText = val;
            if (state.active && state.active[0] === i && state.active[1] === j) cell.classList.add('active');
            rowDiv.appendChild(cell);
        });
        viz.appendChild(rowDiv);
    });
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    },
    {
        "filename": "algo-100-lru-ttl-캐시-시스템-simulator.html",
        "title_main": "LRU+TTL 캐시", "title_sub": "LRU Cache with TTL",
        "algo": "복합 자료구조 (HashMap + Double Linked List + TTL)", "input_desc": "capacity=3",
        "complexity": "Time O(1) get/put, Space O(capacity)",
        "architect": "실무 시스템 설계 종합. Redis의 핵심 구조. 메모리 제한+시간 기반 만료 결합.",
        "generate_states": """
function generateStates() {
    states.push({ arr: [], msg: "초기 캐시 비어있음 (Capacity: 3)", active: [] });
    states.push({ arr: ["[1:A]"], msg: "put(1,A)", active: [0] });
    states.push({ arr: ["[2:B]", "[1:A]"], msg: "put(2,B) - MRU가 맨 앞", active: [0] });
    states.push({ arr: ["[3:C]", "[2:B]", "[1:A]"], msg: "put(3,C)", active: [0] });
    states.push({ arr: ["[1:A]", "[3:C]", "[2:B]"], msg: "get(1) - 1이 MRU로 이동", active: [0] });
    states.push({ arr: ["[4:D]", "[1:A]", "[3:C]"], msg: "put(4,D) - 용량 초과로 LRU [2:B] 퇴출", active: [0], danger: [2] });
}
generateStates();
""",
        "render_func": """
function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'array-row';
    state.arr.forEach((val, idx) => {
        const box = document.createElement('div');
        box.className = 'box';
        box.style.width = '60px';
        box.innerText = val;
        if (state.active && state.active.includes(idx)) box.classList.add('active');
        if (state.danger && state.danger.includes(idx)) box.classList.add('danger');
        row.appendChild(box);
    });
    viz.appendChild(row);
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${currentStep + 1} / ${states.length}`;
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}
"""
    }
]

for algo in algos:
    html_content = html_template.format(
        css=css_template,
        title=algo["title_main"] + " — " + algo["title_sub"],
        title_main=algo["title_main"],
        title_sub=algo["title_sub"],
        algo=algo["algo"],
        input_desc=algo["input_desc"],
        complexity=algo["complexity"],
        architect=algo["architect"],
        generate_states=algo["generate_states"],
        render_func=algo["render_func"]
    )
    
    file_path = os.path.join(out_dir, algo["filename"])
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(html_content)

print("Generated 20 files successfully.")
