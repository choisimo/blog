---
title: "[알고리즘] 이진 그래프 (Bipartite)"
date: "2025-09-11"
category: "Algorithm"
tags: ["Algorithm", "2-색칠", "Problem Solving", "Python", "Java"]
excerpt: "Heap & Graph Basics - 이진 그래프 (Bipartite) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

이분 그래프 판별은 그래프를 두 집합으로 나누는 문제가 아니라, 인접한 두 정점이 항상 반대 상태를 가져야 한다는 parity 제약이 전체 그래프에서 모순 없이 유지되는지 검증하는 문제입니다. 2-coloring을 parity propagation으로 설명해 보세요.

1. BFS/DFS로 색을 퍼뜨릴 때 현재 정점과 이웃 정점의 색 제약이 어떻게 전파되는지 추적하세요.
2. 홀수 길이 cycle이 왜 정확히 bipartite를 깨는 구조인지 설명하세요.
3. 이진 분할이 매칭 문제, 스케줄링, 충돌 그래프와 어떻게 연결되는지 설명하세요.

## 답변할 때 포함할 것

- 색 전파 상태를 적을 것
- 모순이 발생하는 조건을 설명할 것
- 홀수 cycle과의 관계를 적을 것

## 🐍 Python 구현

```python
"""
문제 068: 이분 그래프 판별 (Is Graph Bipartite)
[문제] 주어진 그래프가 이분 그래프인지 판별하라.
[아키텍트의 시선] 그래프 색칠(Coloring)과 분류.
2-색칠 가능 여부 = 이분 그래프. BFS/DFS로 인접 노드를 번갈아 색칠.
같은 색의 인접 노드 발견 시 이분 그래프 아님.
실무: 매칭 문제(구직-구인), 충돌 탐지, 스케줄링 호환성.
[시간 복잡도] O(V+E) [공간 복잡도] O(V)
"""
from typing import List
from collections import deque

def is_bipartite(graph: List[List[int]]) -> bool:
    """BFS 기반 2-색칠"""
    n = len(graph)
    color = [-1] * n  # -1: 미방문
    for start in range(n):
        if color[start] != -1:
            continue
        queue = deque([start])
        color[start] = 0
        while queue:
            node = queue.popleft()
            for neighbor in graph[node]:
                if color[neighbor] == -1:
                    color[neighbor] = 1 - color[node]
                    queue.append(neighbor)
                elif color[neighbor] == color[node]:
                    return False
    return True

if __name__ == "__main__":
    # 이분 그래프: 0-1, 0-3, 1-2, 2-3 (사각형)
    assert is_bipartite([[1,3],[0,2],[1,3],[0,2]]) == True
    # 비이분 그래프: 0-1-2-0 (삼각형, 홀수 사이클)
    assert is_bipartite([[1,2,3],[0,2],[0,1,3],[0,2]]) == False
    # 단절된 그래프
    assert is_bipartite([[1],[0],[3],[2]]) == True
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 068: 이분 그래프 판별 (Is Graph Bipartite)
 *
 * [문제] 그래프가 이분 그래프(두 그룹으로 나눌 수 있는)인지 판별하라.
 *
 * [아키텍트의 시선]
 * 이분 그래프 판별은 시스템의 "두 역할 분리 가능성" 검증이다.
 * 클라이언트-서버 분리, 읽기/쓰기 분리(CQRS), 매칭 문제(구직-채용)의
 * 기초 조건 확인과 동일한 패턴이다.
 *
 * [시간 복잡도] O(V + E) [공간 복잡도] O(V)
 */
import java.util.*;

public class P068Bipartite {
    public static boolean isBipartite(int[][] graph) {
        int n = graph.length;
        int[] color = new int[n]; // 0: 미색칠, 1/-1: 두 색
        Arrays.fill(color, 0);

        for (int i = 0; i < n; i++) {
            if (color[i] != 0) continue;
            // BFS로 색칠
            Queue<Integer> queue = new LinkedList<>();
            queue.offer(i);
            color[i] = 1;
            while (!queue.isEmpty()) {
                int node = queue.poll();
                for (int neighbor : graph[node]) {
                    if (color[neighbor] == 0) {
                        color[neighbor] = -color[node];
                        queue.offer(neighbor);
                    } else if (color[neighbor] == color[node]) {
                        return false; // 같은 색 인접 → 이분 그래프 아님
                    }
                }
            }
        }
        return true;
    }

    public static void main(String[] args) {
        assert isBipartite(new int[][]{{1,3},{0,2},{1,3},{0,2}});
        assert !isBipartite(new int[][]{{1,2,3},{0,2},{0,1,3},{0,2}});
        assert isBipartite(new int[][]{{}}); // 단일 노드
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
