---
title: "알고리즘 아틀리에: BFS — 5단계 직관 학습"
date: "2024-11-16"
category: "Algorithm"
tags: ["BFS", "그래프", "최단경로(무가중치)", "큐", "알고리즘 아틀리에"]
excerpt: "물결 비유로 시작해 큐 기반 레이어 탐색의 원리와 코드를 연결합니다."
readTime: "6분"
---

# 알고리즘 아틀리에: BFS

## Block 1: 비유법으로 패턴 파악 (Analogy)

- Story: 호수에 돌을 던지면 동심원이 바깥으로 번집니다. 출발점에서 1칸, 2칸, 3칸… 같은 "거리 레벨"로 파동이 확장됩니다. 가장 먼저 닿는 시점이 곧 최단 이동 횟수입니다.
- Quiz — 핵심 원칙은?
  - A. 가장 멀리 보이는 지점을 먼저 간다 (오답)
  - B. 출발점에서 거리(간선 수)가 같은 정점들을 한 레벨씩 모두 방문한다 (정답)
  - C. 가중치가 작은 간선을 우선한다 (오답: 다익스트라 혼동)

## Block 2: 원리 이해 (Principle)

- Core Principle: BFS는 "간선 가중치가 동일(=1)"일 때 최단 경로를 보장한다. 같은 거리 레벨을 전부 처리한 후에 다음 레벨로 넘어가므로, 어떤 정점이 처음 방문되는 순간이 그 정점까지의 최소 이동 횟수다.
- 왜 성립하는가?
  - 레벨 단위로 파동처럼 확장하기 때문. 더 긴 레벨에서 더 짧은 경로가 나올 수 없다.

## Block 3: 세부 작동 방식 (Mechanism)

- 절차: 큐에 시작점을 넣고, pop하면서 이웃을 방문한다. 방문 시 거리[이웃] = 거리[현재]+1로 갱신한다. 이미 방문한 노드는 다시 큐에 넣지 않는다.
- 예측 퀴즈: 현재 레벨의 모든 노드를 처리했으면 다음에 큐에 들어갈 노드의 공통 특성은? → 거리 값이 동일한 다음 레벨.

## Block 4: 자료구조 연결 (Data Structure)

- 필수 도구: 큐(파이썬 deque). 선입선출이 레벨 순회를 자연스럽게 보장한다.
- 잘못된 선택: 스택(LIFO)을 쓰면 깊이 우선(DFS)으로 변해 레벨 보장이 깨진다.

## Block 5: 실제 코드 문제 (Application)

- 문제: 0/1이 아닌, 벽(1)과 빈칸(0)으로 구성된 격자에서 시작점→도착점까지 최소 이동 횟수를 구하라. 네 방향 이동, 격자 밖 불가.

```python
from collections import deque

def bfs_min_steps(grid, sx, sy, tx, ty):
    n, m = len(grid), len(grid[0])
    INF = 10**9
    dist = [[INF]*m for _ in range(n)]
    dist[sx][sy] = 0
    q = deque([(sx, sy)])
    DIRS = [(1,0),(-1,0),(0,1),(0,-1)]

    while q:
        x, y = q.popleft()
        if (x, y) == (tx, ty):
            return dist[x][y]
        for dx, dy in DIRS:
            nx, ny = x+dx, y+dy
            if 0 <= nx < n and 0 <= ny < m and grid[nx][ny] == 0:
                if dist[nx][ny] == INF:
                    dist[nx][ny] = dist[x][y] + 1
                    q.append((nx, ny))
    return -1
```

- Staged Hints
  - Hint 1: "물결"은 선입선출일 때만 아름답게 퍼집니다.
  - Hint 2: 처음 방문 순간 = 최단 이동 횟수.
  - Hint 3: 방문 체크(또는 거리 초기화)를 큐에 넣을 때 즉시 수행해야 중복 방문을 막을 수 있습니다.

- Test Case Visualization(개념)
  - 실패 케이스의 격자를 단계별 레벨 착색으로 재생해, 막힌 지점과 방문 순서를 시각적으로 확인합니다.

---

요약: BFS는 "거리 = 간선 수" 세계에서 최단을 보장하는 단순하지만 강력한 레벨 순회입니다. 큐의 힘을 믿으세요.

---

## Interactive Add‑ons

<div class="mcq" data-answer="B">
  <p><strong>퀴즈:</strong> BFS가 최단 이동 횟수를 보장하는 이유는?</p>
  <label><input type="radio" name="q-bfs-1" value="A"> 가장 멀리 보이는 곳부터 탐색</label><br>
  <label><input type="radio" name="q-bfs-1" value="B"> 같은 거리 레벨을 모두 처리한 뒤 다음 레벨로 진행</label><br>
  <label><input type="radio" name="q-bfs-1" value="C"> 간선 가중치가 작은 것을 우선</label><br>
  <button class="mcq-submit">확인</button>
  <div class="mcq-feedback" hidden></div>
</div>

<details style="margin-top: 1rem;"><summary>Hint 1</summary> 선입선출 큐가 레벨 순회를 보장합니다.</details>
<details><summary>Hint 2</summary> "처음 방문 순간"이 바로 최단 이동 횟수입니다.</details>
<details><summary>Hint 3</summary> 방문 체크는 큐에 넣을 때 즉시!</details>

<script>
(function(){
  document.querySelectorAll('.mcq').forEach(function(mcq){
    var answer = mcq.dataset.answer;
    var btn = mcq.querySelector('.mcq-submit');
    var fb = mcq.querySelector('.mcq-feedback');
    btn && btn.addEventListener('click', function(){
      var checked = mcq.querySelector('input[type=radio]:checked');
      fb.hidden = false;
      if(!checked){ fb.textContent='선택해주세요.'; fb.style.color='#b45309'; return; }
      if(checked.value === answer){ fb.textContent='정답! ✅'; fb.style.color='#065f46'; }
      else { fb.textContent='오답입니다. 다시 생각해보세요.'; fb.style.color='#991b1b'; }
    });
  });
})();
</script>
