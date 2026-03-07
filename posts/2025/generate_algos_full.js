import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cssTemplate = [
  "*{box-sizing:border-box;margin:0;padding:0}",
  "body{background:var(--bg);color:var(--text);font-family:'Segoe UI',sans-serif;font-size:14px;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}",
  ":root{--bg:#1e1e1e;--panel:#252526;--text:#d4d4d4;--border:#3e3e42;--primary:#007acc;--primary-h:#005999;--accent:#4CAF50;--danger:#f44336;--hl:#264f78}",
  ".card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:20px;width:100%;max-width:680px}",
  ".header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:0 4px}",
  ".header h2{margin:0;font-size:1.05rem;color:#fff}",
  ".header .sub{color:#888;font-weight:400}",
  ".btn-info{background:none;border:1px solid var(--border);border-radius:50%;width:26px;height:26px;color:#888;cursor:pointer;font-size:.85rem;font-weight:bold;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0}",
  ".btn-info:hover{border-color:var(--primary);color:var(--primary)}",
  ".modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100;align-items:center;justify-content:center}",
  ".modal-overlay.open{display:flex}",
  ".modal{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:28px 32px;max-width:560px;width:90%;max-height:80vh;overflow-y:auto;position:relative}",
  ".modal h3{margin:0 0 16px;color:#fff;font-size:1.1rem}",
  ".modal section{margin-bottom:16px}",
  ".modal h4{margin:0 0 6px;color:var(--primary);font-size:.85rem;text-transform:uppercase;letter-spacing:.05em}",
  ".modal p,.modal li{font-size:.9rem;line-height:1.6;color:var(--text);margin:0 0 4px}",
  ".modal ul{padding-left:18px;margin:0}",
  ".tag{display:inline-block;background:#2d2d30;border:1px solid var(--border);border-radius:4px;padding:2px 8px;font-size:.8rem;margin-right:6px;color:#4fc3f7;font-family:monospace}",
  ".modal-close{position:absolute;top:12px;right:14px;background:none;border:none;color:#888;font-size:1.2rem;cursor:pointer;padding:0;line-height:1}",
  ".modal-close:hover{color:#fff}",
  ".controls{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:12px}",
  "button{background:var(--primary);border:none;border-radius:4px;color:#fff;cursor:pointer;padding:5px 12px;font-size:.8rem}",
  "button:hover{background:var(--primary-h)}",
  "button:disabled{opacity:.4;cursor:default}",
  ".step-info{font-size:.82rem;color:#888;margin-left:auto}",
  "input[type=range]{accent-color:var(--primary);width:80px}",
  ".viz{background:#1a1a1a;border:1px solid var(--border);border-radius:6px;padding:12px;min-height:120px;margin-bottom:10px;display:flex;flex-direction:column;gap:10px}",
  ".log{font-size:.8rem;color:#888;min-height:36px;padding:4px 0}",
  ".array-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}",
  ".box{width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:#333;border:2px solid var(--border);border-radius:6px;font-weight:bold}",
  ".box.active{border-color:var(--primary);box-shadow:0 0 8px var(--primary)}",
  ".box.accent{border-color:var(--accent);color:var(--accent);background:rgba(76,175,80,.15)}",
  ".panel{background:#1e1e1e;border:1px solid var(--border);border-radius:6px;padding:10px;font-family:monospace;white-space:pre-wrap}",
  ".kv{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:start}",
  ".kv .k{color:#888}",
  ".kv .v{color:#d4d4d4}",
  ".grid{display:grid;gap:4px;justify-content:center}",
  ".cell{width:30px;height:30px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;border-radius:4px}",
].join("\n");

function complexityToHtml(complexity) {
  if (complexity.indexOf("<span") >= 0) {
    return complexity;
  }
  const parts = complexity.split("/").map((p) => p.trim()).filter(Boolean);
  return parts.map((p) => "<span class=\"tag\">" + p + "</span>").join("");
}

function splitTitle(title) {
  const parts = title.split("—");
  return {
    ko: (parts[0] || "").trim(),
    en: (parts[1] || "").trim(),
  };
}

function load061to080() {
  const srcPath = path.join(__dirname, "generate_algos.js");
  const src = fs.readFileSync(srcPath, "utf8");
  const marker = "const algos = [";
  const markerIndex = src.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error("Cannot locate algos array in generate_algos.js");
  }
  const arrStart = src.indexOf("[", markerIndex);
  let depth = 0;
  let arrEnd = -1;
  for (let i = arrStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "[") depth += 1;
    if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        arrEnd = i;
        break;
      }
    }
  }
  if (arrEnd < 0) {
    throw new Error("Failed to parse algos array in generate_algos.js");
  }
  const arrCode = src.slice(arrStart, arrEnd + 1);
  const arr = Function("return " + arrCode + ";")();
  return arr;
}

function buildGenericJs(states) {
  const statesJson = JSON.stringify(states);
  return [
    "let states = " + statesJson + ";",
    "function makeBox(value, mode) {",
    "  const d = document.createElement('div');",
    "  d.className = 'box';",
    "  if (mode === 'active') d.classList.add('active');",
    "  if (mode === 'accent') d.classList.add('accent');",
    "  d.innerText = String(value);",
    "  return d;",
    "}",
    "function asArray(v) { return Array.isArray(v) ? v : []; }",
    "function renderGrid(grid, activeSet) {",
    "  const wrap = document.createElement('div');",
    "  wrap.className = 'grid';",
    "  wrap.style.gridTemplateColumns = 'repeat(' + (grid[0] ? grid[0].length : 1) + ', 30px)';",
    "  for (let r = 0; r < grid.length; r += 1) {",
    "    for (let c = 0; c < grid[r].length; c += 1) {",
    "      const cell = document.createElement('div');",
    "      cell.className = 'cell';",
    "      const key = r + ',' + c;",
    "      if (activeSet.has(key)) cell.style.borderColor = 'var(--primary)';",
    "      cell.innerText = String(grid[r][c]);",
    "      wrap.appendChild(cell);",
    "    }",
    "  }",
    "  return wrap;",
    "}",
    "function renderState(state) {",
    "  viz.innerHTML = '';",
    "  const active = new Set(asArray(state.active).map((x) => String(x)));",
    "  const result = new Set(asArray(state.result).map((x) => String(x)));",
    "  if (Array.isArray(state.arr)) {",
    "    const row = document.createElement('div');",
    "    row.className = 'array-row';",
    "    for (let i = 0; i < state.arr.length; i += 1) {",
    "      let mode = '';",
    "      if (active.has(String(i)) || i === state.fast || i === state.left || i === state.right || i === state.mid) mode = 'active';",
    "      if (result.has(String(i)) || i === state.slow) mode = 'accent';",
    "      row.appendChild(makeBox(state.arr[i], mode));",
    "    }",
    "    viz.appendChild(row);",
    "  }",
    "  if (Array.isArray(state.grid)) {",
    "    const gSet = new Set(asArray(state.path).map((p) => p[0] + ',' + p[1]));",
    "    viz.appendChild(renderGrid(state.grid, gSet));",
    "  }",
    "  if (!Array.isArray(state.arr) && !Array.isArray(state.grid)) {",
    "    const panel = document.createElement('div');",
    "    panel.className = 'panel';",
    "    panel.innerText = JSON.stringify(state, null, 2);",
    "    viz.appendChild(panel);",
    "  } else {",
    "    const kv = document.createElement('div');",
    "    kv.className = 'kv';",
    "    const keys = Object.keys(state).filter((k) => k !== 'arr' && k !== 'grid' && k !== 'msg' && k !== 'active' && k !== 'result');",
    "    for (let i = 0; i < keys.length; i += 1) {",
    "      const k = keys[i];",
    "      const kd = document.createElement('div');",
    "      kd.className = 'k';",
    "      kd.innerText = k;",
    "      const vd = document.createElement('div');",
    "      vd.className = 'v';",
    "      vd.innerText = typeof state[k] === 'string' ? state[k] : JSON.stringify(state[k]);",
    "      kv.appendChild(kd);",
    "      kv.appendChild(vd);",
    "    }",
    "    if (keys.length > 0) viz.appendChild(kv);",
    "  }",
    "}",
  ].join("\n");
}

