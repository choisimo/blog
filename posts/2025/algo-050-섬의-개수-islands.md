---
title: "[알고리즘] 섬의 개수 (Islands)"
date: "2025-07-26"
category: "Algorithm"
tags: ["Algorithm", "플러드 필", "Problem Solving", "Python", "Java"]
excerpt: "Recursion & Backtracking - 섬의 개수 (Islands) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**섬의 개수 (Islands)**
* 파트: Recursion & Backtracking
* 관련 알고리즘: 플러드 필

> **Architect's View**
> 연결 컴포넌트 분석

이 글에서는 섬의 개수 (Islands) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 050: 섬의 개수 (Number of Islands)
[문제] 2D 그리드에서 '1'로 연결된 섬의 개수를 구하라.
[아키텍트의 시선] 플러드 필(Flood Fill)과 연결 컴포넌트 분석.
DFS/BFS로 연결된 육지를 모두 방문 표시 → 새 섬 발견 시 카운트+1.
실무: 이미지 영역 탐지, 네트워크 클러스터 분석, 소셜 그래프 커뮤니티.
[시간 복잡도] O(m*n) [공간 복잡도] O(m*n) 최악
"""
from typing import List

def num_islands(grid: List[List[str]]) -> int:
    if not grid:
        return 0
    m, n = len(grid), len(grid[0])
    count = 0

    def dfs(r, c):
        if r < 0 or r >= m or c < 0 or c >= n or grid[r][c] != "1":
            return
        grid[r][c] = "0"
        dfs(r+1, c); dfs(r-1, c); dfs(r, c+1); dfs(r, c-1)

    for r in range(m):
        for c in range(n):
            if grid[r][c] == "1":
                count += 1
                dfs(r, c)
    return count

if __name__ == "__main__":
    g1 = [["1","1","1","1","0"],["1","1","0","1","0"],["1","1","0","0","0"],["0","0","0","0","0"]]
    assert num_islands(g1) == 1
    g2 = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]
    assert num_islands(g2) == 3
    print("✓ 모든 테스트 통과!")
```

## ☕ Java 구현

```java
/**
 * 문제 050: 섬의 개수 (Number of Islands)
 *
 * [문제] '1'(육지)과 '0'(물)로 이루어진 2D 격자에서 섬의 개수를 구하라.
 * 상하좌우로 연결된 '1'은 하나의 섬이다.
 *
 * [아키텍트의 시선]
 * 연결 요소(Connected Component) 탐색은 네트워크 토폴로지에서
 * 독립 클러스터 식별, 소셜 네트워크의 커뮤니티 탐지,
 * 마이크로서비스 의존성 그래프의 독립 그룹 발견과 동일하다.
 * DFS/BFS/Union-Find 모두 적용 가능한 다면적 문제다.
 *
 * [시간 복잡도] O(m * n) [공간 복잡도] O(m * n) 최악 재귀 스택
 */
public class P050NumberOfIslands {
    public static int numIslands(char[][] grid) {
        if (grid == null || grid.length == 0) return 0;
        int m = grid.length, n = grid[0].length;
        int count = 0;

        for (int i = 0; i < m; i++) {
            for (int j = 0; j < n; j++) {
                if (grid[i][j] == '1') {
                    count++;
                    dfs(grid, i, j, m, n);
                }
            }
        }
        return count;
    }

    private static void dfs(char[][] grid, int i, int j, int m, int n) {
        if (i < 0 || i >= m || j < 0 || j >= n || grid[i][j] != '1') return;
        grid[i][j] = '0'; // 방문 마킹 (물로 변환)
        dfs(grid, i+1, j, m, n);
        dfs(grid, i-1, j, m, n);
        dfs(grid, i, j+1, m, n);
        dfs(grid, i, j-1, m, n);
    }

    public static void main(String[] args) {
        char[][] g1 = {
            {'1','1','1','1','0'},
            {'1','1','0','1','0'},
            {'1','1','0','0','0'},
            {'0','0','0','0','0'}
        };
        assert numIslands(g1) == 1;

        char[][] g2 = {
            {'1','1','0','0','0'},
            {'1','1','0','0','0'},
            {'0','0','1','0','0'},
            {'0','0','0','1','1'}
        };
        assert numIslands(g2) == 3;
        System.out.println("✓ 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
