---
title: "알고리즘 아틀리에: 다익스트라 — 5단계 직관 학습"
date: "2024-11-15"
category: "Algorithm"
tags: ["다익스트라", "최단경로", "그래프", "우선순위 큐", "알고리즘 아틀리에"]
excerpt: "비유→원리→메커니즘→자료구조→코드로 다익스트라를 직관적으로 체득합니다."
readTime: "7분"
---

# 알고리즘 아틀리에: 다익스트라

본 글은 PRD의 5단계 학습 여정(비유→원리→메커니즘→자료구조→코드)에 맞추어, "왜"에서 출발해 "어떻게"까지 연결되는 직관 학습을 제공합니다.

## Block 1: 비유법으로 패턴 파악 (Analogy)

- Interactive Story: 도시(가중치 그래프)에 불이 났습니다. 당신은 소방서(출발점)에서 가장 빨리 도착할 수 있는 길만을 따라 화재 범위를 좁혀야 합니다. 매 순간 "지금까지 누적 시간이 가장 짧은 교차로"를 먼저 확정하고, 그 이웃으로 탐색 범위를 넓혀갑니다.
- Multiple Choice Quiz — 핵심 원칙은?
  - A. 불난 곳과 물리적으로 더 가까워 보이는 교차로부터 탐색한다 (오답: 휴리스틱 혼동 — A\*)
  - B. 거치는 교차로 수가 가장 적은 길을 우선한다 (오답: BFS 혼동)
  - C. 출발점으로부터 "현재까지 누적된 시간"이 가장 짧은 지점부터 다음 길을 탐색한다 (정답)

## Block 2: 원리 이해 (Principle)

- Core Principle Statement: 다익스트라는 탐욕법(Greedy)에 기반하며, "이미 확정된 최단 경로"의 경계를 점진적으로 넓혀 나간다.
- 왜 성립하는가?
  - A 지점의 최단 거리가 10으로 확정됐다면, 다른 경로를 통해 A를 더 싸게 도달하는 길은 존재하지 않는다. 더 멀리 돌아와도 누적 가중치는 반드시 10 이상이기 때문이다. 이 불변식이 탐욕 선택의 정당성을 보장한다.
- Checkpoint Q: "가장 작은 누적 거리 노드"를 확정할 때, 그 노드로 더 짧게 들어오는 경로가 나중에 발견될 수 있을까?
  - A. 가능하다 B. 불가능하다(정답)

## Block 3: 세부 작동 방식 (Mechanism)

- Algorithm Visualizer(개념):
  1. 시작 노드의 거리를 0으로, 나머지는 ∞로 설정한다.
  2. 아직 확정되지 않은 노드 중, 최솟값(누적 거리)이 있는 노드를 꺼낸다.
  3. 그 노드의 모든 이웃에 대해 더 짧은 경로를 발견하면 거리 값을 갱신(relaxation)한다.
  4. 2~3을 반복한다.
- Interactive Simulation — 다음 선택은?
  - 정지 화면: 거리 테이블이 {A:0, B:5, C:8, D:∞, E:…}일 때 다음 방문 노드는? 정답: B (5가 가장 작음). 오답을 고르면 "D의 8보다 B의 5가 작습니다" 팝업.
- 실수 포인트
  - 방문 확정(visited)과 거리 갱신(relaxation)을 구분하지 않으면 중복 처리로 성능/정확도가 무너진다.

## Block 4: 자료구조 연결 (Data Structure)

- Performance Comparison(개념):
  - 배열(naive): 매 단계 최소 거리 노드 탐색에 O(V) — 전체 O(V^2)
  - 우선순위 큐 Min-Heap: 추출 O(log V), 감소-키 갱신(푸시) O(log V) — 전체 O((V+E) log V)
- Concept Matching — 요구사항→도구
  - "항상 가장 작은 누적 거리 후보를 즉시 꺼내고 싶다" → 우선순위 큐(Min-Heap)

## Block 5: 실제 코드 문제 (Application)

