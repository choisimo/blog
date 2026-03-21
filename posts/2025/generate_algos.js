import fs from 'fs';
import path from 'path';

const cssTemplate = `*{box-sizing:border-box;margin:0;padding:0}
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
.viz{background:#1a1a1a;border:1px solid var(--border);border-radius:6px;padding:12px;min-height:120px;margin-bottom:10px}
.log{font-size:.8rem;color:#888;min-height:36px;padding:4px 0}`;

const modalJsTemplate = `document.getElementById('btn-info').addEventListener('click',()=>document.getElementById('modal').classList.add('open'));
document.getElementById('modal-close').addEventListener('click',()=>document.getElementById('modal').classList.remove('open'));
document.getElementById('modal').addEventListener('click',e=>{if(e.target===document.getElementById('modal'))document.getElementById('modal').classList.remove('open');});`;

const algos = [
  {
    id: '061',
    filename: 'algo-061-힙-구현-min-heap-simulator.html',
    title: '힙 구현 — Min Heap',
    problem: 'insert sequence [5,3,8,1,2,9,4]',
    idea: '배열 기반 힙 (Sift Up/Down)',
    complexity: '<span class="tag">시간: O(log n)</span><span class="tag">공간: O(n)</span>',
    architect: '완전 이진 트리의 배열 표현. parent=⌊(i-1)/2⌋, children=2i+1, 2i+2.',
    js: `
let states = [
  { msg: "초기 상태", arr: [] },
  { msg: "Insert 5", arr: [5] },
  { msg: "Insert 3", arr: [5, 3] },
  { msg: "Sift Up 3", arr: [3, 5] },
  { msg: "Insert 8", arr: [3, 5, 8] },
  { msg: "Insert 1", arr: [3, 5, 8, 1] },
  { msg: "Sift Up 1", arr: [1, 3, 8, 5] },
  { msg: "Insert 2", arr: [1, 3, 8, 5, 2] },
  { msg: "Sift Up 2", arr: [1, 2, 8, 5, 3] },
  { msg: "Insert 9", arr: [1, 2, 8, 5, 3, 9] },
  { msg: "Insert 4", arr: [1, 2, 8, 5, 3, 9, 4] },
  { msg: "Sift Up 4", arr: [1, 2, 4, 5, 3, 9, 8] }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;gap:8px;justify-content:center;margin-top:20px;">' + 
    state.arr.map(v => '<div style="width:40px;height:40px;background:#333;border:2px solid var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:1.1rem;">'+v+'</div>').join('') + 
    '</div>';
}
`
  },
  {
    id: '062',
    filename: 'algo-062-top-k-빈출-요소-simulator.html',
    title: 'Top K 빈출 요소 — Top K Frequent Elements',
    problem: 'nums=[1,1,1,2,2,3], k=2',
    idea: '힙+해시맵',
    complexity: '<span class="tag">시간: O(n log k)</span><span class="tag">공간: O(n)</span>',
    architect: '부분 정렬과 우선순위 필터링. k-size min-heap으로 전체 정렬 없이 top-k 추출.',
    js: `
let states = [
  { msg: "초기 상태", map: {}, heap: [] },
  { msg: "Count 1", map: {1:3}, heap: [] },
  { msg: "Count 2", map: {1:3, 2:2}, heap: [] },
  { msg: "Count 3", map: {1:3, 2:2, 3:1}, heap: [] },
  { msg: "Push 1 (freq 3)", map: {1:3, 2:2, 3:1}, heap: ["1(3)"] },
  { msg: "Push 2 (freq 2)", map: {1:3, 2:2, 3:1}, heap: ["2(2)", "1(3)"] },
  { msg: "Push 3 (freq 1)", map: {1:3, 2:2, 3:1}, heap: ["3(1)", "2(2)", "1(3)"] },
  { msg: "Pop min (size > k)", map: {1:3, 2:2, 3:1}, heap: ["2(2)", "1(3)"] },
  { msg: "Result: [1, 2]", map: {1:3, 2:2, 3:1}, heap: ["2(2)", "1(3)"] }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;gap:20px;justify-content:center;margin-top:20px;">' + 
    '<div><h4>Map</h4><pre style="color:#fff">' + JSON.stringify(state.map, null, 2) + '</pre></div>' +
    '<div><h4>Heap</h4><div style="display:flex;gap:8px;">' + state.heap.map(v => '<div style="padding:8px;background:#333;border:1px solid var(--border);border-radius:4px;">'+v+'</div>').join('') + '</div></div>' +
    '</div>';
}
`
  },
  {
    id: '063',
    filename: 'algo-063-스트림-중앙값-simulator.html',
    title: '스트림 중앙값 — Find Median from Data Stream',
    problem: 'stream=[5,15,1,3,2,8,7,9,10,6]',
    idea: '이중 힙 (Max-heap + Min-heap)',
    complexity: '<span class="tag">시간: O(log n)</span><span class="tag">공간: O(n)</span>',
    architect: '이중 힙으로 중앙값 경계 유지. 실시간 통계 시스템 패턴.',
    js: `
let states = [
  { msg: "초기 상태", maxH: [], minH: [], median: null },
  { msg: "Insert 5", maxH: [5], minH: [], median: 5 },
  { msg: "Insert 15", maxH: [5], minH: [15], median: 10 },
  { msg: "Insert 1", maxH: [5, 1], minH: [15], median: 5 },
  { msg: "Insert 3", maxH: [3, 1], minH: [5, 15], median: 4 },
  { msg: "Insert 2", maxH: [3, 2, 1], minH: [5, 15], median: 3 }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;gap:20px;justify-content:center;margin-top:20px;text-align:center;">' + 
    '<div><h4>Max Heap (Lower)</h4><div style="color:#fff">' + state.maxH.join(', ') + '</div></div>' +
    '<div><h4>Median</h4><div style="color:var(--accent);font-size:1.5rem;font-weight:bold;">' + state.median + '</div></div>' +
    '<div><h4>Min Heap (Upper)</h4><div style="color:#fff">' + state.minH.join(', ') + '</div></div>' +
    '</div>';
}
`
  },
  {
    id: '064',
    filename: 'algo-064-회의실-배정-simulator.html',
    title: '회의실 배정 — Meeting Rooms II',
    problem: 'intervals=[[0,30],[5,10],[15,20]]',
    idea: '이벤트 정렬 + Min-heap',
    complexity: '<span class="tag">시간: O(n log n)</span><span class="tag">공간: O(n)</span>',
    architect: '자원 할당 최적화. Min-heap으로 가장 일찍 끝나는 회의실 O(log n) 추적.',
    js: `
let states = [
  { msg: "초기 상태", intervals: [[0,30],[5,10],[15,20]], heap: [], rooms: 0 },
  { msg: "Sort by start", intervals: [[0,30],[5,10],[15,20]], heap: [], rooms: 0 },
  { msg: "Process [0,30]", intervals: [[0,30],[5,10],[15,20]], heap: [30], rooms: 1 },
  { msg: "Process [5,10] (5 < 30, need new room)", intervals: [[0,30],[5,10],[15,20]], heap: [10, 30], rooms: 2 },
  { msg: "Process [15,20] (15 >= 10, reuse room)", intervals: [[0,30],[5,10],[15,20]], heap: [20, 30], rooms: 2 }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' + 
    '<div><h4>Heap (End Times)</h4><div style="color:#fff">' + state.heap.join(', ') + '</div></div>' +
    '<div><h4>Rooms Required</h4><div style="color:var(--accent);font-size:1.5rem;font-weight:bold;">' + state.rooms + '</div></div>' +
    '</div>';
}
`
  },
  {
    id: '065',
    filename: 'algo-065-그래프-표현-simulator.html',
    title: '그래프 표현 — Graph Representation',
    problem: 'edges=[[0,1],[0,2],[1,2],[2,3]], n=4',
    idea: '인접 리스트 vs 인접 행렬',
    complexity: '<span class="tag">List O(V+E)</span><span class="tag">Matrix O(V²)</span>',
    architect: '공간-시간 트레이드오프. 희소 그래프→리스트, 밀집 그래프→행렬.',
    js: `
let states = [
  { msg: "초기 상태", list: {0:[],1:[],2:[],3:[]}, matrix: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]] },
  { msg: "Add edge [0,1]", list: {0:[1],1:[0],2:[],3:[]}, matrix: [[0,1,0,0],[1,0,0,0],[0,0,0,0],[0,0,0,0]] },
  { msg: "Add edge [0,2]", list: {0:[1,2],1:[0],2:[0],3:[]}, matrix: [[0,1,1,0],[1,0,0,0],[1,0,0,0],[0,0,0,0]] },
  { msg: "Add edge [1,2]", list: {0:[1,2],1:[0,2],2:[0,1],3:[]}, matrix: [[0,1,1,0],[1,0,1,0],[1,1,0,0],[0,0,0,0]] },
  { msg: "Add edge [2,3]", list: {0:[1,2],1:[0,2],2:[0,1,3],3:[2]}, matrix: [[0,1,1,0],[1,0,1,0],[1,1,0,1],[0,0,1,0]] }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;gap:20px;justify-content:space-around;margin-top:10px;">' + 
    '<div><h4>Adjacency List</h4><pre style="color:#fff">' + JSON.stringify(state.list, null, 2) + '</pre></div>' +
    '<div><h4>Adjacency Matrix</h4><pre style="color:#fff">' + state.matrix.map(r => r.join(' ')).join('\\n') + '</pre></div>' +
    '</div>';
}
`
  },
  {
    id: '066',
    filename: 'algo-066-bfs-simulator.html',
    title: 'BFS — Breadth-First Search',
    problem: 'graph adjacency list: {0:[1,2], 1:[0,3,4], 2:[0,4], 3:[1], 4:[1,2]}, start=0',
    idea: '레벨 탐색 (Queue)',
    complexity: '<span class="tag">시간: O(V+E)</span><span class="tag">공간: O(V)</span>',
    architect: '계층적 탐색과 최단 경로. 큐로 레벨 순서 보장.',
    js: `
let states = [
  { msg: "초기 상태", q: [0], visited: [0], order: [] },
  { msg: "Dequeue 0, Enqueue 1, 2", q: [1, 2], visited: [0, 1, 2], order: [0] },
  { msg: "Dequeue 1, Enqueue 3, 4", q: [2, 3, 4], visited: [0, 1, 2, 3, 4], order: [0, 1] },
  { msg: "Dequeue 2", q: [3, 4], visited: [0, 1, 2, 3, 4], order: [0, 1, 2] },
  { msg: "Dequeue 3", q: [4], visited: [0, 1, 2, 3, 4], order: [0, 1, 2, 3] },
  { msg: "Dequeue 4", q: [], visited: [0, 1, 2, 3, 4], order: [0, 1, 2, 3, 4] }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' + 
    '<div><h4>Queue</h4><div style="color:#fff">' + state.q.join(', ') + '</div></div>' +
    '<div><h4>BFS Order</h4><div style="color:var(--accent);font-weight:bold;">' + state.order.join(' → ') + '</div></div>' +
    '</div>';
}
`
  },
  {
    id: '067',
    filename: 'algo-067-dfs-simulator.html',
    title: 'DFS — Depth-First Search',
    problem: 'graph adjacency list: {0:[1,2], 1:[0,3,4], 2:[0,4], 3:[1], 4:[1,2]}, start=0',
    idea: '깊이 탐색 (Stack/재귀)',
    complexity: '<span class="tag">시간: O(V+E)</span><span class="tag">공간: O(V)</span>',
    architect: '스택 기반 탐색과 속성 발견. BFS vs DFS tradeoff 시각화.',
    js: `
let states = [
  { msg: "초기 상태", stack: [0], visited: [], order: [] },
  { msg: "Pop 0, Push 2, 1", stack: [2, 1], visited: [0], order: [0] },
  { msg: "Pop 1, Push 4, 3", stack: [2, 4, 3], visited: [0, 1], order: [0, 1] },
  { msg: "Pop 3", stack: [2, 4], visited: [0, 1, 3], order: [0, 1, 3] },
  { msg: "Pop 4", stack: [2], visited: [0, 1, 3, 4], order: [0, 1, 3, 4] },
  { msg: "Pop 2", stack: [], visited: [0, 1, 3, 4, 2], order: [0, 1, 3, 4, 2] }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' + 
    '<div><h4>Stack</h4><div style="color:#fff">' + state.stack.join(', ') + '</div></div>' +
    '<div><h4>DFS Order</h4><div style="color:var(--accent);font-weight:bold;">' + state.order.join(' → ') + '</div></div>' +
    '</div>';
}
`
  },
  {
    id: '068',
    filename: 'algo-068-이진-그래프-bipartite-simulator.html',
    title: '이진 그래프 — Bipartite Check',
    problem: 'graph=[[1,3],[0,2],[1,3],[0,2]] (4 nodes)',
    idea: '2-색칠 (BFS)',
    complexity: '<span class="tag">시간: O(V+E)</span><span class="tag">공간: O(V)</span>',
    architect: '그래프 2-색칠로 이분 판별. 같은 색 인접 노드 = non-bipartite.',
    js: `
let states = [
  { msg: "초기 상태", colors: {} },
  { msg: "Color node 0: Red", colors: {0:'Red'} },
  { msg: "Color neighbors 1, 3: Blue", colors: {0:'Red', 1:'Blue', 3:'Blue'} },
  { msg: "Color neighbor 2 of 1: Red", colors: {0:'Red', 1:'Blue', 3:'Blue', 2:'Red'} },
  { msg: "Check node 2, 3: Valid", colors: {0:'Red', 1:'Blue', 3:'Blue', 2:'Red'} },
  { msg: "Result: Bipartite", colors: {0:'Red', 1:'Blue', 3:'Blue', 2:'Red'} }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' + 
    '<div><h4>Colors</h4><pre style="color:#fff">' + JSON.stringify(state.colors, null, 2) + '</pre></div>' +
    '</div>';
}
`
  },
  {
    id: '069',
    filename: 'algo-069-그래프-복제-clone-simulator.html',
    title: '그래프 복제 — Clone Graph',
    problem: 'graph: node1-[2,4], node2-[1,3], node3-[2,4], node4-[1,3]',
    idea: 'DFS + 해시맵 (visited map)',
    complexity: '<span class="tag">시간: O(V+E)</span><span class="tag">공간: O(V)</span>',
    architect: '깊은 복사와 순환 참조 처리. visited map으로 이미 복제된 노드 재사용.',
    js: `
let states = [
  { msg: "초기 상태", visited: {} },
  { msg: "Clone node 1", visited: {1: "Clone1"} },
  { msg: "Clone node 2", visited: {1: "Clone1", 2: "Clone2"} },
  { msg: "Clone node 3", visited: {1: "Clone1", 2: "Clone2", 3: "Clone3"} },
  { msg: "Clone node 4", visited: {1: "Clone1", 2: "Clone2", 3: "Clone3", 4: "Clone4"} },
  { msg: "Link clones", visited: {1: "Clone1", 2: "Clone2", 3: "Clone3", 4: "Clone4"} }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' + 
    '<div><h4>Visited Map</h4><pre style="color:#fff">' + JSON.stringify(state.visited, null, 2) + '</pre></div>' +
    '</div>';
}
`
  },
  {
    id: '070',
    filename: 'algo-070-단어-사다리-word-ladder-simulator.html',
    title: '단어 사다리 — Word Ladder',
    problem: 'beginWord="hit", endWord="cog", wordList=["hot","dot","dog","lot","log","cog"]',
    idea: 'BFS (암묵적 그래프)',
    complexity: '<span class="tag">시간: O(M²×N)</span><span class="tag">공간: O(M²×N)</span>',
    architect: '암묵적 그래프와 상태 공간 탐색. 각 단어가 노드, 1글자 차이가 엣지.',
    js: `
let states = [
  { msg: "초기 상태", q: ["hit"], level: 1 },
  { msg: "hit -> hot", q: ["hot"], level: 2 },
  { msg: "hot -> dot, lot", q: ["dot", "lot"], level: 3 },
  { msg: "dot -> dog, lot -> log", q: ["dog", "log"], level: 4 },
  { msg: "dog -> cog, log -> cog", q: ["cog"], level: 5 },
  { msg: "Found cog! Length: 5", q: [], level: 5 }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' + 
    '<div><h4>Queue</h4><div style="color:#fff">' + state.q.join(', ') + '</div></div>' +
    '<div><h4>Level</h4><div style="color:var(--accent);font-weight:bold;font-size:1.5rem;">' + state.level + '</div></div>' +
    '</div>';
}
`
  },
  {
    id: '071',
    filename: 'algo-071-다익스트라-dijkstra-simulator.html',
    title: '다익스트라 — Dijkstra\'s Algorithm',
    problem: 'graph with 5 nodes, edges: (0,1,4),(0,2,1),(1,3,1),(2,1,2),(2,3,5),(3,4,3)',
    idea: '우선순위 큐 기반 최단 경로',
    complexity: '<span class="tag">시간: O((V+E) log V)</span><span class="tag">공간: O(V)</span>',
    architect: '우선순위 큐로 최소 비용 경로 탐색. 음수 간선 불가.',
    js: `
let states = [
  { msg: "초기 상태", dist: [0, 'INF', 'INF', 'INF', 'INF'], pq: ["(0,0)"] },
  { msg: "Pop 0, Relax 1, 2", dist: [0, 4, 1, 'INF', 'INF'], pq: ["(1,2)", "(4,1)"] },
  { msg: "Pop 2, Relax 1, 3", dist: [0, 3, 1, 6, 'INF'], pq: ["(3,1)", "(4,1)", "(6,3)"] },
  { msg: "Pop 1, Relax 3", dist: [0, 3, 1, 4, 'INF'], pq: ["(4,3)", "(6,3)"] },
  { msg: "Pop 3, Relax 4", dist: [0, 3, 1, 4, 7], pq: ["(6,3)", "(7,4)"] },
  { msg: "Done", dist: [0, 3, 1, 4, 7], pq: [] }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' + 
    '<div><h4>Distances</h4><div style="color:#fff">' + state.dist.join(', ') + '</div></div>' +
    '<div><h4>Priority Queue</h4><div style="color:#fff">' + state.pq.join(', ') + '</div></div>' +
    '</div>';
}
`
  },
  {
    id: '072',
    filename: 'algo-072-벨만-포드-bellman-ford-simulator.html',
    title: '벨만-포드 — Bellman-Ford',
    problem: '5 nodes, edges with one negative: (0,1,6),(0,2,7),(1,2,8),(1,3,-4),(2,3,9),(2,4,-3),(3,1,5),(4,0,2),(4,3,7)',
    idea: '엣지 완전 순회 V-1회',
    complexity: '<span class="tag">시간: O(VE)</span><span class="tag">공간: O(V)</span>',
    architect: '음수 간선 허용. V-1회 이완 후 추가 이완 가능 = 음수 사이클.',
    js: `
let states = [
  { msg: "초기 상태", dist: [0, 'INF', 'INF', 'INF', 'INF'] },
  { msg: "Iteration 1", dist: [0, 6, 7, 'INF', 'INF'] },
  { msg: "Iteration 2", dist: [0, 6, 7, 2, 4] },
  { msg: "Iteration 3", dist: [0, 6, 7, 2, 4] },
  { msg: "Iteration 4", dist: [0, 6, 7, 2, 4] },
  { msg: "Check negative cycle: None", dist: [0, 6, 7, 2, 4] }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' + 
    '<div><h4>Distances</h4><div style="color:#fff">' + state.dist.join(', ') + '</div></div>' +
    '</div>';
}
`
  },
  {
    id: '073',
    filename: 'algo-073-플로이드-워셜-floyd-simulator.html',
    title: '플로이드-워셜 — Floyd-Warshall',
    problem: '4 nodes, dist matrix: [[0,3,INF,7],[8,0,2,INF],[5,INF,0,1],[2,INF,INF,0]]',
    idea: '모든 쌍 최단 경로 DP',
    complexity: '<span class="tag">시간: O(V³)</span><span class="tag">공간: O(V²)</span>',
    architect: 'DP로 모든 쌍 최단 경로. k번 노드를 경유하는 경우 점진적으로 고려.',
    js: `
let states = [
  { msg: "초기 상태", matrix: [[0,3,'INF',7],[8,0,2,'INF'],[5,'INF',0,1],[2,'INF','INF',0]] },
  { msg: "k=0", matrix: [[0,3,'INF',7],[8,0,2,15],[5,8,0,1],[2,5,'INF',0]] },
  { msg: "k=1", matrix: [[0,3,5,7],[8,0,2,15],[5,8,0,1],[2,5,7,0]] },
  { msg: "k=2", matrix: [[0,3,5,6],[7,0,2,3],[5,8,0,1],[2,5,7,0]] },
  { msg: "k=3", matrix: [[0,3,5,6],[5,0,2,3],[3,6,0,1],[2,5,7,0]] }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' + 
    '<div><h4>Distance Matrix</h4><pre style="color:#fff">' + state.matrix.map(r => r.join('\\t')).join('\\n') + '</pre></div>' +
    '</div>';
}
`
  },
  {
    id: '074',
    filename: 'algo-074-위상-정렬-topological-simulator.html',
    title: '위상 정렬 — Topological Sort (Kahn\'s) ',
    problem: 'DAG: 6 nodes, edges: (5,2),(5,0),(4,0),(4,1),(2,3),(3,1)',
    idea: 'BFS Kahn\'s Algorithm(in- degree) ',
    complexity: '<span class="tag">시간: O(V+E)</span><span class="tag">공간: O(V)</span>',
    architect: '의존성 그래프 선형화. 빌드 시스템, 패키지 의존성 해결의 핵심.',
    js: `
let states = [
  { msg: "초기 상태", inDegree: [2,2,1,1,0,0], q: [4,5], order: [] },
  { msg: "Dequeue 4", inDegree: [1,1,1,1,0,0], q: [5], order: [4] },
  { msg: "Dequeue 5", inDegree: [0,1,0,1,0,0], q: [0,2], order: [4,5] },
  { msg: "Dequeue 0", inDegree: [0,1,0,1,0,0], q: [2], order: [4,5,0] },
  { msg: "Dequeue 2", inDegree: [0,1,0,0,0,0], q: [3], order: [4,5,0,2] },
  { msg: "Dequeue 3", inDegree: [0,0,0,0,0,0], q: [1], order: [4,5,0,2,3] },
  { msg: "Dequeue 1", inDegree: [0,0,0,0,0,0], q: [], order: [4,5,0,2,3,1] }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' + 
    '<div><h4>In-Degree</h4><div style="color:#fff">' + state.inDegree.join(', ') + '</div></div>' +
    '<div><h4>Queue</h4><div style="color:#fff">' + state.q.join(', ') + '</div></div>' +
    '<div><h4>Order</h4><div style="color:var(--accent);font-weight:bold;">' + state.order.join(' → ') + '</div></div>' +
    '</div>';
}
`
  },
  {
    id: '075',
    filename: 'algo-075-크루스칼-kruskal-simulator.html',
    title: '크루스칼 — Kruskal\'s MST',
    problem: '4 nodes, edges: (0,1,10),(0,2,6),(0,3,5),(1,3,15),(2,3,4)',
    idea: 'Union-Find + 엣지 정렬',
    complexity: '<span class="tag">시간: O(E log E)</span><span class="tag">공간: O(V)</span>',
    architect: '탐욕법 + Union-Find. 전역 최소 스패닝 트리를 엣지 단위로 구성.',
    js: `
let states = [
  { msg: "초기 상태", edges: ["(2,3,4)","(0,3,5)","(0,2,6)","(0,1,10)","(1,3,15)"], mst: [], weight: 0 },
  { msg: "Add (2,3,4)", edges: ["(0,3,5)","(0,2,6)","(0,1,10)","(1,3,15)"], mst: ["(2,3)"], weight: 4 },
  { msg: "Add (0,3,5)", edges: ["(0,2,6)","(0,1,10)","(1,3,15)"], mst: ["(2,3)","(0,3)"], weight: 9 },
  { msg: "Skip (0,2,6) - Cycle", edges: ["(0,1,10)","(1,3,15)"], mst: ["(2,3)","(0,3)"], weight: 9 },
  { msg: "Add (0,1,10)", edges: ["(1,3,15)"], mst: ["(2,3)","(0,3)","(0,1)"], weight: 19 },
  { msg: "Done", edges: [], mst: ["(2,3)","(0,3)","(0,1)"], weight: 19 }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' + 
    '<div><h4>MST Edges</h4><div style="color:#fff">' + state.mst.join(', ') + '</div></div>' +
    '<div><h4>Total Weight</h4><div style="color:var(--accent);font-weight:bold;font-size:1.5rem;">' + state.weight + '</div></div>' +
    '</div>';
}
`
  },
  {
    id: '076',
    filename: 'algo-076-프림-prim-simulator.html',
    title: '프림 — Prim\'s MST',
    problem: 'same graph as Kruskal: 4 nodes, edges: (0,1,10),(0,2,6),(0,3,5),(1,3,15),(2,3,4)',
    idea: '우선순위 큐 기반 MST',
    complexity: '<span class="tag">시간: O(E log V)</span><span class="tag">공간: O(V)</span>',
    architect: '정점 중심 MST 구성. Kruskal(엣지 정렬)과 대비되는 접근.',
    js: `
let states = [
  { msg: "초기 상태", visited: [0], pq: ["(0,3,5)","(0,2,6)","(0,1,10)"], mst: [], weight: 0 },
  { msg: "Pop (0,3,5)", visited: [0,3], pq: ["(2,3,4)","(0,2,6)","(0,1,10)","(1,3,15)"], mst: ["(0,3)"], weight: 5 },
  { msg: "Pop (2,3,4)", visited: [0,3,2], pq: ["(0,2,6)","(0,1,10)","(1,3,15)"], mst: ["(0,3)","(2,3)"], weight: 9 },
  { msg: "Pop (0,2,6) - Skip", visited: [0,3,2], pq: ["(0,1,10)","(1,3,15)"], mst: ["(0,3)","(2,3)"], weight: 9 },
  { msg: "Pop (0,1,10)", visited: [0,3,2,1], pq: ["(1,3,15)"], mst: ["(0,3)","(2,3)","(0,1)"], weight: 19 },
  { msg: "Done", visited: [0,3,2,1], pq: [], mst: ["(0,3)","(2,3)","(0,1)"], weight: 19 }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' + 
    '<div><h4>Visited</h4><div style="color:#fff">' + state.visited.join(', ') + '</div></div>' +
    '<div><h4>MST Edges</h4><div style="color:#fff">' + state.mst.join(', ') + '</div></div>' +
    '<div><h4>Total Weight</h4><div style="color:var(--accent);font-weight:bold;font-size:1.5rem;">' + state.weight + '</div></div>' +
    '</div>';
}
`
  },
  {
    id: '077',
    filename: 'algo-077-scc-강한-연결-simulator.html',
    title: '강한 연결 요소 — SCC (Kosaraju\'s) ',
    problem: '8 nodes, edges forming 3 SCCs: {0,1,2,3}, {4,5,6}, {7}',
    idea: 'Kosaraju\'s 2 - pass DFS',
    complexity: '<span class="tag">시간: O(V+E)</span><span class="tag">공간: O(V)</span>',
    architect: '두 번의 DFS로 강한 연결 요소 분해. 실무: 순환 의존성 분석.',
    js: `
let states = [
  { msg: "초기 상태", pass: 1, stack: [], sccs: [] },
  { msg: "Pass 1: DFS finish order", pass: 1, stack: [0,1,2,3,4,5,6,7], sccs: [] },
  { msg: "Pass 2: Reverse graph", pass: 2, stack: [0,1,2,3,4,5,6,7], sccs: [] },
  { msg: "DFS from 7", pass: 2, stack: [0,1,2,3,4,5,6], sccs: ["{7}"] },
  { msg: "DFS from 6", pass: 2, stack: [0,1,2,3], sccs: ["{7}", "{4,5,6}"] },
  { msg: "DFS from 3", pass: 2, stack: [], sccs: ["{7}", "{4,5,6}", "{0,1,2,3}"] }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' + 
    '<div><h4>Stack</h4><div style="color:#fff">' + state.stack.join(', ') + '</div></div>' +
    '<div><h4>SCCs</h4><div style="color:var(--accent);font-weight:bold;">' + state.sccs.join(', ') + '</div></div>' +
    '</div>';
}
`
  },
  {
    id: '078',
    filename: 'algo-078-네트워크-지연-simulator.html',
    title: '네트워크 지연 — Network Delay Time',
    problem: 'times=[[2,1,1],[2,3,1],[3,4,1]], n=4, k=2',
    idea: '다익스트라 응용',
    complexity: '<span class="tag">시간: O((V+E) log V)</span><span class="tag">공간: O(V+E)</span>',
    architect: '신호 전파 = 최단 경로. 모든 노드 도달 가능성과 최대 지연 계산.',
    js: `
let states = [
  { msg: "초기 상태", dist: ['INF', 0, 'INF', 'INF'], maxDelay: 0 },
  { msg: "Pop 2, Relax 1, 3", dist: [1, 0, 1, 'INF'], maxDelay: 1 },
  { msg: "Pop 1", dist: [1, 0, 1, 'INF'], maxDelay: 1 },
  { msg: "Pop 3, Relax 4", dist: [1, 0, 1, 2], maxDelay: 2 },
  { msg: "Pop 4", dist: [1, 0, 1, 2], maxDelay: 2 },
  { msg: "Result: 2", dist: [1, 0, 1, 2], maxDelay: 2 }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' + 
    '<div><h4>Distances (1 to 4)</h4><div style="color:#fff">' + state.dist.join(', ') + '</div></div>' +
    '<div><h4>Max Delay</h4><div style="color:var(--accent);font-weight:bold;font-size:1.5rem;">' + state.maxDelay + '</div></div>' +
    '</div>';
}
`
  },
  {
    id: '079',
    filename: 'algo-079-경로-존재-여부-simulator.html',
    title: '경로 존재 여부 — Find if Path Exists',
    problem: 'n=3, edges=[[0,1],[1,2],[2,0]], source=0, destination=2',
    idea: 'Union-Find / BFS',
    complexity: '<span class="tag">시간: O(E·α(V))</span><span class="tag">공간: O(V)</span>',
    architect: 'Union-Find로 연결성 판별. α(n) ≈ O(1) 실질적 상수 시간.',
    js: `
let states = [
  { msg: "초기 상태", parent: [0, 1, 2] },
  { msg: "Union(0, 1)", parent: [0, 0, 2] },
  { msg: "Union(1, 2)", parent: [0, 0, 0] },
  { msg: "Union(2, 0) - Skip", parent: [0, 0, 0] },
  { msg: "Find(0) == Find(2)? Yes", parent: [0, 0, 0] }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' + 
    '<div><h4>Parent Array</h4><div style="color:#fff">' + state.parent.join(', ') + '</div></div>' +
    '</div>';
}
`
  },
  {
    id: '080',
    filename: 'algo-080-k-경유-최소-비용-simulator.html',
    title: 'K 경유 최소 비용 — Cheapest Flights Within K Stops',
    problem: 'n=4, flights=[[0,1,100],[1,2,100],[2,0,100],[1,3,600],[2,3,200]], src=0, dst=3, k=1',
    idea: 'Bellman-Ford (K번 이완)',
    complexity: '<span class="tag">시간: O(K·E)</span><span class="tag">공간: O(V)</span>',
    architect: 'k번 이완 제한 = 최대 k+1 홉 경로. 복사본으로 동일 라운드 재사용 방지.',
    js: `
let states = [
  { msg: "초기 상태", dist: [0, 'INF', 'INF', 'INF'] },
  { msg: "Iteration 1 (k=0)", dist: [0, 100, 'INF', 'INF'] },
  { msg: "Iteration 2 (k=1)", dist: [0, 100, 200, 700] },
  { msg: "Result: 700", dist: [0, 100, 200, 700] }
];
function renderState(state) {
  viz.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' + 
    '<div><h4>Distances</h4><div style="color:#fff">' + state.dist.join(', ') + '</div></div>' +
    '</div>';
}
`
  }
];

