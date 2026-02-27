---
title: "[알고리즘] 최대 사각형 (Maximal Square)"
date: "2025-11-27"
category: "Algorithm"
tags: ["Algorithm", "2D DP", "Problem Solving", "Python", "Java"]
excerpt: "Advanced Topics - 최대 사각형 (Maximal Square) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**최대 사각형 (Maximal Square)**
* 파트: Advanced Topics
* 관련 알고리즘: 2D DP

> **Architect's View**
> 기하학적 DP 최적화

이 글에서는 최대 사각형 (Maximal Square) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

## 🐍 Python 구현

```python
"""
문제 099: 최대 사각형 (Maximal Square)
[문제] 0과 1로 이루어진 2D 행렬에서 모두 1인 가장 큰 정사각형의 넓이를 구하라.
[아키텍트의 시선] 기하학적 DP 최적화.
dp[i][j] = min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]) + 1 (matrix[i][j]=="1"일 때).
왼쪽, 위, 대각선의 최소 정사각형 + 1 = 현재 가능한 최대 변.
실무: 이미지 처리의 영역 탐지, UI 레이아웃 최적 영역, 지도 분석.
[시간 복잡도] O(m*n) [공간 복잡도] O(n)
"""
from typing import List

def maximal_square(matrix: List[List[str]]) -> int:
    if not matrix:
        return 0
    m, n = len(matrix), len(matrix[0])
    dp = [0] * (n + 1)
    max_side = 0
    prev = 0  # dp[i-1][j-1]

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            temp = dp[j]
            if matrix[i-1][j-1] == "1":
                dp[j] = min(dp[j], dp[j-1], prev) + 1
                max_side = max(max_side, dp[j])
            else:
                dp[j] = 0
            prev = temp
        prev = 0

    return max_side * max_side

if __name__ == "__main__":
    matrix1 = [
        ["1","0","1","0","0"],
        ["1","0","1","1","1"],
        ["1","1","1","1","1"],
        ["1","0","0","1","0"]
    ]
    assert maximal_square(matrix1) == 4  # 2x2
    matrix2 = [["0","1"],["1","0"]]
    assert maximal_square(matrix2) == 1
    matrix3 = [["0"]]
    assert maximal_square(matrix3) == 0
    matrix4 = [
        ["1","1","1"],
        ["1","1","1"],
        ["1","1","1"]
    ]
    assert maximal_square(matrix4) == 9  # 3x3
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 099: 최대 사각형 (Maximal Square)
 *
 * [문제] 0과 1로 이루어진 2D 행렬에서 모두 1인 가장 큰 정사각형의 넓이를 구하라.
 *
 * [아키텍트의 시선]
 * 기하학적 DP 최적화.
 * dp[i][j] = min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]) + 1 (matrix[i][j]=='1'일 때).
 * 왼쪽, 위, 대각선의 최소 정사각형 + 1 = 현재 가능한 최대 변.
 * 실무: 이미지 처리의 영역 탐지, UI 레이아웃 최적 영역, 지도 분석.
 *
 * [시간 복잡도] O(m*n) [공간 복잡도] O(n)
 */

public class P099MaximalSquare {
    public static int maximalSquare(char[][] matrix) {
        if (matrix.length == 0) return 0;
        int m = matrix.length, n = matrix[0].length;
        int[] dp = new int[n + 1];
        int maxSide = 0, prev = 0;

        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                int temp = dp[j];
                if (matrix[i - 1][j - 1] == '1') {
                    dp[j] = Math.min(dp[j], Math.min(dp[j - 1], prev)) + 1;
                    maxSide = Math.max(maxSide, dp[j]);
                } else {
                    dp[j] = 0;
                }
                prev = temp;
            }
            prev = 0;
        }
        return maxSide * maxSide;
    }

    public static void main(String[] args) {
        char[][] m1 = {
            {'1','0','1','0','0'},
            {'1','0','1','1','1'},
            {'1','1','1','1','1'},
            {'1','0','0','1','0'}
        };
        assert maximalSquare(m1) == 4;  // 2x2
        char[][] m2 = {{'0','1'},{'1','0'}};
        assert maximalSquare(m2) == 1;
        char[][] m3 = {{'0'}};
        assert maximalSquare(m3) == 0;
        char[][] m4 = {{'1','1','1'},{'1','1','1'},{'1','1','1'}};
        assert maximalSquare(m4) == 9;  // 3x3
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
