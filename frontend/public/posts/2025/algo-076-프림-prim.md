---
title: "[알고리즘] 프림 (Prim)"
date: "2025-10-01"
category: "Algorithm"
tags: ["Algorithm", "힙 기반 확장", "Problem Solving", "Python", "Java"]
excerpt: "Graph Advanced - 프림 (Prim) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

프림은 MST를 만드는 방식 중에서도, 이미 선택된 정점 집합과 바깥 정점 집합 사이의 최소 연결 간선을 계속 늘려 가는 frontier 확장 문제입니다. 왜 "현재 트리 밖으로 나가는 가장 싼 간선"을 고르면 되는지 설명해 보세요.

1. 방문된 정점 집합, 후보 간선 힙, 새로 편입되는 정점이 어떻게 변하는지 추적하세요.
2. 크루스칼과 비교해 정점 기반 확장과 간선 기반 선택의 차이를 설명하세요.
3. dense graph, sparse graph, adjacency matrix 환경에서 프림의 구현 선택이 어떻게 달라지는지 설명하세요.

## 답변할 때 포함할 것

- visited 집합과 힙 상태를 적을 것
- frontier 개념을 설명할 것
- 프림과 크루스칼의 관점 차이를 적을 것

## 🐍 Python 구현

```python
"""
문제 076: 프림 알고리즘 (Prim's MST)
[문제] 가중 무방향 그래프에서 프림 알고리즘으로 MST를 구하라.
[아키텍트의 시선] 정점 기반 네트워크 확장.
임의의 정점에서 시작 → 현재 MST와 연결된 최소 가중치 간선 선택.
우선순위 큐로 최소 간선 효율적 추출.
크루스칼(간선 중심) vs 프림(정점 중심): 밀집 그래프에서 프림이 유리.
실무: 네트워크 확장 설계, 점진적 인프라 구축.
[시간 복잡도] O((V+E) log V) [공간 복잡도] O(V+E)
"""
from typing import List, Tuple, Dict
import heapq
from collections import defaultdict

def prim(n: int, edges: List[Tuple[int, int, int]]) -> Tuple[int, List[Tuple[int, int, int]]]:
    """n=정점 수, edges=[(u, v, w), ...] → (총 비용, MST 간선들)"""
    graph = defaultdict(list)
    for u, v, w in edges:
        graph[u].append((w, v))
        graph[v].append((w, u))

    visited = set()
    mst = []
    total_cost = 0
    # (가중치, 현재 노드, 이전 노드)
    pq = [(0, 0, -1)]

    while pq and len(visited) < n:
        w, u, prev = heapq.heappop(pq)
        if u in visited:
            continue
        visited.add(u)
        total_cost += w
        if prev != -1:
            mst.append((prev, u, w))
        for weight, v in graph[u]:
            if v not in visited:
                heapq.heappush(pq, (weight, v, u))

    return total_cost, mst

if __name__ == "__main__":
    edges = [(0,1,4), (0,2,1), (1,2,2), (1,3,5), (2,3,3)]
    cost, mst = prim(4, edges)
    assert cost == 6  # 같은 MST: 비용 6
    assert len(mst) == 3
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 076: 프림 MST (Prim's Minimum Spanning Tree)
 *
 * [문제] 가중치 무방향 그래프의 최소 신장 트리를 프림 알고리즘으로 구하라.
 *
 * [아키텍트의 시선]
 * 프림은 "현재 트리에서 가장 가까운 정점을 추가"하는 탐욕법이다.
 * 밀집 그래프에서 크루스칼보다 효율적이며,
 * 네트워크 확장(새 노드를 기존 인프라에 최소 비용으로 연결)과 동일하다.
 *
 * [시간 복잡도] O((V+E) log V) [공간 복잡도] O(V + E)
 */
import java.util.*;

public class P076Prim {
    @SuppressWarnings("unchecked")
    public static int primMST(int n, int[][] edges) {
        List<int[]>[] graph = new List[n];
        for (int i = 0; i < n; i++) graph[i] = new ArrayList<>();
        for (int[] e : edges) {
            graph[e[0]].add(new int[]{e[1], e[2]});
            graph[e[1]].add(new int[]{e[0], e[2]});
        }

        boolean[] inMST = new boolean[n];
        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[1] - b[1]); // {노드, 가중치}
        pq.offer(new int[]{0, 0});
        int totalWeight = 0, count = 0;

        while (!pq.isEmpty() && count < n) {
            int[] curr = pq.poll();
            int u = curr[0], w = curr[1];
            if (inMST[u]) continue;
            inMST[u] = true;
            totalWeight += w;
            count++;
            for (int[] edge : graph[u]) {
                if (!inMST[edge[0]]) {
                    pq.offer(new int[]{edge[0], edge[1]});
                }
            }
        }
        return totalWeight;
    }

    public static void main(String[] args) {
        int[][] edges = {{0,1,4},{0,2,1},{1,2,2},{1,3,5},{2,3,8},{3,4,3}};
        assert primMST(5, edges) == 11;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
