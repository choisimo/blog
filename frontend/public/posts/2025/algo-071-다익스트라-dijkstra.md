---
title: "[알고리즘] 다익스트라 (Dijkstra)"
date: "2025-09-18"
category: "Algorithm"
tags: ["Algorithm", "탐욕+우선순위큐", "Problem Solving", "Python", "Java"]
excerpt: "Graph Advanced - 다익스트라 (Dijkstra) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**다익스트라 (Dijkstra)**
* 파트: Graph Advanced
* 관련 알고리즘: 탐욕+우선순위큐

> **Architect's View**
> 라우팅과 최단 경로

이 글에서는 다익스트라 (Dijkstra) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 071: 다익스트라 알고리즘 (Dijkstra's Shortest Path)
[문제] 가중 그래프에서 시작 정점으로부터 모든 정점까지의 최단 거리를 구하라.
[아키텍트의 시선] 라우팅과 최단 경로.
탐욕+우선순위 큐: 현재까지 가장 가까운 미방문 정점부터 처리.
음수 가중치 불가 → 한 번 확정된 거리는 변하지 않음(탐욕 성질).
실무: 네트워크 라우팅(OSPF), GPS 내비게이션, CDN 서버 선택.
[시간 복잡도] O((V+E) log V) [공간 복잡도] O(V+E)
"""
from typing import List, Dict, Tuple
import heapq
from collections import defaultdict

def dijkstra(graph: Dict[int, List[Tuple[int, int]]], start: int) -> Dict[int, int]:
    """다익스트라: graph[u] = [(v, weight), ...]"""
    dist = {start: 0}
    pq = [(0, start)]  # (거리, 노드)

    while pq:
        d, u = heapq.heappop(pq)
        if d > dist.get(u, float('inf')):
            continue  # 이미 더 짧은 경로로 처리됨
        for v, w in graph.get(u, []):
            new_dist = d + w
            if new_dist < dist.get(v, float('inf')):
                dist[v] = new_dist
                heapq.heappush(pq, (new_dist, v))

    return dist

def dijkstra_with_path(graph: Dict[int, List[Tuple[int, int]]], start: int, end: int) -> Tuple[int, List[int]]:
    """경로 추적 포함 다익스트라"""
    dist = {start: 0}
    prev = {start: None}
    pq = [(0, start)]

    while pq:
        d, u = heapq.heappop(pq)
        if u == end:
            break
        if d > dist.get(u, float('inf')):
            continue
        for v, w in graph.get(u, []):
            new_dist = d + w
            if new_dist < dist.get(v, float('inf')):
                dist[v] = new_dist
                prev[v] = u
                heapq.heappush(pq, (new_dist, v))

    if end not in dist:
        return -1, []
    path = []
    node = end
    while node is not None:
        path.append(node)
        node = prev[node]
    return dist[end], path[::-1]

if __name__ == "__main__":
    graph = {
        0: [(1, 4), (2, 1)],
        1: [(3, 1)],
        2: [(1, 2), (3, 5)],
        3: [(4, 3)],
        4: []
    }
    dist = dijkstra(graph, 0)
    assert dist[0] == 0
    assert dist[1] == 3  # 0→2→1
    assert dist[3] == 4  # 0→2→1→3
    assert dist[4] == 7  # 0→2→1→3→4
    cost, path = dijkstra_with_path(graph, 0, 4)
    assert cost == 7
    assert path == [0, 2, 1, 3, 4]
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 071: 다익스트라 최단 경로 (Dijkstra's Algorithm)
 *
 * [문제] 가중치 그래프에서 단일 출발점 최단 경로를 구하라.
 * 음수 가중치는 없다고 가정.
 *
 * [아키텍트의 시선]
 * 다익스트라는 네트워크 라우팅(OSPF), GPS 네비게이션,
 * CDN 경로 최적화의 핵심 알고리즘이다.
 * 우선순위 큐 + 탐욕법 = "현재까지 최선의 선택이 전체 최선을 보장"하는 구조다.
 *
 * [시간 복잡도] O((V+E) log V) [공간 복잡도] O(V)
 */
import java.util.*;

public class P071Dijkstra {
    public static int[] dijkstra(int n, List<int[]>[] graph, int src) {
        int[] dist = new int[n];
        Arrays.fill(dist, Integer.MAX_VALUE);
        dist[src] = 0;

        // {거리, 노드} 최소 힙
        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[0] - b[0]);
        pq.offer(new int[]{0, src});

        while (!pq.isEmpty()) {
            int[] curr = pq.poll();
            int d = curr[0], u = curr[1];
            if (d > dist[u]) continue; // 이미 더 짧은 경로 발견됨

            for (int[] edge : graph[u]) {
                int v = edge[0], w = edge[1];
                if (dist[u] + w < dist[v]) {
                    dist[v] = dist[u] + w;
                    pq.offer(new int[]{dist[v], v});
                }
            }
        }
        return dist;
    }

    @SuppressWarnings("unchecked")
    public static void main(String[] args) {
        int n = 5;
        List<int[]>[] graph = new List[n];
        for (int i = 0; i < n; i++) graph[i] = new ArrayList<>();
        // 간선: {도착, 가중치}
        graph[0].add(new int[]{1, 4}); graph[0].add(new int[]{2, 1});
        graph[1].add(new int[]{3, 1});
        graph[2].add(new int[]{1, 2}); graph[2].add(new int[]{3, 5});
        graph[3].add(new int[]{4, 3});

        int[] dist = dijkstra(n, graph, 0);
        assert dist[0] == 0;
        assert dist[1] == 3; // 0→2→1
        assert dist[2] == 1; // 0→2
        assert dist[3] == 4; // 0→2→1→3
        assert dist[4] == 7; // 0→2→1→3→4
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