algos.forEach(algo => {
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>\${algo.title}</title>
<style>
\${cssTemplate}
</style>
</head>
<body style="flex-direction:column;">
<div class="header" style="width:100%;max-width:680px;">
    <h2>\${algo.title.split('—')[0]} <span class="sub">— \${algo.title.split('—')[1] || ''}</span></h2>
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
        <h3>\${algo.title}</h3>
        <section><h4>📌 문제</h4><p>\${algo.problem}</p></section>
        <section><h4>💡 핵심 아이디어</h4><p>\${algo.idea}</p></section>
        <section><h4>⏱ 복잡도</h4>\${algo.complexity}</section>
        <section><h4>🏗 아키텍트의 시선</h4><p>\${algo.architect}</p></section>
    </div>
</div>

<script>
\${algo.js}

let currentStep = 0;
let playing = false;
let timer;

const viz = document.getElementById('viz');
const log = document.getElementById('log');
const stepCounter = document.getElementById('step-counter');

function render() {
    if(states.length === 0) return;
    const state = states[currentStep];
    renderState(state);
    log.innerText = state.msg;
    stepCounter.innerText = \\\`Step: \\\${currentStep + 1} / \\\${states.length}\\\`;
    
    document.getElementById('btn-prev').disabled = currentStep === 0;
    document.getElementById('btn-next').disabled = currentStep === states.length - 1;
}

function next() { if (currentStep < states.length - 1) { currentStep++; render(); } else pause(); }
function prev() { if (currentStep > 0) { currentStep--; render(); } }
function play() { if (!playing && currentStep < states.length - 1) { playing = true; document.getElementById('btn-play').disabled = true; document.getElementById('btn-pause').disabled = false; timer = setInterval(next, document.getElementById('speed').value); } }
function pause() { playing = false; document.getElementById('btn-play').disabled = false; document.getElementById('btn-pause').disabled = true; clearInterval(timer); }
function reset() { pause(); currentStep = 0; render(); }

document.getElementById('btn-next').addEventListener('click', () => { pause(); next(); });
document.getElementById('btn-prev').addEventListener('click', () => { pause(); prev(); });
document.getElementById('btn-play').addEventListener('click', play);
document.getElementById('btn-pause').addEventListener('click', pause);
document.getElementById('btn-reset').addEventListener('click', reset);
document.getElementById('speed').addEventListener('input', () => { if (playing) { pause(); play(); } });

\${modalJsTemplate}

render();
</script>
</body>
</html>`;

  fs.writeFileSync(path.join(import.meta.dirname, algo.filename), html);
});
console.log('Generated 20 files successfully.');
