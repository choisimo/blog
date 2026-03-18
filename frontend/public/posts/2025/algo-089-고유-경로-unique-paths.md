---
title: "[알고리즘] 고유 경로 (Unique Paths)"
date: "2025-11-02"
category: "Algorithm"
tags: ["Algorithm", "격자 DP", "Problem Solving", "Python", "Java"]
excerpt: "Dynamic Programming - 고유 경로 (Unique Paths) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

고유 경로는 격자에서 이동 경로를 모두 시뮬레이션하는 문제가 아니라, 각 칸에 도달하는 방법 수가 위와 왼쪽의 상태만으로 결정되는 격자 DP 문제입니다. 왜 이 문제가 조합론과 동일한 답을 갖는지 설명해 보세요.

1. `dp[r][c]`가 어떤 의미를 가지는지 정의하고, 행과 열을 채우는 순서를 추적하세요.
2. DP 방식과 조합식 `C(m+n-2, m-1)`을 메모리 사용, overflow, 장애물 확장 가능성 관점에서 비교하세요.
3. 장애물이 추가되면 조합식이 왜 바로 깨지고 DP가 다시 필요해지는지 설명하세요.

## 답변할 때 포함할 것

- 경계 행/열의 의미를 적을 것
- 조합론과 DP의 연결을 설명할 것
- 장애물 변형에서 상태가 어떻게 바뀌는지 적을 것

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
