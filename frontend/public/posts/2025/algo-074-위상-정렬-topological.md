---
title: "[알고리즘] 위상 정렬 (Topological)"
date: "2025-09-26"
category: "Algorithm"
tags: ["Algorithm", "Kahn's/DFS", "Problem Solving", "Python", "Java"]
excerpt: "Graph Advanced - 위상 정렬 (Topological) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
published: false
---

## Top-down 질문

위상 정렬은 순서를 정하는 문제가 아니라, 선행 의존성을 깨지 않는 실행 순서를 만드는 스케줄링 문제입니다. indegree가 0인 노드가 왜 지금 당장 실행 가능한 작업 집합을 의미하는지 설명해 보세요.

1. Kahn 방식에서 indegree 테이블과 큐 상태가 어떻게 변하는지 추적하세요.
2. DFS 후위 순서 방식과 Kahn 방식을 cycle 검출 시점, 스트리밍 적합성, 구현 위험 관점에서 비교하세요.
3. 실제 빌드 시스템이나 워크플로 오케스트레이션에서 partial order가 왜 전체 순서보다 본질적인지 설명하세요.

## 답변할 때 포함할 것

- indegree 감소 과정을 적을 것
- cycle이 있으면 왜 모든 노드를 꺼낼 수 없는지 설명할 것
- 의존성 해소 관점으로 문제를 재정의할 것

## 🐍 Python 구현

```python
"""
문제 074: 위상 정렬 (Topological Sort)
[문제] DAG(방향 비순환 그래프)의 위상 정렬 결과를 구하라.
[아키텍트의 시선] 의존성 해결과 스케줄링.
Kahn's: 진입 차수 0인 노드부터 처리 → 의존성이 해결된 순서.
DFS: 후위 순회의 역순 = 위상 정렬.
실무: 빌드 시스템(Make), 패키지 매니저(npm), 과목 선수 체계, CI/CD 파이프라인.
[시간 복잡도] O(V+E) [공간 복잡도] O(V+E)
"""
from typing import List, Dict
from collections import deque, defaultdict

def topological_sort_kahn(n: int, edges: List[List[int]]) -> List[int]:
    """Kahn's 알고리즘 (BFS 기반)"""
    graph = defaultdict(list)
    in_degree = [0] * n
    for u, v in edges:
        graph[u].append(v)
        in_degree[v] += 1

    queue = deque([i for i in range(n) if in_degree[i] == 0])
    result = []

    while queue:
        node = queue.popleft()
        result.append(node)
        for neighbor in graph[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    return result if len(result) == n else []  # 빈 리스트 = 사이클 존재

def topological_sort_dfs(n: int, edges: List[List[int]]) -> List[int]:
    """DFS 기반 위상 정렬"""
    graph = defaultdict(list)
    for u, v in edges:
        graph[u].append(v)

    visited = set()
    stack = []

    def dfs(node):
        visited.add(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                dfs(neighbor)
        stack.append(node)

    for i in range(n):
        if i not in visited:
            dfs(i)

    return stack[::-1]

if __name__ == "__main__":
    # 0 → 1 → 3
    # 0 → 2 → 3
    edges = [[0,1], [0,2], [1,3], [2,3]]
    kahn = topological_sort_kahn(4, edges)
    assert len(kahn) == 4
    assert kahn.index(0) < kahn.index(1)
    assert kahn.index(0) < kahn.index(2)
    assert kahn.index(1) < kahn.index(3)
    dfs_result = topological_sort_dfs(4, edges)
    assert len(dfs_result) == 4
    assert dfs_result.index(0) < dfs_result.index(3)
    # 사이클 탐지
    cyclic = [[0,1], [1,2], [2,0]]
    assert topological_sort_kahn(3, cyclic) == []
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 074: 위상 정렬 (Topological Sort)
 *
 * [문제] DAG(방향 비순환 그래프)의 위상 정렬을 구하라.
 * Kahn 알고리즘(BFS 기반)과 DFS 기반 모두 구현.
 *
 * [아키텍트의 시선]
 * 위상 정렬은 빌드 시스템(Make, Gradle), 패키지 의존성 해석(npm),
 * 워크플로우 실행 순서(Airflow DAG), 데이터 파이프라인 스케줄링의 핵심이다.
 * "의존하는 것이 먼저" = 선행 조건 만족 후 실행.
 *
 * [시간 복잡도] O(V + E) [공간 복잡도] O(V)
 */
import java.util.*;

public class P074TopologicalSort {
    // Kahn 알고리즘 (BFS + 진입차수)
    @SuppressWarnings("unchecked")
    public static List<Integer> kahnSort(int n, int[][] edges) {
        List<Integer>[] graph = new List[n];
        int[] inDegree = new int[n];
        for (int i = 0; i < n; i++) graph[i] = new ArrayList<>();
        for (int[] e : edges) {
            graph[e[0]].add(e[1]);
            inDegree[e[1]]++;
        }

        Queue<Integer> queue = new LinkedList<>();
        for (int i = 0; i < n; i++) {
            if (inDegree[i] == 0) queue.offer(i);
        }

        List<Integer> result = new ArrayList<>();
        while (!queue.isEmpty()) {
            int node = queue.poll();
            result.add(node);
            for (int neighbor : graph[node]) {
                inDegree[neighbor]--;
                if (inDegree[neighbor] == 0) queue.offer(neighbor);
            }
        }
        return result.size() == n ? result : Collections.emptyList(); // 사이클 감지
    }

    public static void main(String[] args) {
        // 0 → 1 → 3
        // 0 → 2 → 3
        int[][] edges = {{0,1},{0,2},{1,3},{2,3}};
        List<Integer> result = kahnSort(4, edges);
        assert result.size() == 4;
        assert result.indexOf(0) < result.indexOf(1);
        assert result.indexOf(0) < result.indexOf(2);
        assert result.indexOf(1) < result.indexOf(3);
        assert result.indexOf(2) < result.indexOf(3);

        // 사이클 감지
        int[][] cyclic = {{0,1},{1,2},{2,0}};
        assert kahnSort(3, cyclic).isEmpty();
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