- 변형 문제
  - 문제: 어떤 노드를 지날 때마다 그 노드의 통행료 toll[v]가 추가로 듭니다. 시작 s에서 도착 t까지 (간선 가중치 + 노드 통행료)의 합을 최소화하세요.
  - 핵심: relaxation 시 비용을 w(u→v)+toll[v] 만큼 더해 누적 비용을 갱신한다. 시작 노드의 통행료는 상황에 따라 0으로 처리(문제 정의에 명시한다고 가정).

```python
import heapq
INF = 10**18

def dijkstra_with_toll(n, adj, toll, s, t):
    # adj[u] = list of (v, w)
    dist = [INF]*n
    dist[s] = 0
    pq = [(0, s)]  # (cost, node)

    while pq:
        cost, u = heapq.heappop(pq)
        if cost != dist[u]:
            continue
        if u == t:
            return cost
        for v, w in adj[u]:
            # 방문 시 v의 노드 통행료를 추가한다고 가정
            ncost = cost + w + (0 if v == s else toll[v])
            if ncost < dist[v]:
                dist[v] = ncost
                heapq.heappush(pq, (ncost, v))
    return dist[t]
```

- Staged Hints
  - Hint 1: 소방관 비유의 핵심 — "현재까지 가장 가까운 노드"부터 확정.
  - Hint 2: 이를 빠르게 하기 위한 도구는? → Min-Heap.
  - Hint 3: 변형의 본질은 비용 함수 수정(간선 + 노드 통행료). relaxation 식을 바꾸면 된다.

- Test Case Visualization(개념)
  - 제출이 실패한 입력을 시뮬레이터(거리 테이블/그래프 애니메이션)에 넣어, 어느 단계에서 잘못된 선택/갱신이 발생했는지 단계별로 추적한다.

---

마무리: 다익스트라는 "확정 경계"를 키우는 탐욕 + 우선순위 큐의 결합입니다. 원리를 먼저 붙잡고(왜), 그다음 자료구조와 구현(어떻게)을 결합하면 어떤 변형도 유연하게 대응할 수 있습니다.

---

## Interactive Add‑ons

<div class="mcq" data-answer="C">
  <p><strong>퀴즈:</strong> 최단 경로를 보장하기 위한 단 하나의 원칙은?</p>
  <label><input type="radio" name="q-dij-1" value="A"> 물리적으로 불난 곳과 더 가까워 보이는 교차로부터 탐색</label><br>
  <label><input type="radio" name="q-dij-1" value="B"> 거쳐가는 교차로 수가 가장 적은 길 우선</label><br>
  <label><input type="radio" name="q-dij-1" value="C"> 현재까지 누적 시간이 가장 짧은 지점부터 탐색</label><br>
  <button class="mcq-submit">확인</button>
  <div class="mcq-feedback" hidden></div>
</div>

<div class="pick-one" data-answer="B" style="margin-top: 1rem;">
  <p><strong>예측:</strong> 거리 테이블이 {A:0, B:5, C:8, D:∞}일 때 다음 방문 노드는?</p>
  <button data-value="A">A</button>
  <button data-value="B">B</button>
  <button data-value="C">C</button>
  <button data-value="D">D</button>
  <div class="pick-feedback" hidden></div>
</div>

<details style="margin-top: 1rem;"><summary>Hint 1</summary> "현재까지 가장 가까운 노드"부터 확정합니다.</details>
<details><summary>Hint 2</summary> 빠른 선택을 위해 Min‑Heap(우선순위 큐)을 사용합니다.</details>
<details><summary>Hint 3</summary> 변형은 비용 함수 수정(간선 + 노드 통행료)로 구현합니다.</details>

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
  document.querySelectorAll('.pick-one').forEach(function(box){
    var answer = box.dataset.answer;
    var fb = box.querySelector('.pick-feedback');
    box.querySelectorAll('button[data-value]').forEach(function(b){
      b.addEventListener('click', function(){
        fb.hidden = false;
        if(b.dataset.value === answer){ fb.textContent='정답! B의 5가 가장 작습니다.'; fb.style.color='#065f46'; }
        else { fb.textContent='오답. 최소 누적 거리를 확인하세요.'; fb.style.color='#991b1b'; }
      });
    });
  });
})();
</script>
