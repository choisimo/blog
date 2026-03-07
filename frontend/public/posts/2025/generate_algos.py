import os
import json

base_dir = "/home/nodove/workspace/blog/frontend/public/posts/2025"

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
.viz{background:#1a1a1a;border:1px solid var(--border);border-radius:6px;padding:12px;min-height:120px;margin-bottom:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
.log{font-size:.8rem;color:#888;min-height:36px;padding:4px 0}
.array-row { display: flex; gap: 8px; justify-content: center; min-height: 40px; }
.box { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: #333; border: 2px solid var(--border); border-radius: 6px; font-weight: bold; font-size: 1.1rem; transition: all 0.3s; }
.box.active { border-color: var(--primary); box-shadow: 0 0 8px var(--primary); transform: translateY(-2px); }
.box.merged { border-color: var(--accent); background: rgba(76,175,80,0.2); color: var(--accent); }
.code-panel { background: #1e1e1e; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #d4d4d4; border: 1px solid var(--border); }
.code-line { padding: 2px 4px; border-left: 3px solid transparent; }
.code-line.active { background: var(--hl); border-left-color: var(--primary); }
"""

modal_js = """
document.getElementById('btn-info').addEventListener('click',()=>document.getElementById('modal').classList.add('open'));
document.getElementById('modal-close').addEventListener('click',()=>document.getElementById('modal').classList.remove('open'));
document.getElementById('modal').addEventListener('click',e=>{if(e.target===document.getElementById('modal'))document.getElementById('modal').classList.remove('open');});
"""


def generate_html(
    filename, title, subtitle, problem, idea, time_comp, space_comp, architect, js_logic
):
    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — {subtitle}</title>
<style>
{css_template}
</style>
</head>
<body style="flex-direction:column;">
<div class="header" style="width:100%;max-width:680px;">
    <h2>{title} <span class="sub">— {subtitle}</span></h2>
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
    <div class="code-panel">
        <div class="code-line" id="line-1">def solve(arr):</div>
        <div class="code-line" id="line-2">    # Implementation</div>
        <div class="code-line" id="line-3">    pass</div>
    </div>
</div>

<div class="modal-overlay" id="modal">
    <div class="modal">
        <button class="modal-close" id="modal-close">✕</button>
        <h3>{title} — {subtitle}</h3>
        <section><h4>📌 문제</h4><p>{problem}</p></section>
        <section><h4>💡 핵심 아이디어</h4><ul>{idea}</ul></section>
        <section><h4>⏱ 복잡도</h4><span class="tag">시간: {time_comp}</span><span class="tag">공간: {space_comp}</span></section>
        <section><h4>🏗 아키텍트의 시선</h4><p>{architect}</p></section>
    </div>
</div>

<script>
{js_logic}

let currentStep = 0;
let playing = false;
let timer;

const viz = document.getElementById('viz');
const log = document.getElementById('log');
const stepCounter = document.getElementById('step-counter');

function render() {{
    if(states.length === 0) return;
    const state = states[currentStep];
    viz.innerHTML = '';
    
    const row = document.createElement('div');
    row.className = 'array-row';
    
    if(state.arrs) {{
        let globalIdx = 0;
        state.arrs.forEach(subArr => {{
            const group = document.createElement('div');
            group.style.display = 'flex';
            group.style.gap = '4px';
            group.style.margin = '0 8px';
            
            subArr.forEach(val => {{
                const box = document.createElement('div');
                box.className = 'box';
                box.innerText = val;
                if (state.activeIndices && state.activeIndices.includes(globalIdx)) box.classList.add('active');
                if (state.mergedIndices && state.mergedIndices.includes(globalIdx)) box.classList.add('merged');
                group.appendChild(box);
                globalIdx++;
            }});
            row.appendChild(group);
        }});
    }} else if(state.arr) {{
        state.arr.forEach((val, idx) => {{
            const box = document.createElement('div');
            box.className = 'box';
            box.innerText = val;
            if (state.activeIndices && state.activeIndices.includes(idx)) box.classList.add('active');
            if (state.mergedIndices && state.mergedIndices.includes(idx)) box.classList.add('merged');
            row.appendChild(box);
        }});
    }}
    
    viz.appendChild(row);
    log.innerText = state.msg;
    stepCounter.innerText = `Step: ${{currentStep + 1}} / ${{states.length}}`;
    
    document.querySelectorAll('.code-line').forEach(el => el.classList.remove('active'));
    if (state.line) {{
        const lineEl = document.getElementById(`line-${{state.line}}`);
        if (lineEl) lineEl.classList.add('active');
    }}
    
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}}

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

{modal_js}

render();
</script>
</body>
</html>"""
    with open(os.path.join(base_dir, filename), "w", encoding="utf-8") as f:
        f.write(html)


algos = [
    {
        "filename": "algo-031-병합-정렬-merge-sort-simulator.html",
        "title": "병합 정렬",
        "subtitle": "Merge Sort",
        "problem": "배열 [5, 3, 8, 1, 2]를 병합 정렬을 사용하여 오름차순으로 정렬하라.",
        "idea": "<li>배열을 반으로 계속 나눈다 (Divide).</li><li>크기가 1이 되면 정렬된 것으로 본다.</li><li>두 개의 정렬된 배열을 하나로 합친다 (Merge).</li>",
        "time_comp": "O(n log n)",
        "space_comp": "O(n)",
        "architect": "분할 정복(Divide and Conquer)의 대표적인 알고리즘. 안정 정렬(Stable Sort)이며, 연결 리스트 정렬에 매우 효율적이다.",
        "js_logic": """
let states = [];
function generateStates() {
    states.push({ arrs: [[5, 3, 8, 1, 2]], msg: "초기 배열", line: 1 });
    states.push({ arrs: [[5, 3], [8, 1, 2]], msg: "배열을 반으로 나눔", line: 2 });
    states.push({ arrs: [[5], [3], [8, 1], [2]], msg: "계속해서 반으로 나눔", line: 2 });
    states.push({ arrs: [[5], [3], [8], [1], [2]], msg: "모든 요소가 1개가 될 때까지 분할", line: 2 });
    states.push({ arrs: [[3, 5], [8], [1], [2]], msg: "5와 3을 병합", line: 3, activeIndices: [0, 1], mergedIndices: [0, 1] });
    states.push({ arrs: [[3, 5], [1, 8], [2]], msg: "8과 1을 병합", line: 3, activeIndices: [2, 3], mergedIndices: [2, 3] });
    states.push({ arrs: [[3, 5], [1, 2, 8]], msg: "1,8과 2를 병합", line: 3, activeIndices: [2, 3, 4], mergedIndices: [2, 3, 4] });
    states.push({ arrs: [[1, 2, 3, 5, 8]], msg: "최종 병합 완료", line: 3, activeIndices: [], mergedIndices: [0, 1, 2, 3, 4] });
}
generateStates();
""",
    },
    {
        "filename": "algo-032-퀵-정렬-quick-sort-simulator.html",
        "title": "퀵 정렬",
        "subtitle": "Quick Sort",
        "problem": "배열 [10, 7, 8, 9, 1, 5]를 퀵 정렬을 사용하여 오름차순으로 정렬하라.",
        "idea": "<li>피벗(pivot)을 선택한다 (보통 마지막 요소).</li><li>피벗보다 작은 요소는 왼쪽, 큰 요소는 오른쪽으로 분할(partition)한다.</li><li>분할된 두 부분 배열에 대해 재귀적으로 퀵 정렬을 수행한다.</li>",
        "time_comp": "O(n log n) avg",
        "space_comp": "O(log n)",
        "architect": "평균적으로 가장 빠른 정렬 알고리즘. 불안정 정렬(Unstable Sort)이며, 캐시 지역성(Cache Locality)이 좋아 실무에서 많이 쓰인다.",
        "js_logic": """
let states = [];
function generateStates() {
    states.push({ arr: [10, 7, 8, 9, 1, 5], msg: "초기 배열. 피벗은 5", line: 1, activeIndices: [5] });
    states.push({ arr: [10, 7, 8, 9, 1, 5], msg: "10은 5보다 크므로 패스", line: 2, activeIndices: [0, 5] });
    states.push({ arr: [10, 7, 8, 9, 1, 5], msg: "1은 5보다 작으므로 스왑 준비", line: 2, activeIndices: [4, 5] });
    states.push({ arr: [1, 7, 8, 9, 10, 5], msg: "1과 10 스왑", line: 3, activeIndices: [0, 4], mergedIndices: [0] });
    states.push({ arr: [1, 5, 8, 9, 10, 7], msg: "피벗 5를 제자리로 스왑", line: 3, activeIndices: [1, 5], mergedIndices: [1] });
    states.push({ arr: [1, 5, 8, 9, 10, 7], msg: "피벗 5 기준 왼쪽(1), 오른쪽(8,9,10,7) 분할 완료", line: 3, mergedIndices: [0, 1] });
    states.push({ arr: [1, 5, 7, 8, 9, 10], msg: "오른쪽 부분 배열 재귀 정렬 완료", line: 3, mergedIndices: [0, 1, 2, 3, 4, 5] });
}
generateStates();
""",
    },
    {
        "filename": "algo-033-k번째-큰-수-quick-select-simulator.html",
        "title": "K번째 큰 수",
        "subtitle": "QuickSelect",
        "problem": "배열 [3, 2, 1, 5, 6, 4]에서 2번째로 큰 수를 찾아라.",
        "idea": "<li>퀵 정렬의 파티션 로직을 사용한다.</li><li>피벗의 인덱스가 타겟 인덱스(n-k)와 같으면 정답.</li><li>다르면 타겟이 있는 쪽만 재귀적으로 탐색한다.</li>",
        "time_comp": "O(n) avg",
        "space_comp": "O(1)",
        "architect": "전체를 정렬할 필요 없이 K번째 요소만 찾을 때 유용하다. 평균 O(n)으로 매우 빠르다.",
        "js_logic": """
let states = [];
function generateStates() {
    states.push({ arr: [3, 2, 1, 5, 6, 4], msg: "초기 배열. k=2, target index=4. 피벗은 4", line: 1, activeIndices: [5] });
    states.push({ arr: [3, 2, 1, 4, 6, 5], msg: "파티션 완료. 피벗 4의 인덱스는 3", line: 2, activeIndices: [3] });
    states.push({ arr: [3, 2, 1, 4, 6, 5], msg: "3 < 4 이므로 오른쪽 [6, 5] 탐색", line: 2, activeIndices: [4, 5] });
    states.push({ arr: [3, 2, 1, 4, 5, 6], msg: "파티션 완료. 피벗 5의 인덱스는 4", line: 3, activeIndices: [4] });
    states.push({ arr: [3, 2, 1, 4, 5, 6], msg: "인덱스 4 == target index. 정답은 5", line: 3, mergedIndices: [4] });
}
generateStates();
""",
    },
    {
        "filename": "algo-034-이진-탐색-binary-search-simulator.html",
        "title": "이진 탐색",
        "subtitle": "Binary Search",
        "problem": "정렬된 배열 [-1, 0, 3, 5, 9, 12]에서 9의 위치를 찾아라.",
        "idea": "<li>배열의 중간값(mid)을 확인한다.</li><li>mid가 타겟보다 작으면 오른쪽 절반을 탐색한다.</li><li>mid가 타겟보다 크면 왼쪽 절반을 탐색한다.</li>",
        "time_comp": "O(log n)",
        "space_comp": "O(1)",
        "architect": "정렬된 데이터에서 탐색할 때 가장 기본이 되는 알고리즘. O(log n)의 강력한 성능을 자랑한다.",
        "js_logic": """
let states = [];
function generateStates() {
    states.push({ arr: [-1, 0, 3, 5, 9, 12], msg: "초기 배열. target=9. left=0, right=5", line: 1, activeIndices: [0, 5] });
    states.push({ arr: [-1, 0, 3, 5, 9, 12], msg: "mid=2 (값: 3). 3 < 9 이므로 오른쪽 탐색", line: 2, activeIndices: [2] });
    states.push({ arr: [-1, 0, 3, 5, 9, 12], msg: "left=3, right=5", line: 2, activeIndices: [3, 5] });
    states.push({ arr: [-1, 0, 3, 5, 9, 12], msg: "mid=4 (값: 9). 9 == 9 정답 발견!", line: 3, mergedIndices: [4] });
}
generateStates();
""",
    },
    {
        "filename": "algo-035-회전-배열-탐색-simulator.html",
        "title": "회전 배열 탐색",
        "subtitle": "Search in Rotated Array",
        "problem": "회전된 정렬 배열 [4, 5, 6, 7, 0, 1, 2]에서 0의 위치를 찾아라.",
        "idea": "<li>mid를 기준으로 왼쪽 또는 오른쪽 중 하나는 반드시 정렬되어 있다.</li><li>정렬된 쪽에 타겟이 포함되는지 확인하여 탐색 범위를 좁힌다.</li>",
        "time_comp": "O(log n)",
        "space_comp": "O(1)",
        "architect": "이진 탐색의 응용. 조건 분기를 통해 정렬된 구간을 파악하는 것이 핵심이다.",
        "js_logic": """
let states = [];
function generateStates() {
    states.push({ arr: [4, 5, 6, 7, 0, 1, 2], msg: "초기 배열. target=0. left=0, right=6", line: 1, activeIndices: [0, 6] });
    states.push({ arr: [4, 5, 6, 7, 0, 1, 2], msg: "mid=3 (값: 7). 왼쪽 [4..7]은 정렬됨", line: 2, activeIndices: [3] });
    states.push({ arr: [4, 5, 6, 7, 0, 1, 2], msg: "0은 [4..7]에 없으므로 오른쪽 탐색", line: 2, activeIndices: [4, 6] });
    states.push({ arr: [4, 5, 6, 7, 0, 1, 2], msg: "left=4, right=6. mid=5 (값: 1)", line: 3, activeIndices: [5] });
    states.push({ arr: [4, 5, 6, 7, 0, 1, 2], msg: "1 > 0 이므로 왼쪽 탐색. left=4, right=4", line: 3, activeIndices: [4] });
    states.push({ arr: [4, 5, 6, 7, 0, 1, 2], msg: "mid=4 (값: 0). 정답 발견!", line: 3, mergedIndices: [4] });
}
generateStates();
""",
    },
    {
        "filename": "algo-036-첫-마지막-위치-simulator.html",
        "title": "첫/마지막 위치",
        "subtitle": "Find First and Last Position",
        "problem": "정렬된 배열 [5, 7, 7, 8, 8, 10]에서 8의 시작과 끝 위치를 찾아라.",
        "idea": "<li>이진 탐색을 두 번 수행한다.</li><li>첫 번째는 타겟의 가장 왼쪽 위치(Lower Bound)를 찾는다.</li><li>두 번째는 타겟의 가장 오른쪽 위치(Upper Bound)를 찾는다.</li>",
        "time_comp": "O(log n)",
        "space_comp": "O(1)",
        "architect": "Lower Bound와 Upper Bound의 개념을 이해하는 데 좋은 문제다.",
        "js_logic": """
let states = [];
function generateStates() {
    states.push({ arr: [5, 7, 7, 8, 8, 10], msg: "초기 배열. target=8. 첫 위치 탐색 시작", line: 1 });
    states.push({ arr: [5, 7, 7, 8, 8, 10], msg: "mid=2 (값: 7). 7 < 8 이므로 오른쪽 탐색", line: 2, activeIndices: [2] });
    states.push({ arr: [5, 7, 7, 8, 8, 10], msg: "mid=4 (값: 8). 8 == 8 이지만 첫 위치를 위해 왼쪽 탐색", line: 2, activeIndices: [4] });
    states.push({ arr: [5, 7, 7, 8, 8, 10], msg: "첫 위치 발견: 인덱스 3", line: 2, mergedIndices: [3] });
    states.push({ arr: [5, 7, 7, 8, 8, 10], msg: "마지막 위치 탐색 시작", line: 3, mergedIndices: [3] });
    states.push({ arr: [5, 7, 7, 8, 8, 10], msg: "mid=4 (값: 8). 8 == 8 이지만 마지막 위치를 위해 오른쪽 탐색", line: 3, activeIndices: [4], mergedIndices: [3] });
    states.push({ arr: [5, 7, 7, 8, 8, 10], msg: "마지막 위치 발견: 인덱스 4. 결과 [3, 4]", line: 3, mergedIndices: [3, 4] });
}
generateStates();
""",
    },
    {
        "filename": "algo-037-행렬-탐색-2d-matrix-simulator.html",
        "title": "행렬 탐색",
        "subtitle": "Search a 2D Matrix",
        "problem": "정렬된 2D 행렬에서 3을 찾아라.",
        "idea": "<li>2D 행렬을 1D 배열처럼 취급하여 이진 탐색을 수행한다.</li><li>1D 인덱스 `mid`를 2D 인덱스 `(mid // cols, mid % cols)`로 변환한다.</li>",
        "time_comp": "O(log(m*n))",
        "space_comp": "O(1)",
        "architect": "2D 좌표와 1D 인덱스 간의 매핑 공식을 활용하는 우아한 방법이다.",
        "js_logic": """
let states = [];
function generateStates() {
    states.push({ arr: [1, 3, 5, 7, 10, 11, 16, 20, 23, 30, 34, 60], msg: "2D 행렬을 1D로 펼친 모습. target=3", line: 1 });
    states.push({ arr: [1, 3, 5, 7, 10, 11, 16, 20, 23, 30, 34, 60], msg: "left=0, right=11. mid=5 (값: 11)", line: 2, activeIndices: [5] });
    states.push({ arr: [1, 3, 5, 7, 10, 11, 16, 20, 23, 30, 34, 60], msg: "11 > 3 이므로 왼쪽 탐색", line: 2, activeIndices: [0, 4] });
    states.push({ arr: [1, 3, 5, 7, 10, 11, 16, 20, 23, 30, 34, 60], msg: "left=0, right=4. mid=2 (값: 5)", line: 3, activeIndices: [2] });
    states.push({ arr: [1, 3, 5, 7, 10, 11, 16, 20, 23, 30, 34, 60], msg: "5 > 3 이므로 왼쪽 탐색", line: 3, activeIndices: [0, 1] });
    states.push({ arr: [1, 3, 5, 7, 10, 11, 16, 20, 23, 30, 34, 60], msg: "mid=0 (값: 1). 1 < 3 이므로 오른쪽 탐색", line: 3, activeIndices: [0] });
    states.push({ arr: [1, 3, 5, 7, 10, 11, 16, 20, 23, 30, 34, 60], msg: "mid=1 (값: 3). 정답 발견!", line: 3, mergedIndices: [1] });
}
generateStates();
""",
    },
    {
        "filename": "algo-038-제곱근-sqrt-simulator.html",
        "title": "제곱근",
        "subtitle": "Sqrt(x)",
        "problem": "x=8의 제곱근(정수 부분)을 구하라.",
        "idea": "<li>1부터 x/2까지의 범위에서 이진 탐색을 수행한다.</li><li>`mid * mid`가 x와 같으면 mid 반환, 크면 왼쪽, 작으면 오른쪽 탐색.</li>",
        "time_comp": "O(log x)",
        "space_comp": "O(1)",
        "architect": "수학적 문제를 탐색 문제로 치환하여 푸는 좋은 예시이다.",
        "js_logic": """
let states = [];
function generateStates() {
    states.push({ arr: [1, 2, 3, 4], msg: "탐색 범위 [1..4]. target x=8", line: 1 });
    states.push({ arr: [1, 2, 3, 4], msg: "mid=2. 2*2 = 4 < 8 이므로 오른쪽 탐색", line: 2, activeIndices: [1] });
    states.push({ arr: [1, 2, 3, 4], msg: "mid=3. 3*3 = 9 > 8 이므로 왼쪽 탐색", line: 2, activeIndices: [2] });
    states.push({ arr: [1, 2, 3, 4], msg: "탐색 종료. 정답은 2 (floor)", line: 3, mergedIndices: [1] });
}
generateStates();
""",
    },
    {
        "filename": "algo-039-정렬-색깔-dutch-flag-simulator.html",
        "title": "색깔 정렬",
        "subtitle": "Dutch National Flag",
        "problem": "배열 [2, 0, 2, 1, 1, 0]을 0, 1, 2 순서로 정렬하라.",
        "idea": "<li>3개의 포인터(low, mid, high)를 사용한다.</li><li>mid가 0이면 low와 스왑, 1이면 패스, 2이면 high와 스왑한다.</li>",
        "time_comp": "O(n)",
        "space_comp": "O(1)",
        "architect": "원 패스(One-pass)로 3가지 값을 분류하는 우아한 알고리즘이다.",
        "js_logic": """
let states = [];
function generateStates() {
    states.push({ arr: [2, 0, 2, 1, 1, 0], msg: "초기 배열. low=0, mid=0, high=5", line: 1, activeIndices: [0, 5] });
    states.push({ arr: [2, 0, 2, 1, 1, 0], msg: "mid(0)가 2이므로 high(5)와 스왑", line: 2, activeIndices: [0, 5] });
    states.push({ arr: [0, 0, 2, 1, 1, 2], msg: "스왑 완료. high 감소", line: 2, activeIndices: [0, 4] });
    states.push({ arr: [0, 0, 2, 1, 1, 2], msg: "mid(0)가 0이므로 low(0)와 스왑. low, mid 증가", line: 3, activeIndices: [0] });
    states.push({ arr: [0, 0, 2, 1, 1, 2], msg: "mid(1)가 0이므로 low(1)와 스왑. low, mid 증가", line: 3, activeIndices: [1] });
    states.push({ arr: [0, 0, 2, 1, 1, 2], msg: "mid(2)가 2이므로 high(4)와 스왑", line: 3, activeIndices: [2, 4] });
    states.push({ arr: [0, 0, 1, 1, 2, 2], msg: "스왑 완료. high 감소", line: 3, activeIndices: [2, 3] });
    states.push({ arr: [0, 0, 1, 1, 2, 2], msg: "mid(2)가 1이므로 패스. mid 증가", line: 3, activeIndices: [2] });
    states.push({ arr: [0, 0, 1, 1, 2, 2], msg: "mid(3)가 1이므로 패스. mid 증가", line: 3, activeIndices: [3] });
    states.push({ arr: [0, 0, 1, 1, 2, 2], msg: "정렬 완료!", line: 3, mergedIndices: [0, 1, 2, 3, 4, 5] });
}
generateStates();
""",
    },
    {
        "filename": "algo-040-구간-병합-merge-intervals-simulator.html",
        "title": "구간 병합",
        "subtitle": "Merge Intervals",
        "problem": "구간 배열 [[1,3], [2,6], [8,10], [15,18]]을 병합하라.",
        "idea": "<li>구간을 시작 시간 기준으로 정렬한다.</li><li>현재 구간의 시작 시간이 이전 구간의 끝 시간보다 작거나 같으면 병합한다.</li>",
        "time_comp": "O(n log n)",
        "space_comp": "O(n)",
        "architect": "정렬 후 선형 스캔(Sweep Line)을 하는 전형적인 패턴이다.",
        "js_logic": """
let states = [];
function generateStates() {
    states.push({ arrs: [[1,3], [2,6], [8,10], [15,18]], msg: "초기 구간 배열 (정렬됨)", line: 1 });
    states.push({ arrs: [[1,3], [2,6], [8,10], [15,18]], msg: "[1,3]과 [2,6] 비교. 겹치므로 병합", line: 2, activeIndices: [0, 1] });
    states.push({ arrs: [[1,6], [8,10], [15,18]], msg: "병합됨: [1,6]", line: 2, mergedIndices: [0] });
    states.push({ arrs: [[1,6], [8,10], [15,18]], msg: "[1,6]과 [8,10] 비교. 안 겹침", line: 3, activeIndices: [0, 1] });
    states.push({ arrs: [[1,6], [8,10], [15,18]], msg: "[8,10]과 [15,18] 비교. 안 겹침", line: 3, activeIndices: [1, 2] });
    states.push({ arrs: [[1,6], [8,10], [15,18]], msg: "병합 완료!", line: 3, mergedIndices: [0, 1, 2] });
}
generateStates();
""",
    },
]

for algo in algos:
    generate_html(
        algo["filename"],
        algo["title"],
        algo["subtitle"],
        algo["problem"],
        algo["idea"],
        algo["time_comp"],
        algo["space_comp"],
        algo["architect"],
        algo["js_logic"],
    )
    print(f"Generated {algo['filename']}")
