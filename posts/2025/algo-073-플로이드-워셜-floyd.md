---
title: "[알고리즘] 플로이드-워셜 (Floyd)"
date: "2025-09-23"
category: "Algorithm"
tags: ["Algorithm", "전이적 DP", "Problem Solving", "Python", "Java"]
excerpt: "Graph Advanced - 플로이드-워셜 (Floyd) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**플로이드-워셜 (Floyd)**
* 파트: Graph Advanced
* 관련 알고리즘: 전이적 DP

> **Architect's View**
> 모든 쌍 최단 경로

이 글에서는 플로이드-워셜 (Floyd) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 073: 플로이드-워셜 알고리즘 (Floyd-Warshall)
[문제] 모든 정점 쌍 간의 최단 거리를 구하라.
[아키텍트의 시선] 전이적 폐쇄(Transitive Closure)와 DP.
dp[i][j] = min(dp[i][j], dp[i][k] + dp[k][j]) — k를 경유지로 고려.
3중 루프로 모든 쌍 계산 → O(V^3). 밀집 그래프에 적합.
실무: 도시 간 최단 거리, 네트워크 라우팅 테이블, 도달 가능성 분석.
[시간 복잡도] O(V^3) [공간 복잡도] O(V^2)
"""
from typing import List

INF = float('inf')

def floyd_warshall(n: int, edges: List[List[int]]) -> List[List[float]]:
    """edges = [[u, v, w], ...], n = 정점 수"""
    dist = [[INF] * n for _ in range(n)]
    for i in range(n):
        dist[i][i] = 0
    for u, v, w in edges:
        dist[u][v] = w

    for k in range(n):
        for i in range(n):
            for j in range(n):
                if dist[i][k] + dist[k][j] < dist[i][j]:
                    dist[i][j] = dist[i][k] + dist[k][j]
    return dist

if __name__ == "__main__":
    edges = [[0,1,3], [0,2,8], [1,2,2], [2,3,1], [3,0,4]]
    dist = floyd_warshall(4, edges)
    assert dist[0][0] == 0
    assert dist[0][1] == 3
    assert dist[0][2] == 5  # 0→1→2
    assert dist[0][3] == 6  # 0→1→2→3
    assert dist[3][1] == 7  # 3→0→1
    assert dist[1][3] == 3  # 1→2→3
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 073: 플로이드-워셜 알고리즘 (Floyd-Warshall Algorithm)
 *
 * [문제] 모든 정점 쌍 간의 최단 경로를 구하라.
 *
 * [아키텍트의 시선]
 * 플로이드-워셜은 "모든 쌍" 최단 경로를 구하는 DP 알고리즘이다.
 * 네트워크 토폴로지의 전체 라우팅 테이블 계산,
 * 도시 간 최소 비용 매트릭스, 서비스 간 지연시간 매트릭스 구축에 활용된다.
 *
 * [시간 복잡도] O(V^3) [공간 복잡도] O(V^2)
 */
public class P073FloydWarshall {
    static final int INF = 100000;

    public static int[][] floydWarshall(int[][] graph) {
        int n = graph.length;
        int[][] dist = new int[n][n];
        for (int i = 0; i < n; i++) {
            System.arraycopy(graph[i], 0, dist[i], 0, n);
        }

        // 경유지 k를 거치는 경로가 더 짧은지 확인
        for (int k = 0; k < n; k++) {
            for (int i = 0; i < n; i++) {
                for (int j = 0; j < n; j++) {
                    if (dist[i][k] + dist[k][j] < dist[i][j]) {
                        dist[i][j] = dist[i][k] + dist[k][j];
                    }
                }
            }
        }
        return dist;
    }

    public static void main(String[] args) {
        int[][] graph = {
            {0,   3,   INF, 5},
            {2,   0,   INF, 4},
            {INF, 1,   0,   INF},
            {INF, INF, 2,   0}
        };
        int[][] result = floydWarshall(graph);
        assert result[0][0] == 0;
        assert result[0][1] == 3;
        assert result[0][2] == 7;  // 0→3→2
        assert result[0][3] == 5;
        assert result[2][0] == 3;  // 2→1→0
        assert result[1][2] == 6;  // 1→3→2
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
