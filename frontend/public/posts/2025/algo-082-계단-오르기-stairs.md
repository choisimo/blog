---
title: "[알고리즘] 계단 오르기 (Stairs)"
date: "2025-10-16"
category: "Algorithm"
tags: ["Algorithm", "1D DP", "Problem Solving", "Python", "Java"]
excerpt: "Dynamic Programming - 계단 오르기 (Stairs) 문제에 대한 풀이와 아키텍트 관점의 해설입니다."
readTime: "5분"
---

## 📌 문제 소개

**계단 오르기 (Stairs)**
* 파트: Dynamic Programming
* 관련 알고리즘: 1D DP

> **Architect's View**
> 상태 전이와 점화식

이 글에서는 계단 오르기 (Stairs) 문제에 대해 알고리즘적 접근 방식과 이를 구현한 Python 및 Java 코드를 살펴봅니다.

---

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
