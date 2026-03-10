---
title: "[알고리즘] 고유 경로 (Unique Paths)"
date: "2025-11-02"
category: "Algorithm"
tags: ["Algorithm", "격자 DP", "Problem Solving", "Python", "Java"]
excerpt: "Dynamic Programming - 고유 경로 (Unique Paths) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**고유 경로 (Unique Paths)**
* 파트: Dynamic Programming
* 관련 알고리즘: 격자 DP

> **Architect's View**
> 격자 DP와 조합론

이 글에서는 고유 경로 (Unique Paths) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 089: 고유 경로 (Unique Paths)
[문제] m x n 격자의 좌상단에서 우하단까지 오른쪽/아래로만 이동하는 경로 수를 구하라.
[아키텍트의 시선] 격자 DP와 조합론.
dp[i][j] = dp[i-1][j] + dp[i][j-1]. 조합론: C(m+n-2, m-1).
1D 최적화: dp[j] += dp[j-1].
실무: 네트워크 패킷 경로 수, 격자 기반 라우팅, 확률 계산.
[시간 복잡도] O(m*n) DP / O(min(m,n)) 조합 [공간 복잡도] O(n)
"""
from math import comb

def unique_paths_dp(m: int, n: int) -> int:
    """1D DP"""
    dp = [1] * n
    for i in range(1, m):
        for j in range(1, n):
            dp[j] += dp[j-1]
    return dp[n-1]

def unique_paths_math(m: int, n: int) -> int:
    """조합론: C(m+n-2, m-1)"""
    return comb(m + n - 2, m - 1)

def unique_paths_obstacles(grid: list) -> int:
    """장애물이 있는 격자"""
    m, n = len(grid), len(grid[0])
    if grid[0][0] == 1:
        return 0
    dp = [0] * n
    dp[0] = 1
    for i in range(m):
        for j in range(n):
            if grid[i][j] == 1:
                dp[j] = 0
            elif j > 0:
                dp[j] += dp[j-1]
    return dp[n-1]

if __name__ == "__main__":
    assert unique_paths_dp(3, 7) == 28
    assert unique_paths_math(3, 7) == 28
    assert unique_paths_dp(3, 2) == 3
    assert unique_paths_math(3, 2) == 3
    # 장애물
    assert unique_paths_obstacles([[0,0,0],[0,1,0],[0,0,0]]) == 2
    assert unique_paths_obstacles([[1]]) == 0
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 089: 고유 경로 (Unique Paths)
 *
 * [문제] m x n 격자의 좌상단에서 우하단까지 오른쪽/아래로만 이동하는 경로 수를 구하라.
 *
 * [아키텍트의 시선]
 * 격자 DP와 조합론.
 * dp[i][j] = dp[i-1][j] + dp[i][j-1]. 조합론: C(m+n-2, m-1).
 * 1D 최적화: dp[j] += dp[j-1].
 * 실무: 네트워크 패킷 경로 수, 격자 기반 라우팅, 확률 계산.
 *
 * [시간 복잡도] O(m*n) DP / O(min(m,n)) 조합 [공간 복잡도] O(n)
 */

public class P089UniquePaths {
    // 1D DP
    public static int uniquePathsDP(int m, int n) {
        int[] dp = new int[n];
        java.util.Arrays.fill(dp, 1);
        for (int i = 1; i < m; i++) {
            for (int j = 1; j < n; j++) {
                dp[j] += dp[j - 1];
            }
        }
        return dp[n - 1];
    }

    // 조합론: C(m+n-2, m-1)
    public static long uniquePathsMath(int m, int n) {
        // C(m+n-2, min(m-1, n-1))
        int total = m + n - 2;
        int r = Math.min(m - 1, n - 1);
        long result = 1;
        for (int i = 0; i < r; i++) {
            result = result * (total - i) / (i + 1);
        }
        return result;
    }

    // 장애물이 있는 격자
    public static int uniquePathsObstacles(int[][] grid) {
        int m = grid.length, n = grid[0].length;
        if (grid[0][0] == 1) return 0;
        int[] dp = new int[n];
        dp[0] = 1;
        for (int i = 0; i < m; i++) {
            for (int j = 0; j < n; j++) {
                if (grid[i][j] == 1) {
                    dp[j] = 0;
                } else if (j > 0) {
                    dp[j] += dp[j - 1];
                }
            }
        }
        return dp[n - 1];
    }

    public static void main(String[] args) {
        assert uniquePathsDP(3, 7) == 28;
        assert uniquePathsMath(3, 7) == 28;
        assert uniquePathsDP(3, 2) == 3;
        assert uniquePathsMath(3, 2) == 3;
        // 장애물
        assert uniquePathsObstacles(new int[][]{{0,0,0},{0,1,0},{0,0,0}}) == 2;
        assert uniquePathsObstacles(new int[][]{{1}}) == 0;
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