const algos001to030and041to060 = [
  { id: "001", filename: "algo-001-두-수의-합-two-sum-simulator.html", title: "두 수의 합 — Two Sum", problem: "nums=[2,7,11,15], target=9", idea: "해시맵으로 O(n) 탐색", complexity: "시간: O(n) / 공간: O(n)", architect: "HashMap으로 complement 즉시 조회. 배열 두 번 순회 -> 한 번으로 줄임.", states: [
    { msg: "초기 배열", arr: [2,7,11,15], active: [], result: [] },
    { msg: "i=0, num=2, target-2=7, 7 not in map. map={2:0}", arr: [2,7,11,15], active: [0], result: [] },
    { msg: "i=1, num=7, target-7=2, 2 in map! Found [0,1]", arr: [2,7,11,15], active: [0,1], result: [0,1] },
    { msg: "Result: [0, 1]", arr: [2,7,11,15], active: [0,1], result: [0,1] }
  ] },
  { id: "002", filename: "algo-002-배열-회전-rotate-array-simulator.html", title: "배열 회전 — Rotate Array", problem: "nums=[1,2,3,4,5,6,7], k=3", idea: "3번 뒤집기 (Reverse Trick)", complexity: "시간: O(n) / 공간: O(1)", architect: "전체->끝k개->앞(n-k)개 순서로 3번 reverse. In-place O(1).", states: [
    { msg: "초기 배열", arr: [1,2,3,4,5,6,7] },
    { msg: "Step 1: 전체 뒤집기", arr: [7,6,5,4,3,2,1] },
    { msg: "Step 2: 앞 k=3 뒤집기", arr: [5,6,7,4,3,2,1] },
    { msg: "Step 3: 뒤 n-k=4 뒤집기", arr: [5,6,7,1,2,3,4] },
    { msg: "완료: [5,6,7,1,2,3,4]", arr: [5,6,7,1,2,3,4] }
  ] },
  { id: "003", filename: "algo-003-중복-제거-remove-duplicates-simulator.html", title: "중복 제거 — Remove Duplicates", problem: "nums=[1,1,2,3,3,4,5,5]", idea: "투 포인터 (slow/fast)", complexity: "시간: O(n) / 공간: O(1)", architect: "slow는 결과 위치, fast는 탐색. 다른 값 발견 시 slow 전진 후 복사.", states: [
    {msg:"초기 배열", arr:[1,1,2,3,3,4,5,5], slow:0, fast:0},
    {msg:"fast=1: arr[1]=1==arr[0]=1, skip", arr:[1,1,2,3,3,4,5,5], slow:0, fast:1},
    {msg:"fast=2: arr[2]=2!=arr[0]=1, slow=1, copy", arr:[1,2,2,3,3,4,5,5], slow:1, fast:2},
    {msg:"fast=3: arr[3]=3!=arr[1]=2, slow=2, copy", arr:[1,2,3,3,3,4,5,5], slow:2, fast:3},
    {msg:"fast=4: arr[4]=3==arr[2]=3, skip", arr:[1,2,3,3,3,4,5,5], slow:2, fast:4},
    {msg:"fast=5: arr[5]=4!=arr[2]=3, slow=3, copy", arr:[1,2,3,4,3,4,5,5], slow:3, fast:5},
    {msg:"fast=6: arr[6]=5!=arr[3]=4, slow=4, copy", arr:[1,2,3,4,5,4,5,5], slow:4, fast:6},
    {msg:"fast=7: arr[7]=5==arr[4]=5, skip", arr:[1,2,3,4,5,4,5,5], slow:4, fast:7},
    {msg:"완료: [1,2,3,4,5], length=5", arr:[1,2,3,4,5,4,5,5], slow:4, fast:7}
  ] },
  { id: "004", filename: "algo-004-최대-부분-배열-합-kadane-s-simulator.html", title: "최대 부분 배열 합 — Kadane's Algorithm", problem: "nums=[-2,1,-3,4,-1,2,1,-5,4]", idea: "현재합과 전역최대 추적", complexity: "시간: O(n) / 공간: O(1)", architect: "curSum = max(num, curSum+num). 음수로 떨어지면 새 시작.", states: [
    {msg:"초기", arr:[-2,1,-3,4,-1,2,1,-5,4], cur:0, best:"-INF", i:-1},
    {msg:"i=0: cur=-2, best=-2", arr:[-2,1,-3,4,-1,2,1,-5,4], cur:-2, best:-2, i:0, active:[0]},
    {msg:"i=1: cur=1, best=1", arr:[-2,1,-3,4,-1,2,1,-5,4], cur:1, best:1, i:1, active:[1]},
    {msg:"i=3: cur=4, best=4", arr:[-2,1,-3,4,-1,2,1,-5,4], cur:4, best:4, i:3, active:[3]},
    {msg:"i=6: cur=6, best=6", arr:[-2,1,-3,4,-1,2,1,-5,4], cur:6, best:6, i:6, active:[3,4,5,6]},
    {msg:"결과: 6 (subarray [4,-1,2,1])", arr:[-2,1,-3,4,-1,2,1,-5,4], cur:5, best:6, i:8, result:[3,4,5,6]}
  ] },
  { id: "005", filename: "algo-005-문자열-뒤집기-reverse-string-simulator.html", title: "문자열 뒤집기 — Reverse String", problem: "s=['h','e','l','l','o']", idea: "투 포인터 교환", complexity: "시간: O(n) / 공간: O(1)", architect: "양 끝 포인터를 좁혀가며 교환. In-place.", states: [
    {msg:"초기", arr:["h","e","l","l","o"], left:0, right:4},
    {msg:"swap(0,4)", arr:["o","e","l","l","h"], left:1, right:3, active:[0,4]},
    {msg:"swap(1,3)", arr:["o","l","l","e","h"], left:2, right:2, active:[1,3]},
    {msg:"완료", arr:["o","l","l","e","h"], left:2, right:2}
  ] },
  { id: "006", filename: "algo-006-애너그램-판별-valid-anagram-simulator.html", title: "애너그램 판별 — Valid Anagram", problem: "s='anagram', t='nagaram'", idea: "문자 빈도 카운트 비교", complexity: "시간: O(n) / 공간: O(1)", architect: "해시맵/배열로 빈도수 비교. 26글자 고정 -> O(1) 공간.", states: [
    {msg:"초기", map:{}, step:"count s"},
    {msg:"s 카운트 완료", map:{a:3,n:1,g:1,r:1,m:1}, step:"count s"},
    {msg:"t로 차감 시작", map:{a:2,n:0,g:1,r:1,m:1}, step:"consume t"},
    {msg:"t 차감 완료", map:{a:0,n:0,g:0,r:0,m:0}, result:true},
    {msg:"모든 카운트 0 -> anagram", map:{a:0,n:0,g:0,r:0,m:0}, result:true}
  ] },
  { id: "007", filename: "algo-007-최장-공통-접두사-lcp-simulator.html", title: "최장 공통 접두사 — Longest Common Prefix", problem: "strs=['flower','flow','flight']", idea: "세로 스캔 (Vertical Scan)", complexity: "시간: O(S) / 공간: O(1)", architect: "첫 단어 각 문자를 나머지 단어와 비교. 불일치 즉시 반환.", states: [
    {msg:"초기", words:["flower","flow","flight"], idx:0, prefix:""},
    {msg:"col=0, 'f' 공통", words:["flower","flow","flight"], idx:0, prefix:"f"},
    {msg:"col=1, 'l' 공통", words:["flower","flow","flight"], idx:1, prefix:"fl"},
    {msg:"col=2, 'o' vs 'i' 불일치", words:["flower","flow","flight"], idx:2, prefix:"fl"},
    {msg:"결과: 'fl'", words:["flower","flow","flight"], prefix:"fl"}
  ] },
  { id: "008", filename: "algo-008-배열-합치기-merge-sorted-simulator.html", title: "정렬 배열 합치기 — Merge Sorted Arrays", problem: "nums1=[1,2,3,0,0,0], m=3, nums2=[2,5,6], n=3", idea: "역방향 투 포인터", complexity: "시간: O(m+n) / 공간: O(1)", architect: "뒤에서부터 채우면 덮어쓰기 없음. In-place merge.", states: [
    {msg:"초기", arr:[1,2,3,0,0,0], i:2, j:2, k:5},
    {msg:"6 배치", arr:[1,2,3,0,0,6], i:2, j:1, k:4, active:[5]},
    {msg:"5 배치", arr:[1,2,3,0,5,6], i:2, j:0, k:3, active:[4]},
    {msg:"3 배치", arr:[1,2,3,3,5,6], i:1, j:0, k:2, active:[3]},
    {msg:"2 배치", arr:[1,2,2,3,5,6], i:1, j:-1, k:1, active:[2]},
    {msg:"완료", arr:[1,2,2,3,5,6], i:1, j:-1, k:1}
  ] },
  { id: "009", filename: "algo-009-문자열-압축-compression-simulator.html", title: "문자열 압축 — String Compression", problem: "chars=['a','a','b','b','c','c','c']", idea: "투 포인터 런 길이 인코딩", complexity: "시간: O(n) / 공간: O(1)", architect: "같은 문자 연속 구간 집계 후 압축. In-place.", states: [
    {msg:"초기", arr:["a","a","b","b","c","c","c"], write:0},
    {msg:"run 'a' x2 -> a2", arr:["a","2","b","b","c","c","c"], write:2},
    {msg:"run 'b' x2 -> b2", arr:["a","2","b","2","c","c","c"], write:4},
    {msg:"run 'c' x3 -> c3", arr:["a","2","b","2","c","3","c"], write:6},
    {msg:"완료 길이=6", arr:["a","2","b","2","c","3","c"], write:6}
  ] },
  { id: "010", filename: "algo-010-파스칼의-삼각형-pascal-s-simulator.html", title: "파스칼의 삼각형 — Pascal's Triangle", problem: "numRows=5", idea: "DP (각 행은 이전 행으로부터)", complexity: "시간: O(n^2) / 공간: O(n^2)", architect: "triangle[i][j] = triangle[i-1][j-1] + triangle[i-1][j].", states: [
    {msg:"row 1", triangle:[[1]]},
    {msg:"row 2", triangle:[[1],[1,1]]},
    {msg:"row 3", triangle:[[1],[1,1],[1,2,1]]},
    {msg:"row 4", triangle:[[1],[1,1],[1,2,1],[1,3,3,1]]},
    {msg:"row 5", triangle:[[1],[1,1],[1,2,1],[1,3,3,1],[1,4,6,4,1]]}
  ] },
  { id: "011", filename: "algo-011-연결-리스트-역순-reverse-ll-simulator.html", title: "연결 리스트 역순 — Reverse Linked List", problem: "1->2->3->4->5->null", idea: "이전/현재/다음 포인터 3개로 역전", complexity: "시간: O(n) / 공간: O(1)", architect: "prev=null, curr=head. 반복: next=curr.next, curr.next=prev, prev=curr, curr=next.", states: [
    {msg:"초기", list:"1->2->3->4->5->null", prev:null, curr:1},
    {msg:"1 reverse", list:"1->null | 2->3->4->5", prev:1, curr:2},
    {msg:"2 reverse", list:"2->1->null | 3->4->5", prev:2, curr:3},
    {msg:"4 reverse", list:"4->3->2->1->null | 5", prev:4, curr:5},
    {msg:"완료", list:"5->4->3->2->1->null", prev:5, curr:null}
  ] },
  { id: "012", filename: "algo-012-사이클-탐지-cycle-detection-simulator.html", title: "사이클 탐지 — Cycle Detection (Floyd's)", problem: "[3,1,4,1,5,9,2,6,5,3,5], slow/fast 포인터", idea: "Floyd's Tortoise & Hare", complexity: "시간: O(n) / 공간: O(1)", architect: "slow 1칸, fast 2칸. 만나면 사이클 존재. phase2로 시작점 탐지.", states: [
    {msg:"초기: slow=head, fast=head", arr:[3,1,4,1,5,9,2,6,5,3,5], slow:0, fast:0},
    {msg:"slow=1, fast=2", arr:[3,1,4,1,5,9,2,6,5,3,5], slow:1, fast:2},
    {msg:"slow=2, fast=4", arr:[3,1,4,1,5,9,2,6,5,3,5], slow:2, fast:4},
    {msg:"slow=3, fast=6", arr:[3,1,4,1,5,9,2,6,5,3,5], slow:3, fast:6},
    {msg:"slow=4, fast=2 (사이클 내)", arr:[3,1,4,1,5,9,2,6,5,3,5], slow:4, fast:2},
    {msg:"slow=5, fast=4", arr:[3,1,4,1,5,9,2,6,5,3,5], slow:5, fast:4},
    {msg:"slow=6, fast=6 — 만남!", arr:[3,1,4,1,5,9,2,6,5,3,5], slow:6, fast:6}
  ] },
  { id: "013", filename: "algo-013-두-리스트-병합-merge-lists-simulator.html", title: "두 리스트 병합 — Merge Two Sorted Lists", problem: "l1=1->2->4, l2=1->3->4", idea: "더미 노드 + 비교 포인터", complexity: "시간: O(m+n) / 공간: O(1)", architect: "dummy head로 엣지 케이스 제거. 작은 쪽 연결 후 포인터 전진.", states: [
    {msg:"초기", l1:[1,2,4], l2:[1,3,4], merged:[]},
    {msg:"1(l1) 선택", l1:[2,4], l2:[1,3,4], merged:[1]},
    {msg:"1(l2) 선택", l1:[2,4], l2:[3,4], merged:[1,1]},
    {msg:"2 선택", l1:[4], l2:[3,4], merged:[1,1,2]},
    {msg:"3 선택", l1:[4], l2:[4], merged:[1,1,2,3]},
    {msg:"완료", l1:[], l2:[], merged:[1,1,2,3,4,4]}
  ] },
  { id: "014", filename: "algo-014-중간-노드-middle-node-simulator.html", title: "중간 노드 — Middle of Linked List", problem: "[1,2,3,4,5]", idea: "slow/fast 포인터 (Fast 2배속)", complexity: "시간: O(n) / 공간: O(1)", architect: "fast가 끝에 도달할 때 slow가 중간. 홀수/짝수 모두 처리.", states: [
    {msg:"초기", arr:[1,2,3,4,5], slow:0, fast:0},
    {msg:"이동", arr:[1,2,3,4,5], slow:1, fast:2},
    {msg:"이동", arr:[1,2,3,4,5], slow:2, fast:4},
    {msg:"fast 끝 -> 중간은 index 2", arr:[1,2,3,4,5], slow:2, fast:4}
  ] },
  { id: "015", filename: "algo-015-유효한-괄호-valid-parentheses-simulator.html", title: "유효한 괄호 — Valid Parentheses", problem: "s='({[]})'", idea: "스택 매칭", complexity: "시간: O(n) / 공간: O(n)", architect: "여는 괄호 push, 닫는 괄호는 top과 매칭. 스택 비면 valid.", states: [
    {msg:"초기", stack:[], ch:"("},
    {msg:"'(' push", stack:["("], ch:"("},
    {msg:"'{' push", stack:["(","{"], ch:"{"},
    {msg:"'[' push", stack:["(","{","["], ch:"["},
    {msg:"] 매칭 pop", stack:["(","{"], ch:"]"},
    {msg:"} 매칭 pop", stack:["("], ch:"}"},
    {msg:") 매칭 pop", stack:[], ch:")"},
    {msg:"스택 비었음 -> valid", stack:[], valid:true}
  ] },
  { id: "016", filename: "algo-016-최소-스택-min-stack-simulator.html", title: "최소 스택 — Min Stack", problem: "push(5), push(3), push(7), push(1), getMin(), pop(), getMin()", idea: "보조 스택으로 최솟값 추적", complexity: "시간: O(1) / 공간: O(n)", architect: "메인 스택 + min 스택 쌍. push시 min 스택에 현재 min 동기화.", states: [
    {msg:"초기", stack:[], minStack:[]},
    {msg:"push 5", stack:[5], minStack:[5]},
    {msg:"push 3", stack:[5,3], minStack:[5,3]},
    {msg:"push 7", stack:[5,3,7], minStack:[5,3,3]},
    {msg:"push 1", stack:[5,3,7,1], minStack:[5,3,3,1]},
    {msg:"getMin -> 1", stack:[5,3,7,1], minStack:[5,3,3,1], min:1},
    {msg:"pop", stack:[5,3,7], minStack:[5,3,3]},
    {msg:"getMin -> 3", stack:[5,3,7], minStack:[5,3,3], min:3}
  ] },
  { id: "017", filename: "algo-017-큐-스택-stack-using-queues-simulator.html", title: "스택을 큐로 구현 — Stack Using Queues", problem: "push(1), push(2), push(3), pop()", idea: "push시 rotate (O(n) push, O(1) pop)", complexity: "시간: push O(n), pop O(1) / 공간: O(n)", architect: "push 후 queue 앞에 새 요소가 오도록 순환 재배치.", states: [
    {msg:"초기", queue:[]},
    {msg:"push(1)", queue:[1]},
    {msg:"push(2) 후 rotate", queue:[2,1]},
    {msg:"push(3) 후 rotate", queue:[3,2,1]},
    {msg:"pop() -> 3", queue:[2,1], popped:3}
  ] },
  { id: "018", filename: "algo-018-일일-온도-daily-temperatures-simulator.html", title: "일일 온도 — Daily Temperatures", problem: "temps=[73,74,75,71,69,72,76,73]", idea: "단조 감소 스택", complexity: "시간: O(n) / 공간: O(n)", architect: "스택에 인덱스 저장. 더 큰 값 발견 시 기다린 일수 계산.", states: [
    {msg:"초기", stack:[], result:[0,0,0,0,0,0,0,0], i:-1},
    {msg:"i=0: push 0(73)", stack:[0], result:[0,0,0,0,0,0,0,0], i:0},
    {msg:"i=1: 74>73, pop 0, ans[0]=1, push 1", stack:[1], result:[1,0,0,0,0,0,0,0], i:1},
    {msg:"i=2: 75>74, pop 1, ans[1]=1, push 2", stack:[2], result:[1,1,0,0,0,0,0,0], i:2},
    {msg:"i=5 처리", stack:[2,5], result:[1,1,0,2,1,0,0,0], i:5},
    {msg:"i=6 처리", stack:[6], result:[1,1,4,2,1,1,0,0], i:6},
    {msg:"완료", stack:[], result:[1,1,4,2,1,1,0,0], i:7}
  ] },
  { id: "019", filename: "algo-019-슬라이딩-윈도우-최대값-simulator.html", title: "슬라이딩 윈도우 최대값 — Sliding Window Maximum", problem: "nums=[1,3,-1,-3,5,3,6,7], k=3", idea: "단조 큐 (Deque)", complexity: "시간: O(n) / 공간: O(k)", architect: "덱 앞: 현재 윈도우 최대. 새 요소보다 작은 덱 뒤 요소 제거.", states: [
    {msg:"초기", deque:[], window:[0,2], output:[]},
    {msg:"i=0,1,2 처리 -> max=3", deque:[1,2], window:[0,2], output:[3]},
    {msg:"i=3 처리 -> max=3", deque:[1,2,3], window:[1,3], output:[3,3]},
    {msg:"i=4 처리 -> max=5", deque:[4], window:[2,4], output:[3,3,5]},
    {msg:"i=5 처리 -> max=5", deque:[4,5], window:[3,5], output:[3,3,5,5]},
    {msg:"i=6 처리 -> max=6", deque:[6], window:[4,6], output:[3,3,5,5,6]},
    {msg:"i=7 처리 -> max=7", deque:[7], window:[5,7], output:[3,3,5,5,6,7]}
  ] },
  { id: "020", filename: "algo-020-lru-캐시-lru-cache-simulator.html", title: "LRU 캐시 — LRU Cache", problem: "capacity=3, put(1,1), put(2,2), put(3,3), get(2), put(4,4), get(1)", idea: "HashMap + 이중 연결 리스트", complexity: "시간: O(1) / 공간: O(capacity)", architect: "HashMap으로 O(1) 접근, DLL로 O(1) 순서 이동. Head=MRU, Tail=LRU.", states: [
    {msg:"초기", cache:[], cap:3},
    {msg:"put(1,1)", cache:[1]},
    {msg:"put(2,2)", cache:[2,1]},
    {msg:"put(3,3)", cache:[3,2,1]},
    {msg:"get(2) -> move front", cache:[2,3,1], value:2},
    {msg:"put(4,4) -> evict 1", cache:[4,2,3], evicted:1},
    {msg:"get(1) -> -1", cache:[4,2,3], value:-1}
  ] },
  { id: "021", filename: "algo-021-세-수의-합-3sum-simulator.html", title: "세 수의 합 — 3Sum", problem: "nums=[-4,-1,-1,0,1,2]", idea: "정렬 + 투 포인터", complexity: "시간: O(n^2) / 공간: O(1)", architect: "정렬 후 각 i에 대해 [i+1, n-1] 범위 투 포인터. 중복 건너뜀.", states: [
    {msg:"초기(정렬됨)", arr:[-4,-1,-1,0,1,2], i:0, left:1, right:5, triplets:[]},
    {msg:"i=1, left=2, right=5 -> sum=0", arr:[-4,-1,-1,0,1,2], i:1, left:2, right:5, triplets:[[-1,-1,2]]},
    {msg:"left++, right-- -> sum=0", arr:[-4,-1,-1,0,1,2], i:1, left:3, right:4, triplets:[[-1,-1,2],[-1,0,1]]},
    {msg:"완료", arr:[-4,-1,-1,0,1,2], triplets:[[-1,-1,2],[-1,0,1]]}
  ] },
  { id: "022", filename: "algo-022-물-담기-container-simulator.html", title: "물 담기 — Container With Most Water", problem: "height=[1,8,6,2,5,4,8,3,7]", idea: "투 포인터 (짧은 쪽 이동)", complexity: "시간: O(n) / 공간: O(1)", architect: "물 높이 = min(h[l], h[r]) * (r-l). 짧은 쪽 이동이 최적.", states: [
    {msg:"초기", arr:[1,8,6,2,5,4,8,3,7], left:0, right:8, best:8},
    {msg:"left 이동", arr:[1,8,6,2,5,4,8,3,7], left:1, right:8, best:49},
    {msg:"right 이동", arr:[1,8,6,2,5,4,8,3,7], left:1, right:7, best:49},
    {msg:"탐색 종료", arr:[1,8,6,2,5,4,8,3,7], left:4, right:5, best:49}
  ] },
  { id: "023", filename: "algo-023-최장-부분-문자열-simulator.html", title: "최장 부분 문자열 — Longest Substring Without Repeating", problem: "s='abcabcbb'", idea: "슬라이딩 윈도우 + HashSet", complexity: "시간: O(n) / 공간: O(min(m,n))", architect: "윈도우 내 중복 발견시 left 전진. 항상 현재 최대 갱신.", states: [
    {msg:"초기", s:"abcabcbb", left:0, right:0, set:[], best:0},
    {msg:"abc 확장", s:"abcabcbb", left:0, right:2, set:["a","b","c"], best:3},
    {msg:"중복 a 발견 -> left 이동", s:"abcabcbb", left:1, right:3, set:["b","c","a"], best:3},
    {msg:"중복 b 처리", s:"abcabcbb", left:5, right:6, set:["c","b"], best:3},
    {msg:"완료 best=3", s:"abcabcbb", left:7, right:7, set:["b"], best:3}
  ] },
  { id: "024", filename: "algo-024-부분-배열의-합-subarray-sum-simulator.html", title: "부분 배열의 합 — Subarray Sum Equals K", problem: "nums=[1,2,3,2,1], k=3", idea: "누적합 + HashMap", complexity: "시간: O(n) / 공간: O(n)", architect: "prefix[i]-prefix[j]=k -> prefix[j]=prefix[i]-k. 이전 prefix 횟수 조회.", states: [
    {msg:"초기", prefix:0, map:{"0":1}, count:0},
    {msg:"i=0: prefix=1", prefix:1, map:{"0":1,"1":1}, count:0},
    {msg:"i=1: prefix=3, count=1", prefix:3, map:{"0":1,"1":1,"3":1}, count:1},
    {msg:"i=2: prefix=6, count=2", prefix:6, map:{"0":1,"1":1,"3":1,"6":1}, count:2},
    {msg:"i=4: prefix=9, count=3", prefix:9, map:{"0":1,"1":1,"3":1,"6":1,"8":1,"9":1}, count:3}
  ] },
  { id: "025", filename: "algo-025-그룹-애너그램-simulator.html", title: "그룹 애너그램 — Group Anagrams", problem: "strs=['eat','tea','tan','ate','nat','bat']", idea: "정렬된 키로 그루핑", complexity: "시간: O(n*k*log k) / 공간: O(n*k)", architect: "각 단어를 정렬해 key 생성. HashMap[sorted] -> 같은 그룹.", states: [
    {msg:"초기", groups:{}},
    {msg:"eat -> aet", groups:{aet:["eat"]}},
    {msg:"tea, ate 추가", groups:{aet:["eat","tea","ate"]}},
    {msg:"tan, nat 추가", groups:{aet:["eat","tea","ate"], ant:["tan","nat"]}},
    {msg:"bat 추가", groups:{aet:["eat","tea","ate"], ant:["tan","nat"], abt:["bat"]}}
  ] },
  { id: "026", filename: "algo-026-최장-연속-수열-simulator.html", title: "최장 연속 수열 — Longest Consecutive Sequence", problem: "nums=[100,4,200,1,3,2]", idea: "HashSet + 시작점 탐지", complexity: "시간: O(n) / 공간: O(n)", architect: "n-1이 없는 n이 시작점. 시작점에서만 연속 카운트 -> O(n).", states: [
    {msg:"초기 set", set:[100,4,200,1,3,2], best:0},
    {msg:"start=100, len=1", set:[100,4,200,1,3,2], best:1},
    {msg:"start=200, len=1", set:[100,4,200,1,3,2], best:1},
    {msg:"start=1, sequence 1-2-3-4", set:[100,4,200,1,3,2], best:4},
    {msg:"완료 best=4", set:[100,4,200,1,3,2], best:4}
  ] },
  { id: "027", filename: "algo-027-과반수-원소-boyer-moore-simulator.html", title: "과반수 원소 — Boyer-Moore Voting", problem: "nums=[2,2,1,1,1,2,2]", idea: "투표 알고리즘", complexity: "시간: O(n) / 공간: O(1)", architect: "candidate와 count 유지. 다른 값이면 count--. 0이면 후보 교체.", states: [
    {msg:"초기", candidate:null, count:0},
    {msg:"i=0: num=2, candidate=2,count=1", candidate:2, count:1},
    {msg:"i=1: num=2==candidate, count=2", candidate:2, count:2},
    {msg:"i=3: num=1!=candidate, count=0", candidate:2, count:0},
    {msg:"i=4: candidate=1,count=1", candidate:1, count:1},
    {msg:"i=6: candidate=2,count=1", candidate:2, count:1},
    {msg:"결과: candidate=2", candidate:2, count:1}
  ] },
  { id: "028", filename: "algo-028-두-배열-교집합-simulator.html", title: "두 배열 교집합 — Intersection of Two Arrays", problem: "nums1=[4,9,5], nums2=[9,4,9,8,4]", idea: "HashSet 교집합", complexity: "시간: O(m+n) / 공간: O(m)", architect: "nums1을 Set으로 변환. nums2 순회하며 Set에 있는 원소만 결과에 추가.", states: [
    {msg:"set(nums1) 생성", set:[4,9,5], result:[]},
    {msg:"nums2=9 -> 추가", set:[4,9,5], result:[9]},
    {msg:"nums2=4 -> 추가", set:[4,9,5], result:[9,4]},
    {msg:"중복/없는 값 skip", set:[4,9,5], result:[9,4]},
    {msg:"완료", set:[4,9,5], result:[9,4]}
  ] },
  { id: "029", filename: "algo-029-최소-윈도우-부분-문자열-simulator.html", title: "최소 윈도우 부분 문자열 — Minimum Window Substring", problem: "s='ADOBECODEBANC', t='ABC'", idea: "슬라이딩 윈도우 + 문자 카운트", complexity: "시간: O(s+t) / 공간: O(s+t)", architect: "필요 문자 조건 충족 시 left 수축. 최소 윈도우 갱신.", states: [
    {msg:"초기", left:0, right:0, window:"", best:""},
    {msg:"확장: ADOBEC", left:0, right:5, window:"ADOBEC", best:"ADOBEC"},
    {msg:"수축/확장 반복", left:1, right:10, window:"DOBECODEBA", best:"ADOBEC"},
    {msg:"BANC 발견", left:9, right:12, window:"BANC", best:"BANC"},
    {msg:"결과: BANC", left:9, right:12, window:"BANC", best:"BANC"}
  ] },
  { id: "030", filename: "algo-030-제곱수-판별-simulator.html", title: "제곱수 판별 — Valid Perfect Square", problem: "num=16", idea: "이진 탐색", complexity: "시간: O(log n) / 공간: O(1)", architect: "mid*mid vs num 비교. 정수 오버플로우 주의.", states: [
    {msg:"초기: l=1, r=16", l:1, r:16, mid:null},
    {msg:"mid=8, 64>16, r=7", l:1, r:7, mid:8},
    {msg:"mid=4, 16==16! Found", l:1, r:7, mid:4},
    {msg:"결과: true (4는 완전제곱수)", l:1, r:7, mid:4}
  ] },

  { id: "041", filename: "algo-041-부분-집합-subsets-simulator.html", title: "부분 집합 — Subsets", problem: "nums=[1,2,3]", idea: "백트래킹 / 비트마스크", complexity: "시간: O(n*2^n) / 공간: O(n*2^n)", architect: "각 원소 포함/미포함 선택. DFS 백트래킹으로 모든 조합.", states: [
    {msg:"초기", result:[]},
    {msg:"add []", result:[[]]},
    {msg:"add [1]", result:[[],[1]]},
    {msg:"add [1,2]", result:[[],[1],[1,2]]},
    {msg:"add [1,2,3]", result:[[],[1],[1,2],[1,2,3]]},
    {msg:"backtrack, add [1,3]", result:[[],[1],[1,2],[1,2,3],[1,3]]},
    {msg:"add [2],[2,3],[3]", result:[[],[1],[1,2],[1,2,3],[1,3],[2],[2,3],[3]]},
    {msg:"완료: 8개", result:[[],[1],[1,2],[1,2,3],[1,3],[2],[2,3],[3]]}
  ] },
  { id: "042", filename: "algo-042-순열-permutations-simulator.html", title: "순열 — Permutations", problem: "nums=[1,2,3]", idea: "백트래킹 + 사용 표시", complexity: "시간: O(n!) / 공간: O(n)", architect: "각 위치에 미사용 원소 배치. 재귀 후 used[i] 복원.", states: [
    {msg:"초기", path:[], used:[false,false,false], result:[]},
    {msg:"[1]", path:[1], used:[true,false,false], result:[]},
    {msg:"[1,2]", path:[1,2], used:[true,true,false], result:[]},
    {msg:"[1,2,3] 완성", path:[1,2,3], used:[true,true,true], result:[[1,2,3]]},
    {msg:"[1,3,2] 완성", path:[1,3,2], used:[true,true,true], result:[[1,2,3],[1,3,2]]},
    {msg:"완료", path:[], used:[false,false,false], result:[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]}
  ] },
  { id: "043", filename: "algo-043-조합-combinations-simulator.html", title: "조합 — Combinations", problem: "n=4, k=2", idea: "백트래킹 (시작점 전진)", complexity: "시간: O(C(n,k)) / 공간: O(k)", architect: "start부터 선택해 중복 방지. 남은 원소 충분한지 pruning.", states: [
    {msg:"초기", start:1, path:[], result:[]},
    {msg:"[1,2]", start:3, path:[1,2], result:[[1,2]]},
    {msg:"[1,3]", start:4, path:[1,3], result:[[1,2],[1,3]]},
    {msg:"[1,4]", start:5, path:[1,4], result:[[1,2],[1,3],[1,4]]},
    {msg:"[2,3]", start:4, path:[2,3], result:[[1,2],[1,3],[1,4],[2,3]]},
    {msg:"완료", start:5, path:[], result:[[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]]}
  ] },
  { id: "044", filename: "algo-044-전화번호-조합-simulator.html", title: "전화번호 조합 — Letter Combinations", problem: "digits='23'", idea: "백트래킹 (전화번호 맵핑)", complexity: "시간: O(4^n) / 공간: O(n)", architect: "각 숫자의 글자 매핑. 재귀로 모든 조합 생성.", states: [
    {msg:"초기: map={2:'abc',3:'def'}", current:"", result:[]},
    {msg:"digit=2: try 'a'", current:"a", result:[]},
    {msg:"digit=3: 'ad','ae','af'", current:"af", result:["ad","ae","af"]},
    {msg:"digit=2: try 'b'", current:"b", result:["ad","ae","af"]},
    {msg:"...", current:"", result:["ad","ae","af","bd","be","bf","cd","ce","cf"]},
    {msg:"완료: 9개 조합", current:"", result:["ad","ae","af","bd","be","bf","cd","ce","cf"]}
  ] },
  { id: "045", filename: "algo-045-n-queens-simulator.html", title: "N-Queens", problem: "n=4", idea: "백트래킹 (행 단위 배치)", complexity: "시간: O(n!) / 공간: O(n)", architect: "열/대각선 충돌 체크. 각 행에 퀸 하나. 2개 해 존재.", states: [
    {msg:"초기", board:[[".",".",".","."],[".",".",".","."],[".",".",".","."],[".",".",".","."]], path:[]},
    {msg:"row0 col1 배치", board:[[".","Q",".","."],[".",".",".","."],[".",".",".","."],[".",".",".","."]], path:[[0,1]]},
    {msg:"row1 col3 배치", board:[[".","Q",".","."],[".",".",".","Q"],[".",".",".","."],[".",".",".","."]], path:[[0,1],[1,3]]},
    {msg:"해 1 완성", board:[[".","Q",".","."],[".",".",".","Q"],["Q",".",".","."],[".",".","Q","."]], path:[[0,1],[1,3],[2,0],[3,2]]},
    {msg:"해 2 완성", board:[[".",".","Q","."],["Q",".",".","."],[".",".",".","Q"],[".","Q",".","."]], path:[[0,2],[1,0],[2,3],[3,1]]}
  ] },
  { id: "046", filename: "algo-046-스도쿠-풀기-simulator.html", title: "스도쿠 풀기 — Solve Sudoku", problem: "9x9 보드 일부 채워진 상태", idea: "백트래킹 + 제약 검사", complexity: "시간: O(9^(빈칸수)) / 공간: O(1)", architect: "각 빈 칸에 1-9 시도. 행/열/박스 충돌 시 백트랙.", states: [
    {msg:"초기", board:"부분 채워진 9x9", action:"find empty"},
    {msg:"(0,2)에 1 시도 -> 실패", board:"...", action:"backtrack"},
    {msg:"(0,2)에 4 시도 -> 통과", board:"...", action:"go deeper"},
    {msg:"여러 칸 채우기", board:"...", action:"recursive fill"},
    {msg:"완료", board:"완성된 스도쿠", action:"solved"}
  ] },
  { id: "047", filename: "algo-047-단어-탐색-word-search-simulator.html", title: "단어 탐색 — Word Search", problem: "board=[[A,B,C,E],[S,F,C,S],[A,D,E,E]], word='ABCCED'", idea: "DFS 백트래킹", complexity: "시간: O(M*N*4^L) / 공간: O(L)", architect: "각 셀에서 DFS. 방문 표시 후 4방향 탐색. 백트랙 시 방문 해제.", states: [
    {msg:"초기", grid:[["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], path:[]},
    {msg:"A(0,0) 시작", grid:[["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], path:[[0,0]]},
    {msg:"B(0,1) -> C(0,2)", grid:[["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], path:[[0,0],[0,1],[0,2]]},
    {msg:"C(1,2) -> E(2,2)", grid:[["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], path:[[0,0],[0,1],[0,2],[1,2],[2,2]]},
    {msg:"D(2,1) 도달, word 완성", grid:[["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], path:[[0,0],[0,1],[0,2],[1,2],[2,2],[2,1]]}
  ] },
  { id: "048", filename: "algo-048-거듭제곱-pow-simulator.html", title: "거듭제곱 — Power(x, n)", problem: "x=2.0, n=10", idea: "빠른 거듭제곱 (분할 정복)", complexity: "시간: O(log n) / 공간: O(log n)", architect: "n이 짝수: x^n = (x^(n/2))^2. 홀수: x^n = x * x^(n-1).", states: [
    {msg:"pow(2, 10)", x:2, n:10, result:null},
    {msg:"n 짝수: pow(2,10) = pow(2,5)^2", x:2, n:5, result:null},
    {msg:"n 홀수: pow(2,5) = 2 * pow(2,4)", x:2, n:4, result:null},
    {msg:"n 짝수: pow(2,4) = pow(2,2)^2", x:2, n:2, result:null},
    {msg:"n 짝수: pow(2,2) = pow(2,1)^2", x:2, n:1, result:null},
    {msg:"n=1: return 2", x:2, n:1, result:2},
    {msg:"pow(2,2)=4", x:2, n:2, result:4},
    {msg:"pow(2,4)=16", x:2, n:4, result:16},
    {msg:"pow(2,5)=32", x:2, n:5, result:32},
    {msg:"pow(2,10)=1024", x:2, n:10, result:1024}
  ] },
  { id: "049", filename: "algo-049-괄호-생성-simulator.html", title: "괄호 생성 — Generate Parentheses", problem: "n=3", idea: "백트래킹 (open/close 카운트)", complexity: "시간: O(Catalan(n)) / 공간: O(n)", architect: "open<n이면 '(' 추가 가능. close<open이면 ')' 추가 가능.", states: [
    {msg:"초기", cur:"", open:0, close:0, result:[]},
    {msg:"(", cur:"(", open:1, close:0, result:[]},
    {msg:"(()", cur:"(()", open:2, close:1, result:[]},
    {msg:"((())) 완성", cur:"((()))", open:3, close:3, result:["((()))"]},
    {msg:"(()()) 추가", cur:"(()())", open:3, close:3, result:["((()))","(()())"]},
    {msg:"완료", cur:"", open:0, close:0, result:["((()))","(()())","(())()","()(())","()()()"]}
  ] },
  { id: "050", filename: "algo-050-섬의-개수-islands-simulator.html", title: "섬의 개수 — Number of Islands", problem: "grid 4x5에 '1'(육지)과 '0'(물) 혼합", idea: "BFS/DFS 연결 요소 탐색", complexity: "시간: O(M*N) / 공간: O(min(M,N))", architect: "'1' 발견 시 BFS로 연결 육지 모두 '0'으로 표시 후 카운트 증가.", states: [
    {msg:"초기", grid:[["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]], islands:0},
    {msg:"첫 섬 방문 완료", grid:[["0","0","0","0","0"],["0","0","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]], islands:1},
    {msg:"둘째 섬 방문", grid:[["0","0","0","0","0"],["0","0","0","0","0"],["0","0","0","0","0"],["0","0","0","1","1"]], islands:2},
    {msg:"셋째 섬 방문", grid:[["0","0","0","0","0"],["0","0","0","0","0"],["0","0","0","0","0"],["0","0","0","0","0"]], islands:3}
  ] },
  { id: "051", filename: "algo-051-트리-순회-traversal-simulator.html", title: "트리 순회 — Tree Traversal", problem: "tree: 1->(2,3), 2->(4,5)", idea: "Inorder/Preorder/Postorder", complexity: "시간: O(n) / 공간: O(h)", architect: "순서 차이: Pre(N->L->R), In(L->N->R), Post(L->R->N).", states: [
    {msg:"초기 트리", traversal:"", order:[]},
    {msg:"Preorder: visit 1", traversal:"Preorder", order:[1]},
    {msg:"Preorder: visit 2,4,5,3", traversal:"Preorder", order:[1,2,4,5,3]},
    {msg:"Inorder result", traversal:"Inorder", order:[4,2,5,1,3]},
    {msg:"Postorder result", traversal:"Postorder", order:[4,5,2,3,1]}
  ] },
  { id: "052", filename: "algo-052-최대-깊이-max-depth-simulator.html", title: "최대 깊이 — Maximum Depth of Binary Tree", problem: "tree: 3->(9,20), 20->(15,7)", idea: "재귀 DFS / BFS 레벨 카운트", complexity: "시간: O(n) / 공간: O(h)", architect: "depth = 1 + max(left_depth, right_depth). 리프면 1.", states: [
    {msg:"초기", node:3, depth:1},
    {msg:"left subtree depth=1", node:9, depth:1},
    {msg:"right subtree depth=2", node:20, depth:2},
    {msg:"max depth = 3", node:3, depth:3}
  ] },
  { id: "053", filename: "algo-053-대칭-트리-symmetric-simulator.html", title: "대칭 트리 — Symmetric Tree", problem: "tree: 1->(2,2), 2->(3,4), 2->(4,3)", idea: "좌우 미러 재귀 비교", complexity: "시간: O(n) / 공간: O(h)", architect: "isMirror(left,right): 값 같고 (left.left,right.right)+(left.right,right.left) 모두 미러.", states: [
    {msg:"초기", pair:[2,2], valid:true},
    {msg:"(3,3) 비교 통과", pair:[3,3], valid:true},
    {msg:"(4,4) 비교 통과", pair:[4,4], valid:true},
    {msg:"결과: symmetric", pair:[1,1], valid:true}
  ] },
  { id: "054", filename: "algo-054-경로-합-path-sum-simulator.html", title: "경로 합 — Path Sum", problem: "tree: 5->(4,8), 4->(11), 8->(13,4), 11->(7,2), target=22", idea: "DFS + 누적 합 감소", complexity: "시간: O(n) / 공간: O(h)", architect: "target에서 각 노드값 빼며 DFS. 리프에서 0이면 경로 발견.", states: [
    {msg:"초기", path:[5], remain:17},
    {msg:"5->4->11", path:[5,4,11], remain:2},
    {msg:"leaf 7, remain=-5", path:[5,4,11,7], remain:-5},
    {msg:"leaf 2, remain=0", path:[5,4,11,2], remain:0, found:true},
    {msg:"결과: true", path:[5,4,11,2], remain:0, found:true}
  ] },
  { id: "055", filename: "algo-055-bst-유효성-simulator.html", title: "BST 유효성 — Validate BST", problem: "tree: 2->(1,3)", idea: "범위 제약 전달 (min/max)", complexity: "시간: O(n) / 공간: O(h)", architect: "각 노드에 허용 범위 전달. 범위 벗어나면 invalid.", states: [
    {msg:"초기: validate(2,-INF,+INF)", node:2, min:"-INF", max:"+INF", valid:true},
    {msg:"left=1: validate(1,-INF,2)", node:1, min:"-INF", max:2, valid:true},
    {msg:"1 통과", node:1, min:"-INF", max:2, valid:true},
    {msg:"right=3: validate(3,2,+INF)", node:3, min:2, max:"+INF", valid:true},
    {msg:"3 통과", node:3, min:2, max:"+INF", valid:true},
    {msg:"결과: Valid BST", node:2, min:"-INF", max:"+INF", valid:true}
  ] },
  { id: "056", filename: "algo-056-bst-k번째-kth-simulator.html", title: "BST k번째 — Kth Smallest in BST", problem: "BST: 3->(1,4), 1->(null,2), k=1", idea: "Inorder 순회 (정렬 순서)", complexity: "시간: O(H+k) / 공간: O(H)", architect: "BST inorder = 정렬된 순서. k번째 방문 시 반환.", states: [
    {msg:"초기", inorder:[], k:1},
    {msg:"visit 1", inorder:[1], k:1, answer:1},
    {msg:"visit 2", inorder:[1,2], k:1, answer:1},
    {msg:"visit 3,4", inorder:[1,2,3,4], k:1, answer:1},
    {msg:"결과: 1", inorder:[1,2,3,4], k:1, answer:1}
  ] },
  { id: "057", filename: "algo-057-최소-공통-조상-lca-simulator.html", title: "최소 공통 조상 — Lowest Common Ancestor", problem: "BST: 6->(2,8), 2->(0,4), 4->(3,5), p=2, q=8", idea: "BST 속성 활용 탐색", complexity: "시간: O(H) / 공간: O(1)", architect: "p,q 둘 다 left/right에 있으면 그쪽으로. 분기점이 LCA.", states: [
    {msg:"현재 노드=6, p=2, q=8", node:6},
    {msg:"p<6, q>6: 분기점", node:6, lca:6},
    {msg:"결과: LCA=6", node:6, lca:6}
  ] },
  { id: "058", filename: "algo-058-트리-직렬화-simulator.html", title: "트리 직렬화 — Serialize/Deserialize Binary Tree", problem: "tree: 1->(2,3), 3->(4,5)", idea: "BFS 레벨 순서 직렬화", complexity: "시간: O(n) / 공간: O(n)", architect: "null 포함 BFS -> 배열. 배열 -> 인덱스 기반 재구성.", states: [
    {msg:"초기 트리", tree:"1,2,3,null,null,4,5"},
    {msg:"serialize 시작", queue:[1], out:[]},
    {msg:"serialize 결과", queue:[], out:[1,2,3,null,null,4,5]},
    {msg:"deserialize 시작", data:[1,2,3,null,null,4,5]},
    {msg:"복원 완료", tree:"1,2,3,null,null,4,5"}
  ] },
  { id: "059", filename: "algo-059-우측-뷰-right-view-simulator.html", title: "트리 우측 뷰 — Binary Tree Right Side View", problem: "tree: 1->(2,3), 2->(null,5), 3->(null,4)", idea: "BFS 각 레벨 마지막 노드", complexity: "시간: O(n) / 공간: O(w)", architect: "레벨 BFS에서 각 레벨 마지막 노드만 수집.", states: [
    {msg:"level0", queue:[1], rightView:[1]},
    {msg:"level1", queue:[2,3], rightView:[1,3]},
    {msg:"level2", queue:[5,4], rightView:[1,3,4]},
    {msg:"완료", queue:[], rightView:[1,3,4]}
  ] },
  { id: "060", filename: "algo-060-트리-연결리스트-flatten-simulator.html", title: "트리 -> 연결 리스트 — Flatten Binary Tree", problem: "tree: 1->(2,5), 2->(3,4), 5->(null,6)", idea: "Morris Traversal / 역후위순회", complexity: "시간: O(n) / 공간: O(1)", architect: "각 노드의 left subtree를 right에 이식. right=null이 될 때까지 끝까지 이동.", states: [
    {msg:"초기", chain:"1(2,5)"},
    {msg:"1의 left(2)를 right로 이식", chain:"1->2->3->4, 5->6"},
    {msg:"4의 right에 기존 5 연결", chain:"1->2->3->4->5->6"},
    {msg:"left 모두 null", chain:"1->2->3->4->5->6", done:true}
  ] }
];

const reused061to080 = load061to080();

const allAlgos = [];
for (let i = 0; i < algos001to030and041to060.length; i += 1) {
  const a = algos001to030and041to060[i];
  allAlgos.push({
    id: a.id,
    filename: a.filename,
    title: a.title,
    problem: a.problem,
    idea: a.idea,
    complexity: complexityToHtml(a.complexity),
    architect: a.architect,
    js: buildGenericJs(a.states),
  });
}
for (let i = 0; i < reused061to080.length; i += 1) {
  const a = reused061to080[i];
  allAlgos.push(a);
}

function buildHtml(algo) {
  const t = splitTitle(algo.title);
  const body = [
    "<!DOCTYPE html>",
    "<html lang=\"ko\">",
    "<head>",
    "<meta charset=\"UTF-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">",
    "<title>" + algo.title + "</title>",
    "<style>",
    cssTemplate,
    "</style>",
    "</head>",
    "<body style=\"flex-direction:column;\">",
    "<div class=\"header\" style=\"width:100%;max-width:680px;\">",
    "  <h2>" + t.ko + " <span class=\"sub\">— " + t.en + "</span></h2>",
    "  <button class=\"btn-info\" id=\"btn-info\" type=\"button\" title=\"설명 보기\">?</button>",
    "</div>",
    "<div class=\"card\">",
    "  <div class=\"viz\" id=\"viz\"></div>",
    "  <div class=\"log\" id=\"log\">Initializing...</div>",
    "  <div class=\"controls\">",
    "    <button id=\"btn-prev\">⏮ Prev</button>",
    "    <button id=\"btn-play\">▶ Play</button>",
    "    <button id=\"btn-pause\" disabled>⏸ Pause</button>",
    "    <button id=\"btn-next\">Next ⏭</button>",
    "    <button id=\"btn-reset\">Reset</button>",
    "    <label class=\"step-info\">Speed: <input type=\"range\" id=\"speed\" min=\"100\" max=\"2000\" value=\"800\" dir=\"rtl\"></label>",
    "    <span class=\"step-info\" id=\"step-counter\">Step: 0 / 0</span>",
    "  </div>",
    "</div>",
    "<div class=\"modal-overlay\" id=\"modal\">",
    "  <div class=\"modal\">",
    "    <button class=\"modal-close\" id=\"modal-close\">✕</button>",
    "    <h3>" + algo.title + "</h3>",
    "    <section><h4>📌 문제</h4><p>" + algo.problem + "</p></section>",
    "    <section><h4>💡 핵심 아이디어</h4><p>" + algo.idea + "</p></section>",
    "    <section><h4>⏱ 복잡도</h4>" + algo.complexity + "</section>",
    "    <section><h4>🏗 아키텍트의 시선</h4><p>" + algo.architect + "</p></section>",
    "  </div>",
    "</div>",
    "<script>",
    algo.js,
    "let currentStep = 0, playing = false, timer;",
    "const viz = document.getElementById('viz');",
    "const log = document.getElementById('log');",
    "const stepCounter = document.getElementById('step-counter');",
    "function render() {",
    "  if (states.length === 0) return;",
    "  const state = states[currentStep];",
    "  renderState(state);",
    "  log.innerText = state.msg;",
    "  stepCounter.innerText = 'Step: ' + (currentStep + 1) + ' / ' + states.length;",
    "  document.getElementById('btn-prev').disabled = currentStep === 0;",
    "  document.getElementById('btn-next').disabled = currentStep === states.length - 1;",
    "}",
    "function next() { if (currentStep < states.length - 1) { currentStep += 1; render(); } else pause(); }",
    "function prev() { if (currentStep > 0) { currentStep -= 1; render(); } }",
    "function play() {",
    "  if (!playing && currentStep < states.length - 1) {",
    "    playing = true;",
    "    document.getElementById('btn-play').disabled = true;",
    "    document.getElementById('btn-pause').disabled = false;",
    "    timer = setInterval(next, parseInt(document.getElementById('speed').value, 10));",
    "  }",
    "}",
    "function pause() {",
    "  playing = false;",
    "  document.getElementById('btn-play').disabled = false;",
    "  document.getElementById('btn-pause').disabled = true;",
    "  clearInterval(timer);",
    "}",
    "function reset() { pause(); currentStep = 0; render(); }",
    "document.getElementById('btn-next').addEventListener('click', () => { pause(); next(); });",
    "document.getElementById('btn-prev').addEventListener('click', () => { pause(); prev(); });",
    "document.getElementById('btn-play').addEventListener('click', play);",
    "document.getElementById('btn-pause').addEventListener('click', pause);",
    "document.getElementById('btn-reset').addEventListener('click', reset);",
    "document.getElementById('speed').addEventListener('input', () => { if (playing) { pause(); play(); } });",
    "document.getElementById('btn-info').addEventListener('click', () => document.getElementById('modal').classList.add('open'));",
    "document.getElementById('modal-close').addEventListener('click', () => document.getElementById('modal').classList.remove('open'));",
    "document.getElementById('modal').addEventListener('click', (e) => { if (e.target === document.getElementById('modal')) document.getElementById('modal').classList.remove('open'); });",
    "render();",
    "</script>",
    "</body>",
    "</html>",
  ];
  return body.join("\n");
}

let generated = 0;
for (let i = 0; i < allAlgos.length; i += 1) {
  const algo = allAlgos[i];
  const html = buildHtml(algo);
  const outPath = path.join(__dirname, algo.filename);
  fs.writeFileSync(outPath, html, "utf8");
  generated += 1;
}

if (generated !== 70) {
  console.error("Generation failed: expected 70 files, got " + generated);
  process.exit(1);
}

console.log("Success: generated " + generated + " algorithm simulator HTML files (001-030, 041-060, 061-080).");
