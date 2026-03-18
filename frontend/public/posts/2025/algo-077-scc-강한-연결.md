---
title: "[알고리즘] SCC (강한 연결)"
date: "2025-10-03"
category: "Algorithm"
tags: ["Algorithm", "타잔/코사라주", "Problem Solving", "Python", "Java"]
excerpt: "Graph Advanced - SCC (강한 연결) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

SCC는 cycle 하나를 찾는 문제가 아니라, 서로 도달 가능한 정점들의 최대 묶음을 압축해 시스템의 순환 구조를 드러내는 문제입니다. 왜 SCC 축약 그래프는 DAG가 되는지 설명해 보세요.

1. Tarjan의 index/low-link 혹은 Kosaraju의 역방향 그래프 순서가 무엇을 의미하는지 추적하세요.
2. 단순 cycle detection과 SCC 분해가 제공하는 정보의 차이를 설명하세요.
3. 모듈 의존성, 서비스 호출 순환, deadlock 분석에서 SCC가 왜 중요한지 설명하세요.

## 답변할 때 포함할 것

- low-link 또는 finishing order의 의미를 적을 것
- SCC 압축 결과가 DAG가 되는 이유를 설명할 것
- cycle 발견과 component 분해를 구분할 것

## 🐍 Python 구현

```python
"""
문제 077: 강한 연결 요소 (Strongly Connected Components)
[문제] 방향 그래프에서 모든 강한 연결 요소(SCC)를 찾아라.
[아키텍트의 시선] 시스템 순환 의존성 탐지.
코사라주: 1차 DFS(완료 순서 기록) → 역방향 그래프 → 2차 DFS(SCC 추출).
타잔: 단일 DFS + 스택으로 SCC 추출 (더 효율적).
실무: 순환 의존성 탐지, 모듈 분석, 데드락 탐지.
[시간 복잡도] O(V+E) [공간 복잡도] O(V+E)
"""
from typing import List, Dict
from collections import defaultdict

def kosaraju_scc(n: int, edges: List[List[int]]) -> List[List[int]]:
    """코사라주 알고리즘"""
    graph = defaultdict(list)
    reverse_graph = defaultdict(list)
    for u, v in edges:
        graph[u].append(v)
        reverse_graph[v].append(u)

    # 1단계: 원본 그래프에서 DFS, 완료 순서 기록
    visited = set()
    finish_order = []
    def dfs1(node):
        visited.add(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                dfs1(neighbor)
        finish_order.append(node)

    for i in range(n):
        if i not in visited:
            dfs1(i)

    # 2단계: 역방향 그래프에서 완료 역순 DFS → SCC
    visited.clear()
    sccs = []
    def dfs2(node, component):
        visited.add(node)
        component.append(node)
        for neighbor in reverse_graph[node]:
            if neighbor not in visited:
                dfs2(neighbor, component)

    for node in reversed(finish_order):
        if node not in visited:
            component = []
            dfs2(node, component)
            sccs.append(sorted(component))

    return sccs

if __name__ == "__main__":
    # 0→1→2→0 (SCC: {0,1,2}), 2→3, 3→4→3 (SCC: {3,4})
    edges = [[0,1],[1,2],[2,0],[2,3],[3,4],[4,3]]
    sccs = kosaraju_scc(5, edges)
    scc_sets = [set(s) for s in sccs]
    assert {0,1,2} in scc_sets
    assert {3,4} in scc_sets
    # DAG (각 노드가 자체 SCC)
    dag_edges = [[0,1],[1,2]]
    dag_sccs = kosaraju_scc(3, dag_edges)
    assert len(dag_sccs) == 3
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 077: 강한 연결 요소 (Strongly Connected Components — Kosaraju)
 *
 * [문제] 방향 그래프에서 강한 연결 요소(SCC)를 찾아라.
 *
 * [아키텍트의 시선]
 * SCC는 시스템의 순환 의존성 그룹을 식별한다.
 * 마이크로서비스의 순환 호출 그룹, 데이터베이스 테이블의 순환 FK,
 * 패키지 의존성의 순환 그룹 감지에 핵심이다.
 * SCC 내부는 모두 상호 도달 가능 → 하나의 모듈로 응집해야 한다.
 *
 * [시간 복잡도] O(V + E) [공간 복잡도] O(V)
 */
import java.util.*;

public class P077SCC {
    @SuppressWarnings("unchecked")
    public static List<List<Integer>> kosaraju(int n, int[][] edges) {
        // 1. 원본 그래프 구축
        List<Integer>[] graph = new List[n];
        List<Integer>[] reverse = new List[n];
        for (int i = 0; i < n; i++) { graph[i] = new ArrayList<>(); reverse[i] = new ArrayList<>(); }
        for (int[] e : edges) {
            graph[e[0]].add(e[1]);
            reverse[e[1]].add(e[0]);
        }

        // 2. 첫 번째 DFS: 종료 순서 기록
        boolean[] visited = new boolean[n];
        Deque<Integer> stack = new ArrayDeque<>();
        for (int i = 0; i < n; i++) {
            if (!visited[i]) dfs1(graph, i, visited, stack);
        }

        // 3. 역방향 그래프에서 DFS: SCC 추출
        visited = new boolean[n];
        List<List<Integer>> sccs = new ArrayList<>();
        while (!stack.isEmpty()) {
            int node = stack.pop();
            if (!visited[node]) {
                List<Integer> scc = new ArrayList<>();
                dfs2(reverse, node, visited, scc);
                sccs.add(scc);
            }
        }
        return sccs;
    }

    private static void dfs1(List<Integer>[] graph, int node, boolean[] visited, Deque<Integer> stack) {
        visited[node] = true;
        for (int next : graph[node]) {
            if (!visited[next]) dfs1(graph, next, visited, stack);
        }
        stack.push(node);
    }

    private static void dfs2(List<Integer>[] reverse, int node, boolean[] visited, List<Integer> scc) {
        visited[node] = true;
        scc.add(node);
        for (int next : reverse[node]) {
            if (!visited[next]) dfs2(reverse, next, visited, scc);
        }
    }

    public static void main(String[] args) {
        // 0→1→2→0 (SCC), 1→3→4→3 (SCC {3,4})
        int[][] edges = {{0,1},{1,2},{2,0},{1,3},{3,4},{4,3}};
        List<List<Integer>> sccs = kosaraju(5, edges);
        assert sccs.size() == 2;
        // 각 SCC를 정렬해서 확인
        Set<Set<Integer>> sccSets = new HashSet<>();
        for (List<Integer> scc : sccs) sccSets.add(new HashSet<>(scc));
        assert sccSets.contains(new HashSet<>(Arrays.asList(0, 1, 2)));
        assert sccSets.contains(new HashSet<>(Arrays.asList(3, 4)));
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
