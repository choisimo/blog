---
title: "[알고리즘] 벨만-포드 (Bellman-Ford)"
date: "2025-09-20"
category: "Algorithm"
tags: ["Algorithm", "완화 기반 수렴", "Problem Solving", "Python", "Java"]
excerpt: "Graph Advanced - 벨만-포드 (Bellman-Ford) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

벨만-포드는 최단 경로 계산이라기보다, 간선 완화를 반복해 거리 추정값이 수렴하는지를 관찰하는 relaxation 시스템입니다. 왜 `V-1`번 이후에도 더 줄어든다면 음수 사이클이 있다고 말할 수 있는지 설명해 보세요.

1. 각 라운드에서 모든 간선을 완화할 때 `dist`가 어떻게 줄어드는지 추적하고, 경로 길이와 라운드 수의 관계를 설명하세요.
2. 다익스트라와 비교해 왜 더 느리지만 더 일반적인지 설명하세요.
3. 금융 차익거래나 보상 기반 그래프처럼 음수 사이클이 실제 의미를 갖는 사례를 들어 설명하세요.

## 답변할 때 포함할 것

- 라운드별 dist 변화를 적을 것
- `V-1`의 의미를 설명할 것
- 음수 사이클 검출과 최단 경로 계산을 분리할 것

## 🐍 Python 구현

```python
"""
문제 072: 벨만-포드 알고리즘 (Bellman-Ford)
[문제] 음수 가중치를 포함한 그래프에서 최단 거리를 구하고, 음수 사이클을 탐지하라.
[아키텍트의 시선] 완화(Relaxation) 기반 수렴.
V-1회 모든 간선 완화 → 최단 거리 수렴. V번째 완화 시 갱신 발생 = 음수 사이클.
다익스트라보다 느리지만 음수 가중치 허용 → 유연성 vs 성능 트레이드오프.
실무: 환율 차익거래 탐지, 네트워크 비용 최적화 (RIP 프로토콜).
[시간 복잡도] O(V*E) [공간 복잡도] O(V)
"""
from typing import List, Tuple, Dict, Optional

def bellman_ford(n: int, edges: List[Tuple[int, int, int]], src: int) -> Optional[Dict[int, float]]:
    """edges = [(u, v, w), ...], n = 정점 수, src = 시작점
    음수 사이클이면 None 반환"""
    dist = {i: float('inf') for i in range(n)}
    dist[src] = 0

    # V-1회 완화
    for _ in range(n - 1):
        for u, v, w in edges:
            if dist[u] != float('inf') and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w

    # 음수 사이클 탐지: V번째 완화에서 갱신 발생 시
    for u, v, w in edges:
        if dist[u] != float('inf') and dist[u] + w < dist[v]:
            return None  # 음수 사이클 존재

    return dist

if __name__ == "__main__":
    # 기본 테스트
    edges = [(0,1,4), (0,2,1), (2,1,2), (1,3,1), (2,3,5), (3,4,3)]
    dist = bellman_ford(5, edges, 0)
    assert dist is not None
    assert dist[0] == 0
    assert dist[1] == 3
    assert dist[3] == 4
    assert dist[4] == 7
    # 음수 가중치 (사이클 없음)
    edges2 = [(0,1,1), (1,2,-1), (0,2,3)]
    dist2 = bellman_ford(3, edges2, 0)
    assert dist2 is not None
    assert dist2[2] == 0  # 0→1→2 = 1+(-1) = 0
    # 음수 사이클 탐지
    edges3 = [(0,1,1), (1,2,-1), (2,0,-1)]
    assert bellman_ford(3, edges3, 0) is None
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 072: 벨만-포드 알고리즘 (Bellman-Ford Algorithm)
 *
 * [문제] 음수 가중치 간선이 있는 그래프에서 최단 경로를 구하라.
 * 음수 사이클도 감지하라.
 *
 * [아키텍트의 시선]
 * 벨만-포드의 반복적 완화(Relaxation)는 분산 시스템의 수렴 프로토콜,
 * BGP 라우팅의 경로 갱신, 최종 일관성(Eventual Consistency)과 동일하다.
 * "V-1번 반복하면 수렴" = 네트워크 지름만큼 정보가 전파되면 안정.
 *
 * [시간 복잡도] O(V * E) [공간 복잡도] O(V)
 */
import java.util.*;

public class P072BellmanFord {
    public static int[] bellmanFord(int n, int[][] edges, int src) {
        int[] dist = new int[n];
        Arrays.fill(dist, Integer.MAX_VALUE);
        dist[src] = 0;

        // V-1번 반복: 모든 간선에 대해 완화
        for (int i = 0; i < n - 1; i++) {
            boolean updated = false;
            for (int[] edge : edges) {
                int u = edge[0], v = edge[1], w = edge[2];
                if (dist[u] != Integer.MAX_VALUE && dist[u] + w < dist[v]) {
                    dist[v] = dist[u] + w;
                    updated = true;
                }
            }
            if (!updated) break; // 조기 종료 최적화
        }

        // 음수 사이클 감지: V번째 반복에서도 갱신되면 음수 사이클 존재
        for (int[] edge : edges) {
            int u = edge[0], v = edge[1], w = edge[2];
            if (dist[u] != Integer.MAX_VALUE && dist[u] + w < dist[v]) {
                return null; // 음수 사이클
            }
        }
        return dist;
    }

    public static void main(String[] args) {
        int[][] edges = {{0,1,4},{0,2,1},{2,1,2},{1,3,1},{2,3,5},{3,4,3}};
        int[] dist = bellmanFord(5, edges, 0);
        assert dist != null;
        assert dist[0] == 0;
        assert dist[1] == 3;
        assert dist[3] == 4;
        assert dist[4] == 7;

        // 음수 가중치
        int[][] edges2 = {{0,1,1},{1,2,-3},{2,0,1}};
        int[] dist2 = bellmanFord(3, edges2, 0);
        assert dist2 == null; // 음수 사이클
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
