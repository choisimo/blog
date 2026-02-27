---
title: "[알고리즘] 네트워크 지연"
date: "2025-10-05"
category: "Algorithm"
tags: ["Algorithm", "다익스트라 응용", "Problem Solving", "Python", "Java"]
excerpt: "Graph Advanced - 네트워크 지연 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**네트워크 지연**
* 파트: Graph Advanced
* 관련 알고리즘: 다익스트라 응용

> **Architect's View**
> 전파 시뮬레이션

이 글에서는 네트워크 지연 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 078: 네트워크 지연 시간 (Network Delay Time)
[문제] N개 노드의 네트워크에서 K번 노드에서 신호를 보낼 때
       모든 노드가 수신하는 최소 시간을 구하라. 불가능하면 -1.
[아키텍트의 시선] 전파 시뮬레이션과 다익스트라 응용.
다익스트라로 시작점에서 모든 노드까지 최단 거리 → 그 중 최대값 = 답.
도달 불가 노드 존재 시 -1.
실무: CDN 전파 시간, 분산 시스템 합의 시간, 장애 전파 분석.
[시간 복잡도] O((V+E) log V) [공간 복잡도] O(V+E)
"""
from typing import List
import heapq
from collections import defaultdict

def network_delay_time(times: List[List[int]], n: int, k: int) -> int:
    """times = [[u, v, w], ...], n = 노드 수, k = 시작 노드"""
    graph = defaultdict(list)
    for u, v, w in times:
        graph[u].append((v, w))

    dist = {}
    pq = [(0, k)]

    while pq:
        d, u = heapq.heappop(pq)
        if u in dist:
            continue
        dist[u] = d
        for v, w in graph[u]:
            if v not in dist:
                heapq.heappush(pq, (d + w, v))

    if len(dist) != n:
        return -1
    return max(dist.values())

if __name__ == "__main__":
    assert network_delay_time([[2,1,1],[2,3,1],[3,4,1]], 4, 2) == 2
    assert network_delay_time([[1,2,1]], 2, 2) == -1  # 2에서 1 도달 불가
    assert network_delay_time([[1,2,1],[2,3,2],[1,3,4]], 3, 1) == 3
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 078: 네트워크 지연 시간 (Network Delay Time)
 *
 * [문제] n개의 노드와 가중치 방향 간선이 주어질 때,
 * 소스 노드에서 모든 노드에 신호가 도달하는 최소 시간을 구하라.
 * 모든 노드에 도달 불가능하면 -1.
 *
 * [아키텍트의 시선]
 * 네트워크 지연 = 최장 최단 경로 = 다익스트라 결과의 최대값이다.
 * CDN 전파 시간, 분산 합의 수렴 시간, 배치 작업의 완료 시간은
 * 모두 "가장 느린 경로"에 의해 결정된다.
 *
 * [시간 복잡도] O((V+E) log V) [공간 복잡도] O(V + E)
 */
import java.util.*;

public class P078NetworkDelay {
    @SuppressWarnings("unchecked")
    public static int networkDelayTime(int[][] times, int n, int k) {
        List<int[]>[] graph = new List[n + 1];
        for (int i = 0; i <= n; i++) graph[i] = new ArrayList<>();
        for (int[] t : times) graph[t[0]].add(new int[]{t[1], t[2]});

        int[] dist = new int[n + 1];
        Arrays.fill(dist, Integer.MAX_VALUE);
        dist[k] = 0;

        PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> a[0] - b[0]);
        pq.offer(new int[]{0, k});

        while (!pq.isEmpty()) {
            int[] curr = pq.poll();
            int d = curr[0], u = curr[1];
            if (d > dist[u]) continue;
            for (int[] edge : graph[u]) {
                int v = edge[0], w = edge[1];
                if (dist[u] + w < dist[v]) {
                    dist[v] = dist[u] + w;
                    pq.offer(new int[]{dist[v], v});
                }
            }
        }

        int maxDist = 0;
        for (int i = 1; i <= n; i++) {
            if (dist[i] == Integer.MAX_VALUE) return -1;
            maxDist = Math.max(maxDist, dist[i]);
        }
        return maxDist;
    }

    public static void main(String[] args) {
        assert networkDelayTime(new int[][]{{2,1,1},{2,3,1},{3,4,1}}, 4, 2) == 2;
        assert networkDelayTime(new int[][]{{1,2,1}}, 2, 1) == 1;
        assert networkDelayTime(new int[][]{{1,2,1}}, 2, 2) == -1;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
