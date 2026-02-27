---
title: "[알고리즘] K 경유 최소 비용"
date: "2025-10-10"
category: "Algorithm"
tags: ["Algorithm", "BFS+DP", "Problem Solving", "Python", "Java"]
excerpt: "Graph Advanced - K 경유 최소 비용 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**K 경유 최소 비용**
* 파트: Graph Advanced
* 관련 알고리즘: BFS+DP

> **Architect's View**
> 제약 조건부 멀티홉 라우팅

이 글에서는 K 경유 최소 비용 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 080: K 경유 최소 비용 항공편 (Cheapest Flights Within K Stops)
[문제] n개 도시, flights[i]=[from, to, price]. src에서 dst까지
       최대 K번 경유하여 갈 수 있는 최소 비용을 구하라.
[아키텍트의 시선] 제약 조건부 멀티홉 라우팅.
벨만-포드 변형: K+1회만 완화. 각 라운드에서 이전 라운드 결과만 사용.
또는 BFS + 레벨 제한. 다익스트라는 K 제한이 어려움.
실무: 네트워크 홉 제한 라우팅, TTL 기반 패킷 전달, CDN 경유 수 제한.
[시간 복잡도] O(K*E) [공간 복잡도] O(V)
"""
from typing import List

def find_cheapest_price(n: int, flights: List[List[int]], src: int, dst: int, k: int) -> int:
    """벨만-포드 변형: K+1회 완화"""
    INF = float('inf')
    dist = [INF] * n
    dist[src] = 0

    for _ in range(k + 1):
        temp = dist[:]  # 이전 라운드 결과 복사 (핵심!)
        for u, v, w in flights:
            if dist[u] != INF and dist[u] + w < temp[v]:
                temp[v] = dist[u] + w
        dist = temp

    return dist[dst] if dist[dst] != INF else -1

if __name__ == "__main__":
    flights = [[0,1,100],[1,2,100],[0,2,500]]
    assert find_cheapest_price(3, flights, 0, 2, 1) == 200  # 0→1→2
    assert find_cheapest_price(3, flights, 0, 2, 0) == 500  # 직항만
    flights2 = [[0,1,1],[0,2,5],[1,2,1],[2,3,1]]
    assert find_cheapest_price(4, flights2, 0, 3, 1) == 6  # 0→2→3
    assert find_cheapest_price(4, flights2, 0, 3, 2) == 3  # 0→1→2→3
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 080: K번 이내 환승 최저가 항공편 (Cheapest Flights Within K Stops)
 *
 * [문제] n개 도시와 항공편이 주어질 때, 최대 K번 환승으로
 * src에서 dst까지의 최저 비용을 구하라. 불가능하면 -1.
 *
 * [아키텍트의 시선]
 * 제약 있는 최단 경로는 SLA 제한 내 최적 경로,
 * TTL 제한 네트워크 라우팅, 예산 제한 서비스 호출 체인과 동일하다.
 * 벨만-포드 변형으로 "K+1 라운드만 실행"하면 된다.
 *
 * [시간 복잡도] O(K * E) [공간 복잡도] O(V)
 */
import java.util.*;

public class P080CheapestFlights {
    public static int findCheapestPrice(int n, int[][] flights, int src, int dst, int k) {
        int[] dist = new int[n];
        Arrays.fill(dist, Integer.MAX_VALUE);
        dist[src] = 0;

        // K+1번 반복 (환승 K번 = 간선 K+1개)
        for (int i = 0; i <= k; i++) {
            int[] temp = Arrays.copyOf(dist, n); // 이전 라운드의 값 보존
            for (int[] f : flights) {
                int u = f[0], v = f[1], w = f[2];
                if (dist[u] != Integer.MAX_VALUE && dist[u] + w < temp[v]) {
                    temp[v] = dist[u] + w;
                }
            }
            dist = temp;
        }
        return dist[dst] == Integer.MAX_VALUE ? -1 : dist[dst];
    }

    public static void main(String[] args) {
        int[][] flights = {{0,1,100},{1,2,100},{0,2,500}};
        assert findCheapestPrice(3, flights, 0, 2, 1) == 200;
        assert findCheapestPrice(3, flights, 0, 2, 0) == 500;

        int[][] flights2 = {{0,1,1},{1,2,1},{2,3,1}};
        assert findCheapestPrice(4, flights2, 0, 3, 1) == -1;
        assert findCheapestPrice(4, flights2, 0, 3, 2) == 3;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
