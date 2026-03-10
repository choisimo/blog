---
title: "[알고리즘] 크루스칼 (Kruskal)"
date: "2025-09-29"
category: "Algorithm"
tags: ["Algorithm", "탐욕+Union-Find", "Problem Solving", "Python", "Java"]
excerpt: "Graph Advanced - 크루스칼 (Kruskal) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**크루스칼 (Kruskal)**
* 파트: Graph Advanced
* 관련 알고리즘: 탐욕+Union-Find

> **Architect's View**
> 간선 기반 MST

이 글에서는 크루스칼 (Kruskal) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 075: 크루스칼 알고리즘 (Kruskal's MST)
[문제] 가중 무방향 그래프에서 최소 신장 트리(MST)를 구하라.
[아키텍트의 시선] 간선 기반 탐욕 + Union-Find.
가중치 오름차순 정렬 → 사이클을 만들지 않는 간선만 선택.
Union-Find로 사이클 판별 O(alpha(n)) ≈ O(1).
실무: 네트워크 케이블 최소 비용, 클러스터링, 전력망 설계.
[시간 복잡도] O(E log E) [공간 복잡도] O(V+E)
"""
from typing import List, Tuple

class UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x: int) -> int:
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # 경로 압축
        return self.parent[x]

    def union(self, x: int, y: int) -> bool:
        px, py = self.find(x), self.find(y)
        if px == py:
            return False  # 이미 같은 집합
        if self.rank[px] < self.rank[py]:
            px, py = py, px
        self.parent[py] = px
        if self.rank[px] == self.rank[py]:
            self.rank[px] += 1
        return True

def kruskal(n: int, edges: List[Tuple[int, int, int]]) -> Tuple[int, List[Tuple[int, int, int]]]:
    """n=정점 수, edges=[(u, v, w), ...] → (총 비용, MST 간선들)"""
    edges_sorted = sorted(edges, key=lambda e: e[2])
    uf = UnionFind(n)
    mst = []
    total_cost = 0

    for u, v, w in edges_sorted:
        if uf.union(u, v):
            mst.append((u, v, w))
            total_cost += w
            if len(mst) == n - 1:
                break

    return total_cost, mst

if __name__ == "__main__":
    # 0-1(4), 0-2(1), 1-2(2), 1-3(5), 2-3(3)
    edges = [(0,1,4), (0,2,1), (1,2,2), (1,3,5), (2,3,3)]
    cost, mst = kruskal(4, edges)
    assert cost == 6  # 0-2(1) + 1-2(2) + 2-3(3)
    assert len(mst) == 3
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 075: 크루스칼 MST (Kruskal's Minimum Spanning Tree)
 *
 * [문제] 가중치 무방향 그래프의 최소 신장 트리를 크루스칼 알고리즘으로 구하라.
 *
 * [아키텍트의 시선]
 * MST는 네트워크 케이블 배선 최적화, 클러스터링(single-linkage),
 * 도로망/통신망 최소 비용 설계의 핵심이다.
 * 크루스칼 = 간선 정렬 + Union-Find = 탐욕법의 정당성이 증명된 경우.
 *
 * [시간 복잡도] O(E log E) [공간 복잡도] O(V)
 */
import java.util.*;

public class P075Kruskal {
    static int[] parent, rank;

    static int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]); // 경로 압축
        return parent[x];
    }

    static boolean union(int x, int y) {
        int px = find(x), py = find(y);
        if (px == py) return false; // 이미 같은 집합
        if (rank[px] < rank[py]) { int t = px; px = py; py = t; }
        parent[py] = px;
        if (rank[px] == rank[py]) rank[px]++;
        return true;
    }

    public static int kruskalMST(int n, int[][] edges) {
        parent = new int[n]; rank = new int[n];
        for (int i = 0; i < n; i++) parent[i] = i;

        // 가중치 기준 정렬
        Arrays.sort(edges, (a, b) -> a[2] - b[2]);

        int totalWeight = 0, edgeCount = 0;
        for (int[] edge : edges) {
            if (union(edge[0], edge[1])) {
                totalWeight += edge[2];
                edgeCount++;
                if (edgeCount == n - 1) break;
            }
        }
        return totalWeight;
    }

    public static void main(String[] args) {
        // 0--1(4), 0--2(1), 1--2(2), 1--3(5), 2--3(8), 3--4(3)
        int[][] edges = {{0,1,4},{0,2,1},{1,2,2},{1,3,5},{2,3,8},{3,4,3}};
        assert kruskalMST(5, edges) == 11; // 0-2(1) + 1-2(2) + 3-4(3) + 1-3(5)
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
