---
title: "[알고리즘] 경로 존재 여부"
date: "2025-10-08"
category: "Algorithm"
tags: ["Algorithm", "BFS/DFS", "Problem Solving", "Python", "Java"]
excerpt: "Graph Advanced - 경로 존재 여부 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**경로 존재 여부**
* 파트: Graph Advanced
* 관련 알고리즘: BFS/DFS

> **Architect's View**
> 도달 가능성과 서비스 가용성

이 글에서는 경로 존재 여부 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 079: 경로 존재 여부 (Find if Path Exists in Graph)
[문제] 무방향 그래프에서 source에서 destination까지의 경로가 존재하는지 판별하라.
[아키텍트의 시선] 도달 가능성과 서비스 가용성.
BFS/DFS 또는 Union-Find로 연결성 판별.
Union-Find: 오프라인 쿼리에 효율적, 동적 연결성 관리.
실무: 서비스 가용성 확인, 네트워크 연결 검증, 방화벽 규칙 분석.
[시간 복잡도] O(V+E) [공간 복잡도] O(V+E)
"""
from typing import List
from collections import deque

def valid_path_bfs(n: int, edges: List[List[int]], source: int, destination: int) -> bool:
    """BFS 방식"""
    if source == destination:
        return True
    graph = [[] for _ in range(n)]
    for u, v in edges:
        graph[u].append(v)
        graph[v].append(u)

    visited = set([source])
    queue = deque([source])
    while queue:
        node = queue.popleft()
        for neighbor in graph[node]:
            if neighbor == destination:
                return True
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    return False

def valid_path_uf(n: int, edges: List[List[int]], source: int, destination: int) -> bool:
    """Union-Find 방식"""
    parent = list(range(n))
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    def union(x, y):
        px, py = find(x), find(y)
        if px != py:
            parent[px] = py

    for u, v in edges:
        union(u, v)
    return find(source) == find(destination)

if __name__ == "__main__":
    assert valid_path_bfs(3, [[0,1],[1,2],[2,0]], 0, 2) == True
    assert valid_path_bfs(6, [[0,1],[0,2],[3,5],[5,4],[4,3]], 0, 5) == False
    assert valid_path_uf(3, [[0,1],[1,2],[2,0]], 0, 2) == True
    assert valid_path_uf(6, [[0,1],[0,2],[3,5],[5,4],[4,3]], 0, 5) == False
    assert valid_path_bfs(1, [], 0, 0) == True
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 079: 경로 존재 확인 (Path Exists in Graph)
 *
 * [문제] 무방향 그래프에서 두 노드 사이에 경로가 있는지 판별하라.
 *
 * [아키텍트의 시선]
 * 경로 존재 확인은 네트워크 연결성 테스트, 서비스 도달 가능성 검증,
 * 방화벽 규칙의 트래픽 경로 확인과 동일하다.
 * BFS/DFS/Union-Find 중 상황에 맞는 선택이 중요하다.
 *
 * [시간 복잡도] O(V + E) [공간 복잡도] O(V)
 */
import java.util.*;

public class P079PathExists {
    // Union-Find 방법
    static int[] parent;

    static int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]);
        return parent[x];
    }

    public static boolean validPath(int n, int[][] edges, int source, int destination) {
        parent = new int[n];
        for (int i = 0; i < n; i++) parent[i] = i;

        for (int[] e : edges) {
            int px = find(e[0]), py = find(e[1]);
            if (px != py) parent[px] = py;
        }
        return find(source) == find(destination);
    }

    public static void main(String[] args) {
        assert validPath(3, new int[][]{{0,1},{1,2},{2,0}}, 0, 2);
        assert !validPath(6, new int[][]{{0,1},{0,2},{3,5},{5,4},{4,3}}, 0, 5);
        assert validPath(1, new int[][]{}, 0, 0);
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
