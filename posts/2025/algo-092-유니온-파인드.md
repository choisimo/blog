---
title: "[알고리즘] 유니온 파인드"
date: "2025-11-10"
category: "Algorithm"
tags: ["Algorithm", "경로 압축+랭크", "Problem Solving", "Python", "Java"]
excerpt: "Advanced Topics - 유니온 파인드 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**유니온 파인드**
* 파트: Advanced Topics
* 관련 알고리즘: 경로 압축+랭크

> **Architect's View**
> 동적 연결성 관리

이 글에서는 유니온 파인드 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 092: 유니온 파인드 (Union-Find / Disjoint Set)
[문제] Union-Find를 경로 압축과 랭크 최적화로 구현하라.
[아키텍트의 시선] 동적 연결성 관리.
find: 경로 압축으로 amortized O(alpha(n)) ≈ O(1).
union: 랭크/크기 기반 합치기로 트리 균형 유지.
실무: 네트워크 연결 관리, 이미지 영역 병합, 크루스칼 MST, 소셜 그룹.
[시간 복잡도] O(alpha(n)) per operation [공간 복잡도] O(n)
"""

class UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))
        self.rank = [0] * n
        self.size = [1] * n
        self.count = n  # 집합 수

    def find(self, x: int) -> int:
        """경로 압축"""
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x: int, y: int) -> bool:
        """랭크 기반 합치기. 이미 같은 집합이면 False."""
        px, py = self.find(x), self.find(y)
        if px == py:
            return False
        if self.rank[px] < self.rank[py]:
            px, py = py, px
        self.parent[py] = px
        self.size[px] += self.size[py]
        if self.rank[px] == self.rank[py]:
            self.rank[px] += 1
        self.count -= 1
        return True

    def connected(self, x: int, y: int) -> bool:
        return self.find(x) == self.find(y)

    def get_size(self, x: int) -> int:
        return self.size[self.find(x)]

if __name__ == "__main__":
    uf = UnionFind(6)
    assert uf.count == 6
    uf.union(0, 1)
    uf.union(2, 3)
    assert uf.connected(0, 1) == True
    assert uf.connected(0, 2) == False
    assert uf.count == 4
    uf.union(1, 3)
    assert uf.connected(0, 3) == True
    assert uf.count == 3
    assert uf.get_size(0) == 4
    assert uf.union(0, 1) == False  # 이미 연결됨
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 092: 유니온 파인드 (Union-Find / Disjoint Set)
 *
 * [문제] Union-Find를 경로 압축과 랭크 최적화로 구현하라.
 *
 * [아키텍트의 시선]
 * 동적 연결성 관리.
 * find: 경로 압축으로 amortized O(alpha(n)) ~ O(1).
 * union: 랭크/크기 기반 합치기로 트리 균형 유지.
 * 실무: 네트워크 연결 관리, 이미지 영역 병합, 크루스칼 MST, 소셜 그룹.
 *
 * [시간 복잡도] O(alpha(n)) per operation [공간 복잡도] O(n)
 */

public class P092UnionFind {
    private int[] parent;
    private int[] rank;
    private int[] size;
    private int count; // 집합 수

    public P092UnionFind(int n) {
        parent = new int[n];
        rank = new int[n];
        size = new int[n];
        count = n;
        for (int i = 0; i < n; i++) {
            parent[i] = i;
            size[i] = 1;
        }
    }

    // 경로 압축
    public int find(int x) {
        if (parent[x] != x) {
            parent[x] = find(parent[x]);
        }
        return parent[x];
    }

    // 랭크 기반 합치기. 이미 같은 집합이면 false.
    public boolean union(int x, int y) {
        int px = find(x), py = find(y);
        if (px == py) return false;
        if (rank[px] < rank[py]) { int tmp = px; px = py; py = tmp; }
        parent[py] = px;
        size[px] += size[py];
        if (rank[px] == rank[py]) rank[px]++;
        count--;
        return true;
    }

    public boolean connected(int x, int y) { return find(x) == find(y); }
    public int getSize(int x) { return size[find(x)]; }
    public int getCount() { return count; }

    public static void main(String[] args) {
        P092UnionFind uf = new P092UnionFind(6);
        assert uf.getCount() == 6;
        uf.union(0, 1);
        uf.union(2, 3);
        assert uf.connected(0, 1) == true;
        assert uf.connected(0, 2) == false;
        assert uf.getCount() == 4;
        uf.union(1, 3);
        assert uf.connected(0, 3) == true;
        assert uf.getCount() == 3;
        assert uf.getSize(0) == 4;
        assert uf.union(0, 1) == false; // 이미 연결됨
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
