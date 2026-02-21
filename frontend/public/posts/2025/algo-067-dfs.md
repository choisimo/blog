---
title: "[알고리즘] DFS"
date: "2025-09-08"
category: "Algorithm"
tags: ["Algorithm", "깊이 탐색", "Problem Solving", "Python", "Java"]
excerpt: "Heap & Graph Basics - DFS 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**DFS**
* 파트: Heap & Graph Basics
* 관련 알고리즘: 깊이 탐색

> **Architect's View**
> 스택 기반 탐색과 속성 발견

이 글에서는 DFS 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 067: 깊이 우선 탐색 (DFS - Depth First Search)
[문제] 그래프에서 DFS를 수행하고, 재귀/반복 두 방식으로 구현하라.
[아키텍트의 시선] 스택 기반 탐색과 속성 발견.
DFS = 깊이 우선 → 경로/사이클/연결 컴포넌트 발견에 적합.
재귀(암묵적 스택) vs 반복(명시적 스택)의 트레이드오프.
실무: 파일 시스템 탐색, 가비지 컬렉션(mark), 미로 탐색.
[시간 복잡도] O(V+E) [공간 복잡도] O(V)
"""
from typing import List, Dict, Set

def dfs_recursive(graph: Dict[int, List[int]], start: int) -> List[int]:
    """재귀 DFS"""
    visited = set()
    order = []
    def _dfs(node):
        visited.add(node)
        order.append(node)
        for neighbor in sorted(graph.get(node, [])):
            if neighbor not in visited:
                _dfs(neighbor)
    _dfs(start)
    return order

def dfs_iterative(graph: Dict[int, List[int]], start: int) -> List[int]:
    """반복 DFS (명시적 스택)"""
    visited = set()
    stack = [start]
    order = []
    while stack:
        node = stack.pop()
        if node in visited:
            continue
        visited.add(node)
        order.append(node)
        # 역순으로 추가해야 정방향 탐색 순서
        for neighbor in sorted(graph.get(node, []), reverse=True):
            if neighbor not in visited:
                stack.append(neighbor)
    return order

def has_cycle(graph: Dict[int, List[int]], n: int) -> bool:
    """방향 그래프 사이클 탐지"""
    WHITE, GRAY, BLACK = 0, 1, 2
    color = [WHITE] * n
    def _dfs(u):
        color[u] = GRAY
        for v in graph.get(u, []):
            if color[v] == GRAY:
                return True
            if color[v] == WHITE and _dfs(v):
                return True
        color[u] = BLACK
        return False
    return any(color[u] == WHITE and _dfs(u) for u in range(n))

if __name__ == "__main__":
    graph = {0: [1, 2], 1: [3], 2: [3], 3: [4], 4: []}
    rec = dfs_recursive(graph, 0)
    assert rec[0] == 0
    assert set(rec) == {0, 1, 2, 3, 4}
    itr = dfs_iterative(graph, 0)
    assert set(itr) == {0, 1, 2, 3, 4}
    # 사이클 탐지
    cyclic = {0: [1], 1: [2], 2: [0]}
    assert has_cycle(cyclic, 3) == True
    acyclic = {0: [1], 1: [2], 2: []}
    assert has_cycle(acyclic, 3) == False
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 067: 깊이 우선 탐색 (Depth-First Search)
 *
 * [문제] 그래프에서 DFS를 구현하라 (재귀/반복 모두).
 * 연결 요소의 수를 세는 응용도 구현하라.
 *
 * [아키텍트의 시선]
 * DFS는 "가능한 깊이 탐색" 전략이다.
 * 파일 시스템의 재귀적 검색, 의존성 해석(npm install 순서),
 * 가비지 컬렉터의 도달 가능성 분석(Mark-and-Sweep)과 동일하다.
 *
 * [시간 복잡도] O(V + E) [공간 복잡도] O(V)
 */
import java.util.*;

public class P067DFS {
    // 재귀 DFS
    public static List<Integer> dfsRecursive(Map<Integer, List<Integer>> graph, int start) {
        List<Integer> order = new ArrayList<>();
        Set<Integer> visited = new HashSet<>();
        dfsHelper(graph, start, visited, order);
        return order;
    }

    private static void dfsHelper(Map<Integer, List<Integer>> graph, int node,
                                   Set<Integer> visited, List<Integer> order) {
        visited.add(node);
        order.add(node);
        for (int neighbor : graph.getOrDefault(node, Collections.emptyList())) {
            if (!visited.contains(neighbor)) {
                dfsHelper(graph, neighbor, visited, order);
            }
        }
    }

    // 반복 DFS (스택)
    public static List<Integer> dfsIterative(Map<Integer, List<Integer>> graph, int start) {
        List<Integer> order = new ArrayList<>();
        Set<Integer> visited = new HashSet<>();
        Stack<Integer> stack = new Stack<>();
        stack.push(start);
        while (!stack.isEmpty()) {
            int node = stack.pop();
            if (visited.contains(node)) continue;
            visited.add(node);
            order.add(node);
            List<Integer> neighbors = graph.getOrDefault(node, Collections.emptyList());
            for (int i = neighbors.size() - 1; i >= 0; i--) {
                if (!visited.contains(neighbors.get(i))) {
                    stack.push(neighbors.get(i));
                }
            }
        }
        return order;
    }

    // 연결 요소 수
    public static int countComponents(int n, Map<Integer, List<Integer>> graph) {
        Set<Integer> visited = new HashSet<>();
        int count = 0;
        for (int i = 0; i < n; i++) {
            if (!visited.contains(i)) {
                dfsHelper(graph, i, visited, new ArrayList<>());
                count++;
            }
        }
        return count;
    }

    public static void main(String[] args) {
        Map<Integer, List<Integer>> graph = new HashMap<>();
        graph.put(0, Arrays.asList(1, 2));
        graph.put(1, Arrays.asList(0, 3));
        graph.put(2, Arrays.asList(0));
        graph.put(3, Arrays.asList(1));

        List<Integer> r = dfsRecursive(graph, 0);
        assert r.size() == 4;
        assert r.get(0) == 0;

        List<Integer> ri = dfsIterative(graph, 0);
        assert ri.size() == 4;

        // 연결 요소: {0,1,2,3}, {4}
        graph.put(4, Collections.emptyList());
        assert countComponents(5, graph) == 2;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
