---
title: "[알고리즘] BFS"
date: "2025-09-05"
category: "Algorithm"
tags: ["Algorithm", "레벨 탐색", "Problem Solving", "Python", "Java"]
excerpt: "Heap & Graph Basics - BFS 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

BFS는 단순 방문이 아니라, frontier를 레벨 단위로 넓혀 가며 unweighted graph의 최단 홉 수를 보장하는 탐색입니다. 큐가 왜 "다음 물결 wavefront"를 표현한다고 볼 수 있는지 설명해 보세요.

1. 시작 정점에서 레벨이 어떻게 확장되는지, 큐와 visited 집합 상태를 추적하세요.
2. DFS와 비교해 왜 BFS만이 unweighted 최단 경로를 보장하는지 설명하세요.
3. frontier가 폭발적으로 커지는 그래프에서 메모리 병목이 왜 생기고, bidirectional BFS가 어떤 완화를 주는지 설명하세요.

## 답변할 때 포함할 것

- 레벨 개념을 명시할 것
- 큐의 순서가 왜 중요한지 설명할 것
- 공간 복잡도 병목을 적을 것

## 🐍 Python 구현

```python
"""
문제 066: 너비 우선 탐색 (BFS - Breadth First Search)
[문제] 그래프에서 시작 정점으로부터 BFS를 수행하고, 최단 거리를 구하라.
[아키텍트의 시선] 계층적 탐색과 최단 경로.
BFS = 레벨별 탐색. 가중치 없는 그래프에서 최단 경로 보장.
큐 기반 → FIFO 순서가 '가까운 것 먼저' 보장.
실무: 소셜 네트워크 촌수, 네트워크 홉 수, 최단 경로 라우팅.
[시간 복잡도] O(V+E) [공간 복잡도] O(V)
"""

from typing import List, Dict, Set
from collections import deque, defaultdict


def bfs(graph: Dict[int, List[int]], start: int) -> List[int]:
    """BFS 순회 순서 반환"""
    visited = set([start])
    queue = deque([start])
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in sorted(graph.get(node, [])):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    return order


def bfs_shortest_distance(graph: Dict[int, List[int]], start: int) -> Dict[int, int]:
    """시작점에서 각 노드까지의 최단 거리"""
    dist = {start: 0}
    queue = deque([start])
    while queue:
        node = queue.popleft()
        for neighbor in graph.get(node, []):
            if neighbor not in dist:
                dist[neighbor] = dist[node] + 1
                queue.append(neighbor)
    return dist


if __name__ == "__main__":
    graph = {0: [1, 2], 1: [0, 3, 4], 2: [0, 4], 3: [1, 5], 4: [1, 2, 5], 5: [3, 4]}
    order = bfs(graph, 0)
    assert order[0] == 0
    assert set(order) == {0, 1, 2, 3, 4, 5}
    dist = bfs_shortest_distance(graph, 0)
    assert dist[0] == 0
    assert dist[1] == 1
    assert dist[3] == 2
    assert dist[5] == 3
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 066: 너비 우선 탐색 (Breadth-First Search)
 *
 * [문제] 그래프에서 BFS를 구현하고, 최단 경로(무가중치)를 찾아라.
 *
 * [아키텍트의 시선]
 * BFS는 "최소 홉 수" 경로를 찾는 알고리즘이다.
 * 소셜 네트워크의 N-degree 연결, 네트워크 라우팅의 최소 홉,
 * 웹 크롤러의 레벨별 탐색과 동일한 패턴이다.
 *
 * [시간 복잡도] O(V + E) [공간 복잡도] O(V)
 */
import java.util.*;

public class P066BFS {
    public static List<Integer> bfs(Map<Integer, List<Integer>> graph, int start) {
        List<Integer> order = new ArrayList<>();
        Set<Integer> visited = new HashSet<>();
        Queue<Integer> queue = new LinkedList<>();
        visited.add(start);
        queue.offer(start);
        while (!queue.isEmpty()) {
            int node = queue.poll();
            order.add(node);
            for (int neighbor : graph.getOrDefault(node, Collections.emptyList())) {
                if (!visited.contains(neighbor)) {
                    visited.add(neighbor);
                    queue.offer(neighbor);
                }
            }
        }
        return order;
    }

    // 최단 경로 (무가중치)
    public static int shortestPath(Map<Integer, List<Integer>> graph, int start, int end) {
        if (start == end) return 0;
        Set<Integer> visited = new HashSet<>();
        Queue<int[]> queue = new LinkedList<>(); // {node, distance}
        visited.add(start);
        queue.offer(new int[]{start, 0});
        while (!queue.isEmpty()) {
            int[] curr = queue.poll();
            for (int neighbor : graph.getOrDefault(curr[0], Collections.emptyList())) {
                if (neighbor == end) return curr[1] + 1;
                if (!visited.contains(neighbor)) {
                    visited.add(neighbor);
                    queue.offer(new int[]{neighbor, curr[1] + 1});
                }
            }
        }
        return -1;
    }

    public static void main(String[] args) {
        Map<Integer, List<Integer>> graph = new HashMap<>();
        graph.put(0, Arrays.asList(1, 2));
        graph.put(1, Arrays.asList(0, 3));
        graph.put(2, Arrays.asList(0, 3));
        graph.put(3, Arrays.asList(1, 2, 4));
        graph.put(4, Arrays.asList(3));

        List<Integer> order = bfs(graph, 0);
        assert order.get(0) == 0;
        assert order.size() == 5;

        assert shortestPath(graph, 0, 4) == 3;
        assert shortestPath(graph, 0, 0) == 0;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
