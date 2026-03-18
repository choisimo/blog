---
title: "[알고리즘] 계단 오르기 (Stairs)"
date: "2025-10-16"
category: "Algorithm"
tags: ["Algorithm", "1D DP", "Problem Solving", "Python", "Java"]
excerpt: "Dynamic Programming - 계단 오르기 (Stairs) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## Top-down 질문

계단 오르기는 조합 나열이 아니라, `i`번째 계단에 도달하는 방법 수가 직전 몇 상태에만 의존하는 선형 상태 전이 문제입니다. 왜 `dp[i] = dp[i-1] + dp[i-2]`가 시스템 전체를 요약하는 충분한 상태인지 설명해 보세요.

1. 작은 n에서 상태 표를 채우며 각 칸이 어떤 이전 칸을 읽는지 추적하세요.
2. 완전 재귀, 메모이제이션, 1D DP, 상수 메모리 rolling 변수를 비교하세요.
3. 한 번에 1,2가 아니라 1,3,5칸처럼 규칙이 바뀌면 상태 차원이 어떻게 달라지는지 설명하세요.

## 답변할 때 포함할 것

- base case를 정확히 적을 것
- 상태 전이 근거를 설명할 것
- rolling 변수로 압축 가능한 이유를 적을 것

## 🐍 Python 구현

```python
"""
문제 082: 계단 오르기 (Climbing Stairs)
[문제] n개의 계단을 1칸 또는 2칸씩 올라갈 때, 가능한 방법의 수를 구하라.
[아키텍트의 시선] 상태 전이와 점화식.
dp[i] = dp[i-1] + dp[i-2] — 피보나치와 동일한 점화식.
복잡한 문제를 '마지막 선택'으로 분해하는 DP의 핵심 사고.
실무: 경로 수 계산, 상태 머신 경로 분석, 웹 네비게이션 패턴.
[시간 복잡도] O(n) [공간 복잡도] O(1)
"""

def climb_stairs(n: int) -> int:
    """Bottom-up O(1) 공간"""
    if n <= 2:
        return n
    a, b = 1, 2
    for _ in range(3, n + 1):
        a, b = b, a + b
    return b

def climb_stairs_k(n: int, k: int) -> int:
    """일반화: 1~k칸씩 오를 수 있을 때"""
    dp = [0] * (n + 1)
    dp[0] = 1
    for i in range(1, n + 1):
        for step in range(1, min(k, i) + 1):
            dp[i] += dp[i - step]
    return dp[n]

if __name__ == "__main__":
    assert climb_stairs(1) == 1
    assert climb_stairs(2) == 2
    assert climb_stairs(3) == 3
    assert climb_stairs(5) == 8
    assert climb_stairs(10) == 89
    # 일반화 (1~3칸)
    assert climb_stairs_k(3, 3) == 4  # {1+1+1, 1+2, 2+1, 3}
    assert climb_stairs_k(4, 3) == 7
    print("\u2713 \ubaa8\ub4e0 \ud14c\uc2a4\ud2b8 \ud1b5\uacfc!")
```

## ☕ Java 구현

```java
/**
 * 문제 082: 계단 오르기 (Climbing Stairs)
 *
 * [문제] n개의 계단을 1칸 또는 2칸씩 올라갈 때, 가능한 방법의 수를 구하라.
 *
 * [아키텍트의 시선]
 * 상태 전이와 점화식.
 * dp[i] = dp[i-1] + dp[i-2] — 피보나치와 동일한 점화식.
 * 복잡한 문제를 '마지막 선택'으로 분해하는 DP의 핵심 사고.
 * 실무: 경로 수 계산, 상태 머신 경로 분석, 웹 네비게이션 패턴.
 *
 * [시간 복잡도] O(n) [공간 복잡도] O(1)
 */

public class P082ClimbingStairs {
    // 기본: 1칸 또는 2칸
    public static int climbStairs(int n) {
        if (n <= 2) return n;
        int a = 1, b = 2;
        for (int i = 3; i <= n; i++) {
            int tmp = a + b;
            a = b;
            b = tmp;
        }
        return b;
    }

    // 일반화: 1~k칸씩 오를 수 있을 때
    public static int climbStairsK(int n, int k) {
        int[] dp = new int[n + 1];
        dp[0] = 1;
        for (int i = 1; i <= n; i++) {
            for (int step = 1; step <= Math.min(k, i); step++) {
                dp[i] += dp[i - step];
            }
        }
        return dp[n];
    }

    public static void main(String[] args) {
        assert climbStairs(1) == 1;
        assert climbStairs(2) == 2;
        assert climbStairs(3) == 3;
        assert climbStairs(5) == 8;
        assert climbStairs(10) == 89;
        // 일반화 (1~3칸)
        assert climbStairsK(3, 3) == 4;  // {1+1+1, 1+2, 2+1, 3}
        assert climbStairsK(4, 3) == 7;
        System.out.println("\u2713 모든 테스트 통과!");
    }
}
```

---
*이 포스트는 알고리즘 학습을 위해 작성된 문서입니다.*
